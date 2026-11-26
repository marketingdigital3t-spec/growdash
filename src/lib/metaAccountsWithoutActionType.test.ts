import { describe, expect, it } from "vitest";

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  connection_status: string;
}

interface AccountLpConfig {
  ad_account_id: string;
  action_type: string | null;
}

/**
 * Identifica contas Meta ativas (connection_status === "connected")
 * que não possuem action_type configurado na account_lp_config.
 */
function accountsWithoutActionType(
  accounts: AdAccount[],
  configs: AccountLpConfig[],
): AdAccount[] {
  const configured = new Set(
    configs
      .filter((c) => c.action_type)
      .map((c) => c.ad_account_id),
  );
  return accounts.filter(
    (a) => a.connection_status === "connected" && !configured.has(a.id),
  );
}

describe("Meta accounts without action_type", () => {
  it("identifies active accounts missing action_type configuration", () => {
    const accounts: AdAccount[] = [
      { id: "a1", name: "Conta Ativa 1", account_id: "act_1", connection_status: "connected" },
      { id: "a2", name: "Conta Ativa 2", account_id: "act_2", connection_status: "connected" },
      { id: "a3", name: "Conta Desconectada", account_id: "act_3", connection_status: "disconnected" },
      { id: "a4", name: "Conta Configurada", account_id: "act_4", connection_status: "connected" },
    ];
    const configs: AccountLpConfig[] = [
      { ad_account_id: "a4", action_type: "landing_page_view" },
    ];

    const result = accountsWithoutActionType(accounts, configs);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toContain("Conta Ativa 1");
    expect(result.map((a) => a.name)).toContain("Conta Ativa 2");
  });

  it("excludes disconnected accounts even without action_type", () => {
    const accounts: AdAccount[] = [
      { id: "a1", name: "Conta Desconectada", account_id: "act_1", connection_status: "disconnected" },
    ];
    const configs: AccountLpConfig[] = [];

    expect(accountsWithoutActionType(accounts, configs)).toHaveLength(0);
  });

  it("excludes accounts that already have action_type configured", () => {
    const accounts: AdAccount[] = [
      { id: "a1", name: "Conta Configurada", account_id: "act_1", connection_status: "connected" },
    ];
    const configs: AccountLpConfig[] = [
      { ad_account_id: "a1", action_type: "lead" },
    ];

    expect(accountsWithoutActionType(accounts, configs)).toHaveLength(0);
  });
});
