import type { RDAccountConnection } from "@/hooks/useRDAccountConnections";

/**
 * Identifica conexões RD autorizadas que estão marcadas como "connected"
 * mas nunca tiveram uma sincronização bem-sucedida (last_success_at nulo).
 * São candidatas a sincronização imediata para zerar o backlog de contas
 * RD sem estado.
 */
export function neverSyncedRDConnections(
  connections: RDAccountConnection[],
): RDAccountConnection[] {
  return connections.filter(
    (c) => c.status === "connected" && !c.last_success_at,
  );
}

/**
 * Contas CA02 (irmãs de CA01) que nunca sincronizaram. O padrão de nome
 * usado nas conexões do workspace segue "CA02 - <nome>" para distinguir
 * da conta primária "CA01 - <nome>".
 */
export function isCA02AccountName(name: string | null | undefined): boolean {
  return /\bCA\s?0?2\b/i.test(name ?? "");
}

/**
 * Retorna somente as conexões CA02 que nunca sincronizaram, usadas para
 * disparar sincronização prioritária nas contas CA02-Natália e CA02-Fernanda.
 */
export function ca02NeverSynced(connections: RDAccountConnection[]): RDAccountConnection[] {
  return neverSyncedRDConnections(connections).filter((c) =>
    isCA02AccountName(c.account_name),
  );
}
