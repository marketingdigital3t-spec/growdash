export type SyncBlock = {
  status?: string;
  success?: boolean;
  error?: string;
  errors?: string[];
};

export function summarizeMetaSyncBlocks(blocks: {
  insights: SyncBlock;
  leads?: SyncBlock;
  hourly?: SyncBlock;
}) {
  const primaryFailed = blocks.insights.success === false || ["partial", "failed", "blocked"].includes(String(blocks.insights.status || ""));
  const warnings = [
    ...(blocks.leads?.status === "partial" ? ["Leads/forms Meta parcialmente atualizados; snapshot anterior preservado."] : []),
    ...(blocks.leads?.error ? [`Leads/forms Meta: ${blocks.leads.error}`] : []),
    ...(blocks.leads?.errors || []),
    ...(blocks.hourly?.status === "partial" ? ["Distribuição horária Meta parcialmente atualizada; snapshot anterior preservado."] : []),
    ...(blocks.hourly?.error ? [`Distribuição horária Meta: ${blocks.hourly.error}`] : []),
    ...(blocks.hourly?.errors || []),
  ];
  return {
    status: primaryFailed ? "partial" as const : "success" as const,
    success: !primaryFailed,
    warnings: Array.from(new Set(warnings)),
  };
}

export type SyncFailureState = "partial" | "error";

export function describeSyncFailure({ hasSnapshot, provider, message = "" }: { hasSnapshot: boolean; provider: string; message?: string }) {
  const isTimeout = /tempo|timeout|excedido/i.test(message);
  return {
    state: (hasSnapshot ? "partial" : "error") as SyncFailureState,
    message: hasSnapshot
      ? `${provider} ${isTimeout ? "não respondeu a tempo" : "não concluiu a atualização"}. Último snapshot válido preservado; tente novamente para atualizar.`
      : `${provider} indisponível neste momento. Tente novamente para carregar os dados.`,
  };
}
