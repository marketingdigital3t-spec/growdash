export type MetricAvailabilityState = "loading" | "fresh" | "stale" | "partial" | "unavailable";

export interface MetricAvailability {
  state: MetricAvailabilityState;
  reason?: string | null;
  updatedAt?: string | null;
}

export function isMetricAvailable(availability: MetricAvailability | null | undefined) {
  return availability?.state === "fresh" || availability?.state === "stale" || availability?.state === "partial";
}

export function displayMetricValue<T>(
  value: number,
  availability: MetricAvailability | null | undefined,
  formatter: (value: number) => T,
): T | string {
  if (availability?.state === "loading") return "Carregando…";
  if (!isMetricAvailable(availability)) return "Indisponível";
  return formatter(value);
}
