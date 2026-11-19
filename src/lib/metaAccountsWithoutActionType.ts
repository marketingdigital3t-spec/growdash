export interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  connection_status: string;
}

export interface AccountLpConfig {
  ad_account_id: string;
  action_type: string | null;
}

/**
 * Identifica contas Meta ativas (connection_status === "connected")
 * que não possuem action_type configurado na account_lp_config.
 * Sem action_type, eventos de site (landing_page_view, purchase, etc.)
 * não são mapeados como leads para essas contas.
 */
export function accountsWithoutActionType(
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
