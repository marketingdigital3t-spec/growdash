export type GrowthBlockReason =
  | "stale_snapshot"
  | "partial_snapshot"
  | "attribution_divergence"
  | "policy_failure"
  | "token_invalid"
  | "budget_limit"
  | "remote_state_mismatch"
  | "insufficient_evidence";

export type GrowthExperimentStatus =
  | "planned" | "generating" | "rendering" | "policy_review" | "ready"
  | "published" | "measuring" | "promoted" | "stopped" | "blocked" | "rolled_back";

export interface GrowthMetricSnapshot {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  opportunities: number;
  sales: number;
  revenue: number;
  ctr: number;
  cpm: number;
  cpl: number;
  frequency: number;
}

export interface GrowthSnapshotHealth {
  freshnessMinutes: number;
  quality: "confirmed" | "partial" | "stale" | "error";
  attributionCoverage: number;
}

export interface GrowthDecisionInput {
  current: GrowthMetricSnapshot;
  baseline: GrowthMetricSnapshot;
  health: GrowthSnapshotHealth;
  referenceCpl: number;
  accountDailyBudget: number;
  activeTestSpendToday: number;
  maxConcurrentTests: number;
  activeTests: number;
  hasPolicyFailure?: boolean;
  tokenValid?: boolean;
  remoteStateConfirmed?: boolean;
}

const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (value: number, base: number) => base > 0 ? ((value - base) / base) * 100 : 0;
const rate = (value: number, base: number) => base > 0 ? value / base : 0;

/** Scores a funnel outcome; downstream RD stages have more weight than raw leads. */
export function qualityScore(metrics: GrowthMetricSnapshot, referenceCpl: number): number {
  const leadQuality = rate(metrics.qualifiedLeads, metrics.leads);
  const opportunityQuality = rate(metrics.opportunities, Math.max(metrics.qualifiedLeads, metrics.leads));
  const saleQuality = rate(metrics.sales, Math.max(metrics.opportunities, metrics.qualifiedLeads, metrics.leads));
  const cplEfficiency = referenceCpl > 0 && metrics.cpl > 0 ? Math.max(0, Math.min(1, referenceCpl / metrics.cpl)) : 0;
  const ctrEfficiency = Math.max(0, Math.min(1, metrics.ctr / 3));
  return Math.round((saleQuality * 0.4 + opportunityQuality * 0.3 + leadQuality * 0.15 + cplEfficiency * 0.1 + ctrEfficiency * 0.05) * 10000) / 100;
}

export function detectCreativeHealth(current: GrowthMetricSnapshot, baseline: GrowthMetricSnapshot, referenceCpl: number) {
  const ctrChange = pct(current.ctr, baseline.ctr);
  const cpmChange = pct(current.cpm, baseline.cpm);
  const cplChange = pct(current.cpl, baseline.cpl || referenceCpl);
  const frequencyRisk = current.frequency >= 3 && current.ctr < baseline.ctr;
  const qualityDrop = qualityScore(current, referenceCpl) + 10 < qualityScore(baseline, referenceCpl);
  const deteriorating = ctrChange <= -20 || (cpmChange >= 25 && ctrChange < 0) || cplChange >= 20 || frequencyRisk || qualityDrop;
  return { deteriorating, ctrChange, cpmChange, cplChange, frequencyRisk, qualityDrop, currentScore: qualityScore(current, referenceCpl), baselineScore: qualityScore(baseline, referenceCpl) };
}

export function deriveTestBudget(referenceCpl: number, accountDailyBudget: number, activeTestSpendToday: number, maxAccountFraction = 0.1, hardCap = 500): number {
  const cplBudget = Math.max(0, n(referenceCpl));
  const accountCap = Math.max(0, n(accountDailyBudget) * maxAccountFraction);
  const remaining = Math.max(0, accountCap - n(activeTestSpendToday));
  return Math.round(Math.min(cplBudget, remaining, hardCap) * 100) / 100;
}

export function canStartTest(input: GrowthDecisionInput): { ok: boolean; reason?: GrowthBlockReason; budget: number } {
  const budget = deriveTestBudget(input.referenceCpl, input.accountDailyBudget, input.activeTestSpendToday);
  if (input.health.quality === "stale" || input.health.freshnessMinutes > 90) return { ok: false, reason: "stale_snapshot", budget };
  if (input.health.quality !== "confirmed") return { ok: false, reason: "partial_snapshot", budget };
  if (input.health.attributionCoverage < 0.8) return { ok: false, reason: "attribution_divergence", budget };
  if (input.hasPolicyFailure) return { ok: false, reason: "policy_failure", budget };
  if (input.tokenValid === false) return { ok: false, reason: "token_invalid", budget };
  if (input.remoteStateConfirmed === false) return { ok: false, reason: "remote_state_mismatch", budget };
  if (input.activeTests >= input.maxConcurrentTests || budget <= 0) return { ok: false, reason: "budget_limit", budget };
  return { ok: true, budget };
}

export function shouldStopTest(metrics: GrowthMetricSnapshot, budget: number, referenceCpl: number, hoursRunning: number): boolean {
  if (metrics.spend >= budget && metrics.qualifiedLeads === 0 && metrics.opportunities === 0 && metrics.sales === 0) return true;
  if (hoursRunning >= 72 && metrics.spend >= Math.max(1, referenceCpl) && qualityScore(metrics, referenceCpl) < 10) return true;
  return false;
}

export function shouldPromoteTest(metrics: GrowthMetricSnapshot, baseline: GrowthMetricSnapshot, referenceCpl: number, hoursRunning: number): boolean {
  if (hoursRunning < 72) return false;
  if (metrics.sales > 0) return qualityScore(metrics, referenceCpl) >= qualityScore(baseline, referenceCpl);
  if (metrics.opportunities > 0) return qualityScore(metrics, referenceCpl) >= qualityScore(baseline, referenceCpl) * 1.05;
  return metrics.qualifiedLeads > 0 && qualityScore(metrics, referenceCpl) > qualityScore(baseline, referenceCpl) * 1.1;
}

export function experimentIdempotencyKey(accountId: string, sourceAdsetId: string, hypothesis: string, windowStart: string): string {
  return [accountId, sourceAdsetId, hypothesis.trim().toLowerCase(), windowStart].join(":");
}
