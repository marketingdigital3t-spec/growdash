export type PlatformAnnouncement = {
  id: string;
  title?: string | null;
  image_data_url: string;
  alt?: string | null;
  active: boolean;
  target_paths?: string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  dismissible?: boolean | null;
  link_url?: string | null;
  priority?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function announcementMatchesPath(targetPaths: string[] | null | undefined, pathname: string) {
  const targets = targetPaths?.length ? targetPaths : ["*"];
  return targets.some((target) => target === "*" || pathname === target || pathname.startsWith(`${target}/`));
}

export function announcementIsScheduledNow(announcement: PlatformAnnouncement, now = new Date()) {
  if (!announcement.active) return false;
  const timestamp = now.getTime();
  const startsAt = announcement.starts_at ? new Date(announcement.starts_at).getTime() : Number.NEGATIVE_INFINITY;
  const endsAt = announcement.ends_at ? new Date(announcement.ends_at).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(startsAt) || startsAt === Number.NEGATIVE_INFINITY
    ? timestamp >= startsAt && timestamp <= endsAt
    : false;
}

export function selectAnnouncementForPath(announcements: PlatformAnnouncement[], pathname: string, now = new Date()) {
  return [...announcements]
    .filter((announcement) => announcementIsScheduledNow(announcement, now) && announcementMatchesPath(announcement.target_paths, pathname))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] ?? null;
}

