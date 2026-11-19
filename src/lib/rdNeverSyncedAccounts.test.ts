import { describe, expect, it } from "vitest";

interface RDConnection {
  id: string;
  account_name: string;
  external_account_id: string | null;
  status: string;
  last_success_at: string | null;
  last_error: string | null;
}

function neverSynced(connections: RDConnection[]): RDConnection[] {
  return connections.filter((c) => c.status === "connected" && !c.last_success_at);
}

function caAccountName(name: string): string | null {
  const m = name.match(/\bCA\s?0?2\b/i);
  return m ? m[0] : null;
}

describe("RD accounts never synced", () => {
  it("identifies connected accounts with no successful sync", () => {
    const connections: RDConnection[] = [
      { id: "1", account_name: "CA01 - DRA NATÁLIA", external_account_id: "act_111", status: "connected", last_success_at: "2026-11-15T10:00:00Z", last_error: null },
      { id: "2", account_name: "CA02 - DRA NATÁLIA", external_account_id: "act_222", status: "connected", last_success_at: null, last_error: null },
      { id: "3", account_name: "CA02 - FERNANDA", external_account_id: "act_333", status: "connected", last_success_at: null, last_error: null },
      { id: "4", account_name: "CA01 - FERNANDA", external_account_id: "act_444", status: "connected", last_success_at: "2026-11-15T11:00:00Z", last_error: null },
      { id: "5", account_name: "CA02 - JOSÉ", external_account_id: "act_555", status: "failed", last_success_at: null, last_error: "timeout" },
    ];

    const result = neverSynced(connections);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.account_name)).toContain("CA02 - DRA NATÁLIA");
    expect(result.map((c) => c.account_name)).toContain("CA02 - FERNANDA");
  });

  it("does not include failed connections", () => {
    const connections: RDConnection[] = [
      { id: "1", account_name: "CA02 - JOSÉ", external_account_id: "act_555", status: "failed", last_success_at: null, last_error: "timeout" },
    ];

    expect(neverSynced(connections)).toHaveLength(0);
  });

  it("identifies CA02 accounts by name pattern", () => {
    const names = ["CA02 - DRA NATÁLIA", "CA02 - FERNANDA", "CA01 - NATÁLIA", "CA02-JOSÉ"];
    const ca02 = names.filter((n) => caAccountName(n));
    expect(ca02).toHaveLength(3);
  });
});
