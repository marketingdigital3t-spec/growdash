export type CampaignLoadState = "loading" | "ready" | "empty" | "error";

export function campaignLoadState(input: { isLoading: boolean; isFetching: boolean; hasData: boolean; hasError: boolean; timedOut?: boolean }): CampaignLoadState {
  if (input.hasError && !input.hasData) return "error";
  if (!input.hasData && (input.isLoading || input.isFetching)) return "loading";
  if (input.timedOut && !input.hasData) return "error";
  return input.hasData ? "ready" : "empty";
}
