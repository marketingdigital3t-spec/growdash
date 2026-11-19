import { readBackgroundSyncAttempt, recordBackgroundSyncAttempt } from "@/lib/backgroundSyncStorage";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Intervalo mínimo entre sincronizações automáticas do provider. */
export const MANUAL_SYNC_COOLDOWN_MS = 15 * 60_000;

const MANUAL_SYNC_PREFIX = "growdash:manual-sync";

/**
 * Janela decooling do clique manual.
 *
 * A regra pedida: depois de uma atualização manual, nenhuma sincronização
 * automática de Meta/RD pode rodar até passarem 15 minutos. Só um novo
 * clique em "Atualizar" (ou o fim da janela) libera a próxima rodada.
 */
export function recordManualSync(storage: StorageLike | null | undefined, scope: string, timestamp = Date.now()) {
  recordBackgroundSyncAttempt(storage, `${MANUAL_SYNC_PREFIX}:${scope}`, timestamp);
}

/** Quanto tempo falta para uma sincronização automática ser liberada. */
export function manualSyncCooldownRemainingMs(
  storage: StorageLike | null | undefined,
  scope: string,
  now = Date.now(),
): number {
  const last = readBackgroundSyncAttempt(storage, `${MANUAL_SYNC_PREFIX}:${scope}`);
  if (!last) return 0;
  const remaining = MANUAL_SYNC_COOLDOWN_MS - (now - last);
  return remaining > 0 ? remaining : 0;
}

/**
 * Uma sincronização automática só é permitida quando não há nenhum clique
 * manual recente para o mesmo escopo.
 */
export function canRunAutomaticSync(
  storage: StorageLike | null | undefined,
  scope: string,
  now = Date.now(),
): boolean {
  return manualSyncCooldownRemainingMs(storage, scope, now) === 0;
}
