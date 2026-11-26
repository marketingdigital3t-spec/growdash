import { describe, expect, it } from "vitest";

interface SocialAccount {
  id: string;
  provider: string;
  username: string;
  connection_status: string;
  last_error: string | null;
  last_sync_at: string | null;
}

/**
 * Detecta contas do Instagram com token expirado (connection_status = 'expired').
 * Essas contas precisam de renovação de token via OAuth para voltar a sincronizar.
 */
function expiredInstagramAccounts(accounts: SocialAccount[]): SocialAccount[] {
  return accounts.filter(
    (a) => a.provider === "instagram" && a.connection_status === "expired",
  );
}

describe("Instagram expired token detection", () => {
  it("identifies Instagram accounts with expired connection status", () => {
    const accounts: SocialAccount[] = [
      { id: "1", provider: "instagram", username: "natália_barragão", connection_status: "expired", last_error: "Token expirado", last_sync_at: null },
      { id: "2", provider: "instagram", username: "fernanda_silva", connection_status: "connected", last_error: null, last_sync_at: "2026-11-15T10:00:00Z" },
      { id: "3", provider: "facebook", username: "page_fernanda", connection_status: "expired", last_error: "Token expirado", last_sync_at: null },
      { id: "4", provider: "instagram", username: "clube_zanini", connection_status: "error", last_error: "Rate limited", last_sync_at: null },
    ];

    const result = expiredInstagramAccounts(accounts);

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("natália_barragão");
  });

  it("does not include Facebook accounts even if expired", () => {
    const accounts: SocialAccount[] = [
      { id: "1", provider: "facebook", username: "page_x", connection_status: "expired", last_error: "expired", last_sync_at: null },
    ];

    expect(expiredInstagramAccounts(accounts)).toHaveLength(0);
  });

  it("returns empty when no expired Instagram accounts", () => {
    const accounts: SocialAccount[] = [
      { id: "1", provider: "instagram", username: "ok_account", connection_status: "connected", last_error: null, last_sync_at: "2026-11-15T10:00:00Z" },
    ];

    expect(expiredInstagramAccounts(accounts)).toHaveLength(0);
  });
});
