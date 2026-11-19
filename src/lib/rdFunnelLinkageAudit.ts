export interface RDFunnel {
  id: string;
  name: string;
  ad_account_id: string | null;
  rd_connection_id: string | null;
  rd_funnel_id: string | null;
  is_active: boolean;
}

export interface FunnelAuditResult {
  total: number;
  active: number;
  inactive: number;
  linkedToPipeline: number;
  activeWithoutPipeline: number;
  orphaned: number;
  activeWithoutAccountOrConnection: number;
  inactiveWithAccount: number;
  orphanedDetails: Array<{ id: string; name: string }>;
  activeWithoutPipelineDetails: Array<{ id: string; name: string }>;
}

/**
 * Audita a vinculação dos funis RD para detectar:
 * - Funis ativos sem rd_funnel_id (não vinculados a um pipeline real no RD)
 * - Funis órfãos (sem ad_account_id e sem rd_connection_id)
 * - Funis inativos que ainda possuem ad_account_id
 */
export function auditFunnelLinkage(funnels: RDFunnel[]): FunnelAuditResult {
  const active = funnels.filter((f) => f.is_active);
  const inactive = funnels.filter((f) => !f.is_active);

  const linkedToPipeline = active.filter((f) => Boolean(f.rd_funnel_id));
  const activeWithoutPipeline = active.filter((f) => !f.rd_funnel_id);
  const orphaned = active.filter(
    (f) => !f.rd_funnel_id && !f.rd_connection_id,
  );
  const activeWithoutAccountOrConnection = active.filter(
    (f) => !f.ad_account_id && !f.rd_connection_id,
  );
  const inactiveWithAccount = inactive.filter((f) => Boolean(f.ad_account_id));

  return {
    total: funnels.length,
    active: active.length,
    inactive: inactive.length,
    linkedToPipeline: linkedToPipeline.length,
    activeWithoutPipeline: activeWithoutPipeline.length,
    orphaned: orphaned.length,
    activeWithoutAccountOrConnection: activeWithoutAccountOrConnection.length,
    inactiveWithAccount: inactiveWithAccount.length,
    orphanedDetails: orphaned.map((f) => ({ id: f.id, name: f.name })),
    activeWithoutPipelineDetails: activeWithoutPipeline.map((f) => ({
      id: f.id,
      name: f.name,
    })),
  };
}

/**
 * Verifica se a vinculação dos 17 funis RD está consistente:
 * - Todo funil ativo deve ter rd_funnel_id (pipeline real)
 * - Todo funil ativo deve ter ad_account_id ou rd_connection_id
 */
export function isFunnelLinkageHealthy(result: FunnelAuditResult): boolean {
  return (
    result.orphaned === 0 &&
    result.activeWithoutAccountOrConnection === 0 &&
    result.activeWithoutPipeline === 0
  );
}
