export type PlatformHealthStatus = "fresh" | "stale" | "degraded" | "no_data";

export function percentile(values: number[], rank: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index];
}

export function classifyWatermark(
  lastSuccessAt: string | null | undefined,
  status: string | null | undefined,
  now = Date.now(),
): PlatformHealthStatus {
  if (["failed", "error", "partial", "blocked"].includes(String(status || "").toLowerCase())) return "degraded";
  if (!lastSuccessAt) return "no_data";
  const timestamp = new Date(lastSuccessAt).getTime();
  if (!Number.isFinite(timestamp)) return "no_data";
  const age = Math.max(0, now - timestamp);
  if (age <= 15 * 60_000) return "fresh";
  if (age <= 60 * 60_000) return "stale";
  return "degraded";
}

export function mergeHealthStatuses(statuses: PlatformHealthStatus[]): PlatformHealthStatus {
  if (!statuses.length || statuses.every((status) => status === "no_data")) return "no_data";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("stale")) return "stale";
  return "fresh";
}
