import { describe, expect, it } from "vitest";
import { markDeferredMetaAccountCoverage, selectMetaAccountSyncBatch } from "../../supabase/functions/_shared/metaSyncBatch";

describe("five-minute Meta account rotation", () => {
  it("prioritizes never-synced and oldest-attempted connected accounts", () => {
    const accounts = [
      { id: "newer", last_sync_attempt_at: "2026-10-04T12:10:00Z" },
      { id: "never", last_sync_attempt_at: null },
      { id: "oldest", last_sync_attempt_at: "2026-10-04T11:00:00Z" },
      { id: "newest", last_sync_attempt_at: "2026-10-04T12:20:00Z" },
    ];

    expect(selectMetaAccountSyncBatch(accounts, 2)).toEqual({
      selected: [accounts[1], accounts[2]],
      deferred: [accounts[0], accounts[3]],
    });
  });

  it("returns all eligible accounts when the batch limit is larger", () => {
    expect(selectMetaAccountSyncBatch([{ id: "one" }, { id: "two" }], 8).selected.map((account) => account.id))
      .toEqual(["one", "two"]);
  });

  it("marks a successful batch partial while connected accounts are deferred", () => {
    expect(markDeferredMetaAccountCoverage({ ok: true, status: 200, body: { success: true, status: "success" } }, 32, 8, 24))
      .toEqual({ ok: false, status: 207, body: { success: false, status: "partial", connected_accounts_total: 32, accounts_processed: 8, accounts_deferred: 24 } });
  });

  it("keeps complete coverage successful when no accounts are deferred", () => {
    expect(markDeferredMetaAccountCoverage({ ok: true, status: 200, body: { success: true, status: "success" } }, 8, 8, 0))
      .toEqual({ ok: true, status: 200, body: { success: true, status: "success", connected_accounts_total: 8, accounts_processed: 8, accounts_deferred: 0 } });
  });
});
