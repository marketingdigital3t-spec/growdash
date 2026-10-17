export type SpacePhase = "terra" | "orbita" | "galaxia";

/**
 * Resolves the visual progression from the canonical monthly revenue value.
 *
 * Boundaries are intentional: R$ 50.000 starts Órbita, R$ 100.000 remains in
 * Órbita, and Galáxia starts only after the account exceeds R$ 100.000.
 */
export function getSpacePhase(monthlyRevenue: number): SpacePhase {
  const revenue = Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0;
  return revenue > 100_000 ? "galaxia" : revenue >= 50_000 ? "orbita" : "terra";
}
