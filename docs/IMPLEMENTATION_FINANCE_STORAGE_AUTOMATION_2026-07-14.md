# Growdash — implementação de Financeiro, Armazenamento e automações

Data: 14/07/2026

## Entregue no front

- Nova área lateral **Armazenamento** com quota por plano, arquivos, fontes, limites, upload privado, URL assinada, busca, filtro e exclusão com confirmação.
- Leitura separada de arquivos gerenciados e referências externas de avatar/criativos Meta, evitando cobrança falsa de quota.
- Financeiro reorganizado nas oito abas do produto anterior: DRE, Dashboard, Previsão, Por conta, Investimento em tráfego, Lançamentos, Cartões e Empresas.
- Previsão para 30, 60, 90 dias, semestre e 12 meses, com cenários base, otimista e pessimista e dois gráficos.
- Alternância opcional para simular 12% de taxa/imposto Meta sem modificar o gasto original sincronizado.
- Visão semanal e mensal de investimento, DRE, histórico de 12 meses e lançamentos manuais.
- Cartões/Open Finance e Empresas usam estado vazio honesto quando ainda não existe conector/cadastro.
- Orçamento por BM com criticidade, gasto médio, saldo, autonomia, último aporte, próxima recarga e atualização das consultas.
- Campanhas renderizadas em páginas de 50 para não tentar montar milhares de linhas simultaneamente.
- Presets personalizados de colunas/detalhamento salvos por usuário no workspace, com fallback local antes da migration.

## Fundação segura entregue no banco

A migration `20260714233000_storage_finance_automation_foundation.sql` adiciona:

- `workspace_files` e bucket privado `workspace-files`;
- quotas de 5 GB, 25 GB, 100 GB e 500 GB nos quatro planos;
- `companies`, `financial_accounts` e `financial_transactions`;
- `saved_table_views`;
- `campaign_drafts` e `campaign_change_snapshots`;
- `traffic_playbooks`;
- `meta_breakdown_insights` e `meta_video_insights`;
- `reconciliation_runs` e `reconciliation_items`;
- `budget_pacing_snapshots` e `budget_pacing_alerts`;
- índices, RLS, grants mínimos e proteção de paths inválidos do Storage.

## Ativação

As migrations existentes do ambiente estão com histórico remoto divergente. Portanto, elas **não foram enviadas automaticamente**. Antes de ativar uploads, presets em nuvem, empresas e Open Finance:

1. reconciliar a tabela `supabase_migrations.schema_migrations` com o repositório;
2. aplicar primeiro `20260714210000_workspace_billing_finance_foundation.sql`;
3. aplicar depois `20260714233000_storage_finance_automation_foundation.sql`;
4. regenerar os tipos Supabase;
5. executar os testes de RLS com dois usuários em workspaces diferentes.

Não use um `db push` em massa antes dessa reconciliação.

## O que ainda depende de serviço externo

- Breakdowns e métricas de vídeo: schema e UI estão preparados, mas a Edge Function de sync deve pedir os campos/breakdowns compatíveis na Graph API e fazer UPSERT nas novas tabelas.
- Draft/publicação/rollback: schema está pronto; a publicação real exige Edge Function, validação de permissão, diff e aprovação.
- Reconciliação Meta × RD × vendas: schema está pronto; o job de correspondência ainda precisa ser implementado com regras de UTM, external id, email/telefone normalizados e confiança.
- Pacing horário: BM funciona com o histórico atual; snapshots horários e alertas automáticos precisam de scheduler.
- Open Finance: a interface e o modelo estão prontos, mas é necessário contratar/configurar um provedor homologado e implementar OAuth/consentimento no backend.
- Paginação: o front já limita renderização a 50 campanhas; paginação realmente server-side de campanhas, conjuntos e anúncios requer endpoint/RPC paginado.

## Validação executada

- `npm run build`: aprovado.
- `npm run build:html`: aprovado; a pasta `html` foi atualizada.
- `npm test`: 12 de 12 testes aprovados.
- `npm run lint`: zero erros; permanecem 24 avisos anteriores do projeto.
- A inspeção por clique no navegador interno não ficou disponível nesta sessão; nenhuma validação visual foi declarada sem evidência.

## Próximas dez melhorias de automação

1. Fechamento financeiro automático mensal com checklist, travamento e reabertura auditada.
2. Categorização financeira assistida por IA com confiança e aprovação em lote.
3. Motor de anomalias que explique variações de CPL, ROAS, receita e caixa por causa provável.
4. Recomendador de redistribuição de orçamento com simulação antes/depois e limite por política.
5. Cobrança e renovação automática de clientes com dunning e controle de inadimplência.
6. Importador de notas fiscais e boletos com OCR, deduplicação e vínculo ao lançamento.
7. Previsão probabilística por Monte Carlo, sazonalidade e bandas de confiança.
8. Centro de aprovações único para campanhas, orçamento, automações e pagamentos.
9. Data lineage visual: clicar em qualquer KPI e seguir até API, registro e fórmula de origem.
10. Autopiloto supervisionado: executar somente ações de baixo risco dentro de políticas, com botão de pausa global e rollback.

