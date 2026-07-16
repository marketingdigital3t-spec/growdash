import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { selectAnnouncementForPath, type PlatformAnnouncement } from "@/lib/platformAnnouncements";
import { useAuth } from "@/contexts/AuthContext";

function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function GlobalAnnouncementBanner() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [dismissVersion, setDismissVersion] = useState(0);
  const { data: announcements = [] } = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("platform_announcements").select("*").eq("active", true).limit(100);
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205" || /platform_announcements|schema cache|does not exist/i.test(error.message || "")) return [];
        throw error;
      }
      return (data ?? []) as PlatformAnnouncement[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const selected = useMemo(() => {
    // The counter invalidates this memo immediately after a local dismissal.
    void dismissVersion;
    const visible = announcements.filter((item) => {
      if (typeof window === "undefined") return true;
      const dismissal = window.localStorage.getItem(`growdash:announcement-dismissed:${user?.id || "anonymous"}:${item.id}`);
      return dismissal !== (item.updated_at || item.id);
    });
    return selectAnnouncementForPath(visible, pathname);
  }, [announcements, dismissVersion, pathname, user?.id]);

  if (!selected) return null;
  const link = safeExternalUrl(selected.link_url);
  const picture = <img src={selected.image_data_url} alt={selected.alt || selected.title || "Anúncio Growdash"} className="max-h-[260px] w-full object-cover object-center sm:max-h-[300px]" />;

  return (
    <aside className="relative mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-[0_18px_50px_-36px_hsl(var(--primary)/.75)]" aria-label={selected.title || "Anúncio da plataforma"}>
      {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="group block">{picture}<span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">Abrir <ExternalLink className="h-3 w-3" /></span></a> : picture}
      {selected.dismissible !== false && <button type="button" onClick={() => { window.localStorage.setItem(`growdash:announcement-dismissed:${user?.id || "anonymous"}:${selected.id}`, selected.updated_at || selected.id); setDismissVersion((value) => value + 1); }} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85" aria-label="Fechar anúncio"><X className="h-4 w-4" /></button>}
    </aside>
  );
}
