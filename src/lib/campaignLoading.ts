export type CampaignLoadState = "loading" | "ready" | "empty" | "error";

export type CampaignDisplayState = CampaignLoadState | "background";

export function campaignLoadState(input: { isLoading: boolean; isFetching: boolean; hasData: boolean; hasError: boolean; timedOut?: boolean }): CampaignLoadState {
  if (input.hasError && !input.hasData) return "error";
  if (!input.hasData && (input.isLoading || input.isFetching)) return "loading";
  if (input.timedOut && !input.hasData) return "error";
  return input.hasData ? "ready" : "empty";
}

/**
 * Separates a visual deadline from the provider request. A timed-out request
 * stays in flight, but the screen can leave its blocking skeleton and explain
 * that a later snapshot may still arrive.
 */
export function campaignDisplayState(input: { pending: boolean; hasSnapshot: boolean; visualTimedOut: boolean; hasError: boolean }): CampaignDisplayState {
  if (input.hasSnapshot) return "ready";
  if (input.hasError) return "error";
  if (input.visualTimedOut) return "background";
  if (input.pending) return "loading";
  return "empty";
}
