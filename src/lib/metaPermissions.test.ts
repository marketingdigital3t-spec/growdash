import { describe, expect, it } from "vitest";
import { resolveMetaPermissionStatus } from "../../supabase/functions/_shared/metaPermissions";

describe("Meta OAuth scopes for aggregate analytics", () => {
  it("allows Ads Manager-style insights when ads_read is granted without leads_retrieval", () => {
    expect(resolveMetaPermissionStatus(["ads_read", "business_management"])).toEqual({
      status: "healthy",
      missingPermissions: [],
      optionalMissingPermissions: ["leads_retrieval"],
    });
  });

  it("blocks aggregate metrics only when ads_read is missing", () => {
    expect(resolveMetaPermissionStatus(["leads_retrieval"])).toEqual({
      status: "permission_removed",
      missingPermissions: ["ads_read"],
      optionalMissingPermissions: [],
    });
  });
});
