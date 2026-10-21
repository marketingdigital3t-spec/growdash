export type TrackingValue = string | boolean | null;

export type TrackingAutoSource = {
  source?: TrackingValue;
  campaign?: TrackingValue;
  adset?: TrackingValue;
  creative?: TrackingValue;
  form?: TrackingValue;
  platform?: TrackingValue;
  placement?: TrackingValue;
  isOrganic?: TrackingValue;
};

export type ManualTracking = Partial<TrackingAutoSource>;

const text = (value: unknown) => {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
};

const booleanValue = (value: unknown): boolean | null => {
  if (value === true || value === "true" || value === "yes" || value === "sim" || value === 1) return true;
  if (value === false || value === "false" || value === "no" || value === "não" || value === "nao" || value === 0) return false;
  return null;
};

export function normalizeTrackingDraft(input: Record<string, unknown>): ManualTracking {
  const output: ManualTracking = {};
  for (const key of ["source", "campaign", "adset", "creative", "form", "platform", "placement"] as const) {
    if (key in input) output[key] = text(input[key]);
  }
  if ("isOrganic" in input) output.isOrganic = booleanValue(input.isOrganic);
  return output;
}

export function mergeManualTracking<T extends TrackingAutoSource>(automatic: T, manual?: ManualTracking | null): T {
  if (!manual) return { ...automatic };
  return { ...automatic, ...normalizeTrackingDraft(manual as Record<string, unknown>) } as T;
}

export function buildTrackingDraft<T extends TrackingAutoSource>(automatic: T, manual?: ManualTracking | null): T {
  return mergeManualTracking(automatic, manual);
}
