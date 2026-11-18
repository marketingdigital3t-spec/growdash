# Plano: Investigação de vendas mostram 7 em vez de 9 no CRM

## Objetivo
Identificar a causa raiz de por que vendas realizadas mostram 7 em vez de 9 no CRM Growdash quando filtrado por data de fechamento (09/11/2026 a 18/11/2026). O RD Station mostra 9 vendas no mesmo período.

## Contexto verificado
- O usuário reporta que o RD Station CRM mostra 9 vendas realizadas no período 09/11 a 17/11
- O Growdash mostra apenas 7 vendas no mesmo período
- Hipóteses iniciais: filtro por created_at em vez de closed_at, ou trigger trg_sync_rd_deal_to_canonical_sale não dispare para deals com closed_at diferente de created_at

## Conhecimento prévio do código (leituras já feitas)
- `src/hooks/useRDDealsForPeriod.ts` - filtra vendas por closed_at (correto)
- `src/hooks/useRDDeals.ts` - `useRDClosedDeals` filtra por closed_at (correto)
- `src/growdash/CrmPage.tsx` - usa `useRDDealsForPeriod` com dateRule "created_at_for_open_closed_at_for_won"
- `src/lib/crmBoardDateScope.ts` - `dealBelongsToBoardPeriod` usa closed_at para negócios terminais
- `src/lib/canonicalMetrics.ts` - `canonicalWonDealsInPeriod` usa closed_at para vendas
- `supabase/migrations/20261117150000_materialize_rd_sales_for_won_deals.sql` - materializa vendas para deals ganhos, usando closed_at

## Arquivos a investigar (em ordem)
1. `src/hooks/useRDDealsForPeriod.ts` - ver se a query de vendas usa closed_at corretamente
2. `src/growdash/CrmPage.tsx` - ver como vendas são filtradas e exibidas
3. `src/lib/crmBoardDateScope.ts` - verificar dealBelongsToBoardPeriod
4. `src/lib/canonicalMetrics.ts` - verificar canonicalWonDealsInPeriod
5. `supabase/migrations/20261117150000_materialize_rd_sales_for_won_deals.sql` - verificar se foi aplicado no banco
6. `supabase/migrations/20260721110000_rd_revenue_canonical_sync.sql` - verificar trigger trg_sync_rd_deal_to_canonical_sale
8. `supabase/migrations/20260920200000_prevent_zero_value_rd_sales.sql` - verificar trigger zz_prevent_zero_value_rd_sale

## Escopo da investigação (itens fora do escopo)
- FORA: correções visuais (paleta de cores, calendário, scroll)
- FORA: correções de polling/sincronização automática
- FORA: problemas de token Instagram
- DENTRO: somente o problema de contagem de vendas realizadas (7 vs 9)

## Critério de conclusão
Identificar a causa raiz exata de por que 7 em vez de 9 vendas são mostradas, com evidências de código ou banco de dados.
