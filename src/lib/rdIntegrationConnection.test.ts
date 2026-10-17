import { describe, expect, it } from "vitest";
import { selectPrimaryRDIntegration } from "./rdIntegrationConnection";

const connection = (overrides: Partial<Parameters<typeof selectPrimaryRDIntegration>[0][number]>) => ({
  id: "connection",
  status: "connected",
  external_account_id: null,
  created_at: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

describe("selectPrimaryRDIntegration", () => {
  it("keeps the owner-level RD connection stable when another account syncs later", () => {
    const primary = connection({ id: "rd-owner", external_account_id: "rd:user:rd-station", created_at: "2026-10-10T00:00:00.000Z" });
    const syncedAccount = connection({ id: "meta-account", external_account_id: "act_123", created_at: "2026-09-01T00:00:00.000Z" });

    expect(selectPrimaryRDIntegration([syncedAccount, primary])?.id).toBe("rd-owner");
  });

  it("uses a legacy RD-only row when the new owner-level row does not exist", () => {
    const legacy = connection({ id: "legacy-rd", external_account_id: null });
    const meta = connection({ id: "meta-account", external_account_id: "act_123" });

    expect(selectPrimaryRDIntegration([meta, legacy])?.id).toBe("legacy-rd");
  });

  it("returns null when no RD connection exists", () => {
    expect(selectPrimaryRDIntegration([])).toBeNull();
  });
});
