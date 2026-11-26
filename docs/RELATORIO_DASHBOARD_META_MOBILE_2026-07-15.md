# Relatório de implementação — Dashboard, metas e mobile

Data: 15/07/2026

## Resultado entregue

- Meta mensal configurável por conta de anúncio/marca, unidade e mês.
- Barra de progresso no Dashboard alimentada pelo faturamento líquido atribuído no mês corrente.
- Separação por Infoproduto/SaaS e por conta selecionada.
- Faixa fixa em estilo glass com faturamento, investimento, leads, CPL, ROAS, previsão de 30 dias, saúde e vendas.
- A faixa pode ser minimizada somente no mobile e preserva a preferência no aparelho.
- Dashboard modular convertido para uma coluna natural em celular e tablet, sem depender do grid livre do desktop.
- Cabeçalho, filtros, seletores, modais e popovers limitados à largura disponível.
- Tabelas densas mantêm suas colunas e usam rolagem interna, sem criar rolagem horizontal na página.
- Safe areas inferiores e superiores consideradas em dispositivos Apple compatíveis.

## Fonte dos dados

- Meta: `sales_goals.target_revenue` por `workspace_id`, `business_unit_id`, `ad_account_id` e mês.
- Realizado: soma de `net_revenue` das vendas atribuídas à conta no mês corrente.
- Faixa glass: respeita unidade, conta, campanhas e período selecionados no Dashboard.
- Previsão 30 dias: faturamento líquido do período dividido pela quantidade de dias e normalizado para 30 dias; é previsão, não realizado.

Vendas sem `ad_account_id` não entram na meta de uma marca. Isso impede que uma venda não conciliada seja atribuída silenciosamente à conta errada.

## Segurança aplicada

- RLS habilitada em `sales_goals`.
- Leitura limitada a membros do workspace.
- Alteração limitada a owner, admin ou financial por `can_manage_finance`.
- Trigger valida que workspace, unidade e conta pertencem ao mesmo escopo.
- Valores precisam ser positivos; informar zero no formulário remove a meta daquele mês.
- Nenhum token, segredo, sincronização externa ou publicação foi adicionado ao cliente.

## Arquivos principais

- `src/components/dashboard/DashboardGoalProgress.tsx`
- `src/components/dashboard/DashboardGlassStrip.tsx`
- `src/components/settings/SalesGoalSettingsCard.tsx`
- `src/hooks/useSalesGoals.ts`
- `supabase/migrations/20260715020000_sales_goals_dashboard.sql`
- `docs/PROMPT_MASTER_DASHBOARD_META_MOBILE_2026-07-15.md`

## Ativação do banco

A migration é aditiva e foi criada localmente, mas não foi aplicada automaticamente a nenhum ambiente remoto. Antes de liberar o salvamento de metas em produção, aplicar:

`supabase/migrations/20260715020000_sales_goals_dashboard.sql`

Até a migration ser aplicada, o sistema permanece seguro: mostra a orientação de configuração, desabilita o salvamento e não inventa meta.

## Validação executada

- ESLint dos arquivos alterados: zero erros; permanecem apenas avisos não bloqueantes de hooks/fast refresh em componentes já existentes.
- Vitest: 6 arquivos e 12 testes aprovados.
- Build de produção: aprovado.
- Build HTML local: aprovado e pasta `html` regenerada.
- `git diff --check`: aprovado, sem espaços ou marcadores de conflito.
- O bundle principal ainda emite o aviso de tamanho acima de 500 kB; a redução por divisão de chunks está listada como melhoria de performance.

## Matriz responsiva adotada

- 320–639 px: uma coluna, controles em largura total, faixa glass minimizável.
- 640–1023 px: conteúdo empilhado e tabelas com rolagem interna; faixa expandida.
- 1024 px ou mais: dashboard editável em grid e faixa sempre expandida.
- Cabeçalho global usa duas linhas antes de 1024 px e uma linha no desktop.

## Próximas 10 melhorias recomendadas

1. Criar meta diária esperada e alerta automático de atraso de pacing por marca.
2. Exibir três cenários de fechamento mensal: conservador, base e otimista.
3. Criar fila de vendas sem atribuição para conciliar Meta, RD e faturamento.
4. Permitir metas complementares de leads, CPL, ROAS e novas assinaturas.
5. Adicionar testes visuais automáticos nas larguras 320, 360, 390, 430, 768, 1024 e 1440 px.
6. Aplicar virtualização e paginação em tabelas com milhares de campanhas ou leads.
7. Salvar preferências de widgets e densidade por usuário e por aparelho.
8. Implementar cache offline de leitura e fila de repetição para conexões móveis instáveis.
9. Criar orçamento de performance por rota com alerta de bundle, LCP e memória.
10. Transformar alertas da faixa glass em recomendações acionáveis com histórico e rollback.
