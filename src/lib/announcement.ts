import { supabase } from "@/integrations/supabase/client";

export interface PlatformAnnouncement {
  id?: string;
  imageDataUrl: string;
  alt: string;
  updatedAt: string;
}

export const ANNOUNCEMENT_KEY = "trackvio:platform-announcement";

export function readAnnouncement(): PlatformAnnouncement | null {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlatformAnnouncement;
    if (!parsed.imageDataUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAnnouncement(announcement: PlatformAnnouncement) {
  localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
  window.dispatchEvent(new Event("trackvio:announcement-updated"));
}

export function removeAnnouncement() {
  localStorage.removeItem(ANNOUNCEMENT_KEY);
  window.dispatchEvent(new Event("trackvio:announcement-updated"));
}

function mapAnnouncement(row: any): PlatformAnnouncement | null {
  if (!row?.image_data_url) return null;
  return {
    id: row.id,
    imageDataUrl: row.image_data_url,
    alt: row.alt || "Anúncio Trackvio",
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function fetchActiveAnnouncement(): Promise<PlatformAnnouncement | null> {
  const { data, error } = await (supabase.from("platform_announcements" as any) as any)
    .select("id,image_data_url,alt,updated_at,active")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return readAnnouncement();
  const announcement = mapAnnouncement(data);
  if (announcement) {
    localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
    return announcement;
  }
  return readAnnouncement();
}

export async function publishAnnouncement(announcement: PlatformAnnouncement) {
  const payload = {
    image_data_url: announcement.imageDataUrl,
    alt: announcement.alt,
    active: true,
    updated_at: announcement.updatedAt,
  };

  const deactivate = await (supabase.from("platform_announcements" as any) as any)
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);

  if (deactivate.error) {
    saveAnnouncement(announcement);
    return { data: announcement, error: deactivate.error };
  }

  const { data, error } = await (supabase.from("platform_announcements" as any) as any)
    .insert(payload)
    .select("id,image_data_url,alt,updated_at,active")
    .maybeSingle();

  if (error) {
    saveAnnouncement(announcement);
    return { data: announcement, error };
  }

  const saved = mapAnnouncement(data) || announcement;
  saveAnnouncement(saved);
  return { data: saved, error: null };
}

export async function deactivateAnnouncement() {
  const { error } = await (supabase.from("platform_announcements" as any) as any)
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);
  removeAnnouncement();
  return { error };
}
