# SDD ledger — plan: .superpowers/sdd/investigacao-vendas-2026-11-18/plano.md

Task 1: Revisar useRDDealsForPeriod.ts — filtro de vendas por closed_at
Task 2: Revisar CrmPage.tsx — como vendas são filtradas e exibidas
Task 3: Revisar crmBoardDateScope.ts — dealBelongsToBoardPeriod
Task 4: Revisar canonicalMetrics.ts — canonicalWonDealsInPeriod
Task 5: Verificar se migration 20261117150000 foi aplicada no banco
Task 6: Verificar trigger trg_sync_rd_deal_to_canonical_sale no banco
Task 7: Verificar trigger zz_prevent_zero_value_rd_sale no banco
Task 8: Identificar causa raiz e documentar
