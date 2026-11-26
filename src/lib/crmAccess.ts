export function crmPipelineEnabled(hasUser: boolean) {
  // Visibility is enforced by Supabase RLS. Do not couple read access to the
  // current user's personal RD credential: a workspace member can legitimately
  // access a funnel owned and connected by another member.
  return hasUser;
}

export function crmEmptyState({ hasFunnels, hasOwnIntegration }: { hasFunnels: boolean; hasOwnIntegration: boolean }) {
  if (hasFunnels) return "Os funis estão acessíveis, mas ainda não retornaram negociações. Atualize o RD para sincronizar.";
  if (hasOwnIntegration) return "Vincule um funil do RD Station a uma conta para começar a sincronização.";
  return "Conecte o RD Station ou peça acesso a um funil já conectado.";
}
