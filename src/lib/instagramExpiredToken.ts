export interface SocialAccount {
  id: string;
  provider: string;
  username: string;
  connection_status: string;
  last_error: string | null;
  last_sync_at: string | null;
}

/**
 * Detecta contas do Instagram com token expirado (connection_status = 'expired').
 * Essas contas precisam de renovação de token via OAuth para voltar a sincronizar
 * conteúdos, Reels, alcance e interações.
 */
export function expiredInstagramAccounts(
  accounts: SocialAccount[],
): SocialAccount[] {
  return accounts.filter(
    (a) => a.provider === "instagram" && a.connection_status === "expired",
  );
}

/**
 * Verifica se há alguma conta do Instagram com token expirado.
 */
export function hasExpiredInstagramToken(accounts: SocialAccount[]): boolean {
  return expiredInstagramAccounts(accounts).length > 0;
}
