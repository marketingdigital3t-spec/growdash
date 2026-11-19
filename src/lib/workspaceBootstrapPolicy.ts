/**
 * Política de bootstrap do workspace.
 *
 * O bootstrap do workspace é a primeira leitura da sessão autenticada. Ele
 * depende de um RPC (`ensure_current_workspace`) seguido de três leituras
 * paralelas. Quando o Supabase está sob carga, a cadeia inteira estoura o
 * tempo limite e toda a interface cai para "Tempo de carregamento excedido."
 * em praticamente todas as rotas.
 *
 * A fundação do workspace (id, nome, moeda, fuso, papel e unidades) muda
 * raramente. Quando ela já está em cache local, não há motivo para bloquear a
 * interface esperando a rede: o cache pode pintar imediatamente e a
 * revalidação continua em segundo plano.
 *
 * Este módulo isola a decisão para que ela possa ser testada sem rede.
 *
 * Chamadores:
 *   - src/hooks/useWorkspace.ts (useWorkspace, linhas 125-190) usará
 *     decideWorkspaceBootstrapFallback() e isWorkspaceTimeoutError().
 *   - src/hooks/useIsMaster.ts usará IS_MASTER_TIMEOUT_MS.
 *
 * Não existe arquivo equivalente: src/lib/nearRealtimeSyncPolicy.ts trata do
 * gate de invalidação do Realtime e src/lib/queryRefreshPolicy.ts trata do
 * refetch de snapshots — nenhum dos dois cobre o bootstrap do workspace.
 *
 * Instrução verbatim do usuário: "agora eu quero que você resolva toda essa
 * bosta de problema que eu estou tendo na minha plataforma, ou dados da
 * integração do meta ads e do rd station crm esta tudo errado e bugando,
 * corriga para mim urgente"
 */

/** Tempo máximo para cada leitura individual do bootstrap. */
export const WORKSPACE_BOOTSTRAP_READ_TIMEOUT_MS = 20_000;

/** Tempo máximo para a cadeia inteira (RPC + leituras paralelas). */
export const WORKSPACE_BOOTSTRAP_TOTAL_TIMEOUT_MS = 28_000;

/** Tempo máximo da consulta de `is_master`, que é leve mas bloqueia o shell. */
export const IS_MASTER_TIMEOUT_MS = 15_000;

export type WorkspaceBootstrapDecision =
  | { action: "use-cache"; reason: "timeout-with-cache" }
  | { action: "retry"; reason: "timeout-without-cache" }
  | { action: "use-cache"; reason: "error-with-cache" }
  | { action: "throw"; reason: "error-without-cache" };

export type WorkspaceBootstrapOutcome = {
  timedOut: boolean;
  hasCache: boolean;
};

/**
 * Decide o que fazer quando o bootstrap do workspace falha.
 *
 * `timedOut` distingue uma falha de rede (que o cache resolve) de um erro
 * de autorização (que o cache não deve mascarar).
 */
export function decideWorkspaceBootstrapFallback(
  outcome: WorkspaceBootstrapOutcome,
): WorkspaceBootstrapDecision {
  const { timedOut, hasCache } = outcome;
  if (timedOut) {
    return hasCache
      ? { action: "use-cache", reason: "timeout-with-cache" }
      : { action: "retry", reason: "timeout-without-cache" };
  }
  return hasCache
    ? { action: "use-cache", reason: "error-with-cache" }
    : { action: "throw", reason: "error-without-cache" };
}

/** Identifica o timeout de leitura usado pelo `withRequestTimeout`. */
export function isWorkspaceTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /tempo de carregamento excedido|timeout|timed out|abort/i.test(message);
}
