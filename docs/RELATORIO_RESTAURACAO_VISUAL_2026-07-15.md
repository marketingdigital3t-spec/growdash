# Relatório de restauração visual — Growdash

## Resultado

As 11 referências foram analisadas e mapeadas para as rotas existentes. A implementação preserva consultas reais, filtros globais, isolamento por unidade e estados vazios; nenhum valor fictício foi introduzido.

## Imagem por imagem

1. **Login** — restaurado em `src/pages/Auth.tsx`: composição preta/dourada, logo, Entrar/Cadastrar, email, senha, recuperação, CTA, Google e Apple. As ações usam Supabase Auth real.
2. **Financeiro / aportes** — restaurado em `src/components/finance/TrafficInvestmentPlanner.tsx`: matriz semanal por conta, total aportado, disponibilidade e resumo mensal.
3. **Financeiro / investimento em tráfego** — planejador mensal editável, divisão Meta × Google, CPL alvo e projeção automática de leads.
4. **Financeiro / DRE** — demonstrativo separado pela unidade global Infoproduto/SaaS, linhas de receita, mídia, impostos e despesas, além do resultado por conta.
5. **Funis de tráfego** — biblioteca com 6 objetivos, 10 playbooks por objetivo e etapas expandidas conectadas. A seleção salva somente rascunho.
6. **Análise de Funis / topo** — conta, funil, período, origem, campanha, estado, responsável e produto; saúde RD e sincronização real.
7. **Campanhas** — preservado o gerenciador já reconstruído, com hierarquia de campanhas, conjuntos e anúncios.
8. **Análise de Funis / painéis** — preservados os 8 KPIs e painéis de distribuição/avanço com dados do funil e período selecionados.
9. **Datas & Turmas** — restaurado o painel de 7 KPIs, busca, filtros, vazio e criação de turma; adicionada Agenda cronológica real.
10. **Relatório diário** — preservado como referência transversal na aba IA & Relatórios de Leads.
11. **Planos** — mantido como referência visual transversal; nenhuma mudança de preço foi feita nesta restauração.

## Banco e segurança

A migration aditiva `supabase/migrations/20260715010000_restore_visual_finance_planning.sql` cria:

- `traffic_investment_plans`;
- `traffic_investment_contributions`;
- chaves únicas, índices, checks, RLS e políticas por workspace;
- escrita financeira restrita pela função `can_manage_finance`;
- separação explícita entre planejado, aportado e gasto real.

A migration foi criada, mas não foi aplicada remotamente. Isso evita alterar o banco sem revisão do histórico divergente de migrations. Até ela ser aplicada, a interface informa que a persistência está pendente e não inventa dados.

## Validação executada

- `npm run build`: aprovado.
- `npm test`: 6 arquivos e 12 testes aprovados.
- ESLint direcionado aos arquivos alterados: aprovado.
- `npm run build:html`: aprovado; a versão local em `html/` foi atualizada.

## Próximas 10 melhorias recomendadas

1. **Motor de reconciliação financeira** — conciliar Meta, Google, RD, vendas e lançamentos com uma fila de divergências explicáveis.
2. **Orçamento autopilot com aprovação** — sugerir redistribuição diária e gerar rascunho, exigindo aprovação humana antes de alterar campanha.
3. **DRE por centro de custo** — permitir rateio de equipe, software e despesas compartilhadas entre marcas e unidades.
4. **Forecast probabilístico** — adicionar cenários P10/P50/P90 e intervalo de confiança, em vez de uma única projeção.
5. **Agenda operacional automática** — criar tarefas e alertas quando turma estiver próxima com ocupação abaixo da meta.
6. **Playbooks executáveis** — transformar cada funil escolhido em checklist, responsáveis, SLA, eventos e critérios de avanço.
7. **Qualidade de lead por coorte** — ligar campanha, anúncio e data de captação aos estágios RD, receita e tempo até conversão.
8. **Auditoria de alterações** — registrar antes/depois, autor, motivo e rollback para orçamento, status e configurações de campanha.
9. **Centro de saúde de integrações** — monitorar token, escopos, atraso de sincronização, cobertura de contas e última carga válida.
10. **Assistente operacional com franquia** — IA que prioriza anomalias, explica evidências e consome créditos por análise, sem ação destrutiva autônoma.

