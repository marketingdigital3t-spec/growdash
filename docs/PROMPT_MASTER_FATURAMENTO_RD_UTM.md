# Prompt master — faturamento canônico RD Station + atribuição UTM na Growdash

Você é um engenheiro sênior full-stack e de dados responsável por implementar e validar o faturamento canônico da Growdash. Trabalhe no código existente, preserve funcionalidades válidas e não crie fontes paralelas de receita.

## Objetivo obrigatório

Toda negociação marcada como **ganha** no RD Station deve gerar ou atualizar exatamente uma venda confirmada na Growdash. Essa venda será a fonte única de faturamento para Dashboard, Tráfego Pago, Comercial, CRM, Financeiro, Análise de Funis, Relatórios, Marcas e Agentes.

Quando existirem UTMs capazes de identificar uma campanha Meta Ads da mesma conta, o faturamento deve aparecer também nessa campanha. Sem correspondência exata e segura, a receita continua existindo na conta, mas permanece “não atribuída”; nunca invente uma campanha.

## Contrato único de dados

- `rd_deals`: estado operacional do pipeline, etapas, responsáveis, negócios abertos, ganhos, perdidos e pausados.
- `sales` com `status = 'confirmed'`: única fonte de faturamento realizado e quantidade de vendas.
- `insights`: métricas de mídia paga, nunca faturamento.
- `financial_entries`: lançamentos financeiros manuais e despesas; não duplicar automaticamente uma venda RD já materializada em `sales`.
- Valores abertos do RD são **receita potencial**, nunca faturamento realizado.
- Registros pendentes, cancelados, perdidos ou reabertos não entram no faturamento.

## Regras de sincronização RD → venda

1. Use `rd_deal_id` como chave idempotente. Uma negociação RD pode produzir no máximo uma linha em `sales`.
2. Ao ganhar, faça upsert da venda com `status = 'confirmed'`.
3. Ao perder, reabrir ou remover a negociação, marque a venda automática correspondente como `cancelled`; preserve a trilha de auditoria.
4. O valor bruto vem de `amount_total`. Calcule imposto e valor líquido apenas uma vez, conforme o produto vinculado.
5. A data da venda deve obedecer à prioridade: `closed_at`, `stage_updated_at`, `lead_created_at`, `updated_at`. Converter para o fuso da operação (`America/Sao_Paulo` como fallback), sem deslocar o dia.
6. Grave a proveniência: `source_provider = 'rd_station'`, `source_record_id`, `source_closed_at`, confiança e motivo da atribuição.
7. Preserve alterações manuais de produto, pagamento e campanha quando `manual_override = true`.
8. O backfill histórico e as sincronizações incrementais devem executar a mesma rotina de materialização. Não pode existir caminho “rápido” que grave `rd_deals` e ignore `sales`.
9. Paginar até o fim respeitando `next_page`, limite de 200 por página e limite oficial de 10.000 resultados por consulta. Particionar períodos quando necessário.
10. Isolar rigorosamente por usuário, workspace, marca/conta e funil. Nenhum registro pode vazar entre contas.

## Atribuição de faturamento à campanha

Aplicar esta prioridade:

1. Override manual persistido.
2. `matched_campaign_id` já validado.
3. UTM com ID exato da campanha da mesma `ad_account_id`.
4. UTM com nome exato normalizado da campanha da mesma `ad_account_id`.
5. Sem correspondência: venda não atribuída.

Comparar `utm_campaign`, first touch e last touch quando disponíveis. Normalizar apenas acentos, caixa, espaços e pontuação. Não usar busca parcial, similaridade fuzzy ou fallback para outra conta. Persistir `campaign_ids`, `matched_campaign_id`, `match_method`, `attribution_confidence` e `attribution_reason`.

## Consumo obrigatório por módulo

- **Dashboard:** faturamento líquido, lucro, margem, ticket, vendas, ROAS e gráficos usam somente vendas confirmadas dentro da conta e período selecionados.
- **Tráfego Pago:** receita, vendas e ROAS da campanha usam somente vendas confirmadas atribuídas de forma exata. Investimento e demais métricas continuam vindo dos insights Meta.
- **Comercial:** realizado usa `sales`; pipeline aberto e previsão continuam vindo de `rd_deals`, com rótulos distintos.
- **CRM:** kanban e etapas usam `rd_deals`; receita ganha usa `sales`, restrita aos negócios visíveis e à conta selecionada.
- **Financeiro:** receita, DRE, por conta, previsão e investimento usam a mesma venda canônica. Não contar pendentes como receita realizada.
- **Análise de Funis:** volume e etapas vêm do snapshot RD; conversões, receita, ticket e distribuições monetárias são reconciliados com `sales` pelos mesmos filtros de conta, funil, período, origem, campanha, estado e produto.
- **Relatório de leads, Marcas e Agentes:** vendas e receita devem usar o mesmo agregador canônico; nunca reduzir `amount_total` dos negócios ganhos diretamente.

## Estados de interface

- Sem dados: exibir todos os blocos com zero e mensagem objetiva.
- Carregando: skeleton sem números antigos misturados.
- Erro: mensagem com conta, período, provider e ação de tentar novamente.
- Dado desatualizado: mostrar horário da última sincronização, mantendo o último snapshot válido enquanto atualiza em segundo plano.

## Segurança e observabilidade

- Tokens RD devem permanecer no backend/Vault; nunca no frontend, banco público, URL ou log.
- Edge Functions usam service role somente no servidor e validam o usuário/conta autorizados.
- Aplicar RLS nas tabelas consumidas pelo frontend.
- Registrar início, fim, duração, páginas, registros recebidos, criados, atualizados, cancelados e erros por conta.
- Alertar para token expirado, escopo removido, limite de API, paginação truncada e divergência de reconciliação.

## Critérios de aceite sem margem para ambiguidade

Para cada conta e período testados:

1. `vendas Growdash = negócios RD ganhos no período de fechamento`.
2. `faturamento bruto Growdash = soma de amount_total desses negócios`.
3. Cada `rd_deal_id` aparece no máximo uma vez em `sales`.
4. Negociação perdida ou reaberta não entra no realizado.
5. Dashboard, Comercial, CRM, Financeiro, Funis e Relatórios exibem exatamente o mesmo total quando os filtros são equivalentes.
6. Soma do faturamento atribuído por campanha + faturamento não atribuído = faturamento total da conta.
7. Nenhuma venda é atribuída a campanha de outra conta.
8. Reexecutar a sincronização não altera os totais nem cria duplicatas.
9. Datas de fechamento próximas da meia-noite permanecem no dia correto do fuso da conta.
10. Histórico completo e incremental produzem o mesmo resultado final.

## Consultas de reconciliação

Entregar uma tela e logs capazes de comparar, por conta e período:

- total de negócios RD, abertos, ganhos, perdidos e pausados;
- soma bruta dos negócios ganhos;
- vendas confirmadas, canceladas e não atribuídas;
- receita atribuída por campanha;
- negócios ganhos sem venda canônica;
- vendas canônicas sem negócio RD;
- duplicidades de `rd_deal_id`;
- diferença absoluta e percentual RD × Growdash.

Bloquear a indicação “sincronizado” quando existir truncamento, erro de página ou divergência não explicada.

## Ordem segura de entrega

1. Criar migration reversível e índices.
2. Materializar o histórico em ambiente de teste.
3. Executar reconciliação por conta e período.
4. Atualizar Edge Function e validar idempotência.
5. Trocar cada consumidor de tela pela fonte canônica.
6. Executar testes unitários, integração, build e cenários de fuso/UTM.
7. Publicar migration, função e frontend nessa ordem.
8. Monitorar primeira sincronização e manter rollback disponível.

Não conclua enquanto houver cálculo paralelo de faturamento, atribuição fuzzy, mistura de contas, duplicação ou divergência silenciosa.
