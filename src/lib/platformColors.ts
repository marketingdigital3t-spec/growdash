import type { TopPlatform } from "@/lib/platformInference";

/** Stable semantic colors for platform charts in light and dark themes. */
export const PLATFORM_COLORS: Record<TopPlatform, string> = {
  meta: "#1877f2",
  google: "#ea4335",
  organic: "#10b981",
  unknown: "#64748b",
};

export const PLATFORM_SURFACE_TEXT: Record<TopPlatform, string> = {
  meta: "#ffffff",
  google: "#ffffff",
  organic: "#052e1b",
  unknown: "#ffffff",
};
