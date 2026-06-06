import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchActiveAnnouncement, readAnnouncement, type PlatformAnnouncement } from "@/lib/announcement";

export function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement | null>(() => readAnnouncement());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setAnnouncement(readAnnouncement());
      setHidden(false);
    };
    void fetchActiveAnnouncement().then((current) => {
      setAnnouncement(current);
      setHidden(false);
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("growdash:announcement-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("growdash:announcement-updated", refresh);
    };
  }, []);

  if (!announcement || hidden) return null;

  return (
    <section className="px-4 pt-4 md:px-6">
      <div className="group relative overflow-hidden rounded-lg border border-primary/25 bg-card/80 shadow-[0_0_44px_hsl(var(--primary)/0.18)] backdrop-blur-xl">
        <img
          src={announcement.imageDataUrl}
          alt={announcement.alt || "Anúncio da plataforma"}
          className="block max-h-52 w-full object-cover"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/80 opacity-90 backdrop-blur hover:opacity-100"
          onClick={() => setHidden(true)}
          aria-label="Fechar anúncio"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
