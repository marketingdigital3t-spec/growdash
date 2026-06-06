## Problema

1. **Aportes não aparecem** — a tabela `account_transactions` está vazia (`total = 0`). A função `sync-meta-transactions` existe mas nunca foi disparada com sucesso, e o parse de `amount` está incorreto (divide por 100 mesmo quando a Meta já devolve em reais, ex.: `"2400.00"` viraria `R$ 24,00`).
2. **Saldo final "—"** — o cálculo depende de `account_balance_events` anterior ao período. Se não existir registro prévio, o saldo final fica vazio. Não usamos o `remaining_balance` atual da conta (que já é confiável e vem do Meta) como âncora.
3. **Título errado** — "Análise de Orçamento por BM" em dois lugares (`BudgetAnalysis.tsx` e `Alerts.tsx`). O termo correto é **Conta**.

## O que vou fazer

### 1. Corrigir e ativar o sync real do Meta (`sync-meta-transactions`)

- **Parse de `amount` correto**: a Meta retorna `amount: { currency, total, total_cents }` onde `total` já é string em reais (ex.: `"2400.00"`). Trocar a heurística atual por: usar `total_cents/100` quando presente, senão `Number(total)` direto.
- **Campos extras**: incluir `provider_amount`, `vat` e melhor mapeamento de `payment_option` (ex.: `prepay` → "Saldo pré-pago", `manual` → "Pagamento manual", `card`/`auto`/`credit_card` → "Cartão"). Manter status da Meta (`paid`, `with_funds`, etc).
- **Disparo automático**: invocar `sync-meta-transactions` quando o `BudgetDetailSheet` abre, mostrando um pequeno loader "Buscando aportes do Meta…". O cron diário continua, mas o usuário não precisa esperar.
- **Botão "Sincronizar"** no header do sheet para forçar refetch sob demanda.
- **Pular registros manuais** ao re-sincronizar (`id` que começa com `manual_`) usando `onConflict: id` no upsert.

### 2. Corrigir cálculo do saldo final

- Usar o **`remaining_balance` atual** de `ad_accounts` como âncora confiável (Meta diz hoje você tem X).
- **Reconstruir o período de trás para frente**: `balance(D) = balance(D+1) − topUps(D+1) + spend(D+1)`, ancorado no `remaining_balance` do dia de hoje.
- Resultado: **Saldo final** do período passa a ser sempre preenchido (mesmo sem `account_balance_events` prévios), e **opening balance** vira derivado, não obrigatório.
- Mostrar o **Saldo restante atual** (da Meta) como um quarto card no resumo do sheet, para o usuário comparar com o "Saldo final do período".

### 3. Renomear "BM" → "Conta"

- `src/components/dashboard/BudgetAnalysis.tsx`: "Análise de Orçamento por BM" → **"Análise de Orçamento por Conta"**
- `src/pages/Alerts.tsx`: idem
- `src/components/dashboard/grid/DashboardGrid.tsx`: título do widget já é "Análise de Orçamento" (ok)
- `src/lib/widgetCatalog.ts`: "Análise de Orçamento (BM)" → **"Análise de Orçamento (Conta)"**
- No texto interno dos cards (ex.: `BM "[Curso] Carla Rezende" com orçamento saudável.`) → trocar `BM` por `Conta`.

### Arquivos afetados

```text
supabase/functions/sync-meta-transactions/index.ts   (fix amount + mapping)
src/hooks/useBudgetHistory.ts                        (anchor em remaining_balance)
src/components/dashboard/BudgetDetailSheet.tsx       (auto-sync + botão + 4º card)
src/components/dashboard/BudgetAnalysis.tsx          (rename BM→Conta)
src/pages/Alerts.tsx                                 (rename)
src/lib/widgetCatalog.ts                             (rename)
```

### Detalhes técnicos

- A função `sync-meta-transactions` já chama `GET /act_{id}/transactions?fields=id,time,billing_reason,payment_option,status,amount,vat,provider_amount,billing_period&since=<180d>&limit=200`. Vou manter a paginação e adicionar log de quantas transações vieram por conta para facilitar debug.
- A invocação client-side será via `supabase.functions.invoke("sync-meta-transactions")` dentro do `useEffect` do sheet quando `open && accountId` mudarem, com `await` e `queryClient.invalidateQueries(["budget_history"])` ao terminar.
- A âncora do saldo no `useBudgetHistory` puxa `remaining_balance` de `ad_accounts` na mesma query inicial.
- Não vou mexer em RLS nem em outras tabelas — só lógica.
