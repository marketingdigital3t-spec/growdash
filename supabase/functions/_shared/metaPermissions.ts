/**
 * Insights, delivery, and conversion action counts require ads_read. The
 * leads_retrieval permission is only needed for reading person-level Lead Ads
 * submissions and must not block Ads Manager-style aggregate metrics.
 */
export function resolveMetaPermissionStatus(permissions: string[]) {
  const granted = new Set(permissions.map((permission) => String(permission).trim()));
  const missingPermissions = ["ads_read"].filter((permission) => !granted.has(permission));
  const optionalMissingPermissions = ["leads_retrieval"].filter((permission) => !granted.has(permission));

  return {
    status: missingPermissions.length ? "permission_removed" as const : "healthy" as const,
    missingPermissions,
    optionalMissingPermissions,
  };
}
