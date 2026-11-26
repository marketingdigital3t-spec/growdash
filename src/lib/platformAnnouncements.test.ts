import { describe, expect, it } from "vitest";
import { announcementMatchesPath, announcementIsScheduledNow, selectAnnouncementForPath, type PlatformAnnouncement } from "./platformAnnouncements";

const base: PlatformAnnouncement = { id: "a", image_data_url: "data:image/png;base64,x", active: true, target_paths: ["/campanhas"], starts_at: "2026-07-01T00:00:00Z", ends_at: "2026-07-31T23:59:59Z", priority: 1 };

describe("platform announcements", () => {
  it("matches an exact page and its descendants", () => {
    expect(announcementMatchesPath(["/campanhas"], "/campanhas")).toBe(true);
    expect(announcementMatchesPath(["/campanhas"], "/campanhas/123")).toBe(true);
    expect(announcementMatchesPath(["/campanhas"], "/financeiro")).toBe(false);
  });

  it("respects the publication window", () => {
    expect(announcementIsScheduledNow(base, new Date("2026-07-16T12:00:00Z"))).toBe(true);
    expect(announcementIsScheduledNow(base, new Date("2026-08-01T00:00:00Z"))).toBe(false);
  });

  it("chooses the highest-priority applicable announcement", () => {
    const selected = selectAnnouncementForPath([base, { ...base, id: "b", priority: 9 }], "/campanhas", new Date("2026-07-16T12:00:00Z"));
    expect(selected?.id).toBe("b");
  });
});

