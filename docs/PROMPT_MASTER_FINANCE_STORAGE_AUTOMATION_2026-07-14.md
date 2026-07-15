# PROMPT MASTER — Growdash Financeiro, Armazenamento e Automação Operacional

Você é um arquiteto de software e engenheiro full-stack sênior especializado em SaaS multiempresa, Supabase/PostgreSQL, React/TypeScript, Meta Marketing API, RD Station, Open Finance, segurança, observabilidade e UX de produtos financeiros. Trabalhe no projeto Growdash existente. Preserve os módulos funcionais e a identidade visual premium preta/dourada; não reescreva o produto do zero.

## Objetivo

Construir uma central operacional confiável que consolide mídia paga, vendas, CRM, financeiro, arquivos e automações por workspace, unidade de negócio, marca e conta de anúncio. O usuário deve entender de onde veio cada número, controlar custos e armazenamento, prever caixa e executar otimizações com segurança.

## Regras inegociáveis

1. Não usar mocks, totais inventados, datas fixas, números hardcoded nem somar entidades incompatíveis.
2. Toda linha de dados deve conter `workspace_id`; quando aplicável também `business_unit_id`, `company_id`, `ad_account_id`, `source`, `external_id`, `occurred_at`, `synced_at` e metadados de rastreabilidade.
3. Aplicar RLS em todas as tabelas. Usuários só leem workspaces dos quais são membros. Escritas sensíveis exigem papel owner/admin ou `service_role`.
4. Tokens nunca vão para o navegador, logs ou tabelas públicas. Guardar credenciais criptografadas no backend e usar Edge Functions para APIs externas.
5. Toda mutação no Meta Ads nasce como rascunho, exibe o diff, exige confirmação e gera snapshot de auditoria. Nunca executar exclusão, publicação ou aumento de orçamento silenciosamente.
6. Identidade única: usar chaves compostas com workspace, fonte, conta, nível, entidade, data, breakdown e attribution window. Fazer UPSERT idempotente para impedir duplicação.
7. Métricas monetárias usam `numeric`, nunca float. Datas são armazenadas em UTC e exibidas no fuso da conta/workspace. Informar a moeda da conta.
8. Falhas parciais devem aparecer no produto com fonte, horário, erro sanitizado e ação de recuperação. Nunca substituir falha por zero.
9. Implementações de banco devem ser migrations aditivas e idempotentes. Não apagar tabelas existentes nem executar push de histórico divergente sem reconciliação.
10. Desktop, tablet e mobile devem funcionar. Tabelas extensas viram cards ou têm scroll controlado, cabeçalho fixo e virtualização.

## 1. Armazenamento unificado

Criar o módulo lateral **Armazenamento** e uma tabela-registro `workspace_files` que seja o catálogo único de arquivos e referências da plataforma.

### Modelo mínimo

- `workspace_files`: workspace, unidade, proprietário, bucket, object path, nome original, MIME, bytes, checksum, módulo, tipo/id da entidade, fonte, status, metadados, datas.
- Bucket privado `workspace-files`; caminho obrigatório: `{workspace_id}/{business_unit_id}/{module}/{uuid}-{safe_name}`.
- Fontes: upload, avatar, criativo Meta, documento financeiro, automação, CRM, relatório e importação.
- Arquivos externos devem ser catalogados como referência, sem copiar automaticamente mídia protegida ou expirada.
- Entitlements dos planos em bytes: Starter 5 GB, Growth 25 GB, Scale 100 GB e Agency 500 GB. Permitir configuração futura.

### Interface

- Cards: espaço usado, limite, arquivos gerenciados, referências externas, maior fonte e crescimento em 30 dias.
- Abas: Visão geral, Arquivos, Fontes e Limites.
- Busca, filtros por módulo/fonte/tipo, ordenação, paginação, upload com progresso, download por URL assinada e exclusão com confirmação.
- Mostrar quota com 70%, 85% e 100%; bloquear novos uploads no limite sem apagar nada.
- Varredura/migração assistida para avatar, anexos, criativos, relatórios e documentos já existentes.
- Toda remoção precisa de soft-delete, lixeira e expiração configurável.

## 2. Financeiro premium

Restaurar a página Financeiro com oito abas nesta ordem:

1. **DRE**: receita bruta, deduções, receita líquida, custo de mídia, imposto/taxa Meta configurável, custos variáveis, despesas fixas, EBITDA gerencial, resultado e margem. Permitir caixa/competência.
2. **Dashboard**: KPIs de receita, despesa, lucro, margem, cartões e tráfego; evolução mensal; caixa; despesas por categoria; receita por fonte; contas a pagar/receber.
3. **Previsão**: usar os últimos 12 meses completos. Calcular tendência + média móvel e cenários base, otimista e pessimista para 30, 60, 90 dias, semestre e 12 meses. Mostrar premissas editáveis e intervalo de confiança, não promessa.
4. **Por conta**: investimento, receita atribuída, leads, vendas, CPL, CAC/CPA, ROAS, lucro e margem por conta de anúncio; reconciliação e data da última sincronização.
5. **Investimento em tráfego**: semana a semana, mês a mês, por plataforma, empresa e conta. Alternância para incluir/excluir imposto da Meta sem alterar a fonte original.
6. **Lançamentos**: lançamento manual de receita/despesa, categoria, competência, vencimento, status, recorrência, centro de custo, anexos, conciliação e trilha de auditoria.
7. **Cartões**: preparar Open Finance com consentimento, contas e cartões, saldo, fatura, transações, categorização automática e correspondência com lançamentos. Sem credencial bancária no frontend.
8. **Empresas**: marcas/experts vinculados às unidades, contas de anúncio, CRM, centro de custo, resultado e responsáveis. Deve usar a mesma fonte do módulo Marcas.

### Fórmulas

- Receita total = vendas líquidas confirmadas + outras receitas válidas.
- Despesa total = mídia ajustada + lançamentos de despesa não cancelados.
- Lucro = receita total − despesa total.
- Margem = lucro / receita, somente quando receita > 0.
- ROAS = receita atribuída / mídia, somente quando mídia > 0.
- Caixa acumulado = soma cronológica de entradas − saídas pagas/recebidas.
- Previsão base deve ponderar média móvel, sazonalidade mensal e tendência linear; mostrar a fórmula e permitir desativar outliers.

## 3. Orçamento por BM/conta

Na aba **Tráfego Pago > Orçamento (BM)** reproduzir e superar o painel de referência:

- Card por conta com criticidade, orçamento diário ativo, gasto médio/dia, saldo restante, dias de autonomia, próxima recarga estimada, último aporte e narrativa objetiva.
- Critérios: crítico quando sem saldo ou autonomia ≤ 2 dias; atenção de 3 a 5 dias ou pacing fora da banda; saudável acima de 5 dias e pacing normal.
- Pacing horário compara gasto real versus gasto esperado no fuso da conta, considerando hora do dia, dias da semana e orçamento ativo.
- Alertas deduplicados com cooldown e canais configuráveis. Nenhum aumento/pausa automática sem política explicitamente ativada e aprovação.
- Histórico de aportes e projeção de saldo em gráfico.

## 4. Dez evoluções de tráfego

1. **Breakdowns reais**: sincronizar country, region, age, gender, device/platform, publisher_platform, placement e hourly stats, respeitando combinações permitidas pela Graph API.
2. **Vídeo/ThruPlay**: armazenar video plays, 3s, 25/50/75/95/100%, average time, ThruPlay e custo por ThruPlay por anúncio/data.
3. **Presets personalizados**: salvar colunas, ordem, largura, filtros, breakdowns, attribution window e ordenação por usuário/escopo. Ter privado e compartilhado.
4. **Rascunhos seguros**: criar/duplicar/editar campanhas em draft, validar orçamento, objetivo, datas, permissões e público; publicar apenas após review.
5. **Histórico/rollback**: guardar before/after, autor, motivo, request id e resposta Meta. Rollback também é uma nova alteração auditada.
6. **Reconciliação Meta × RD × vendas**: relacionar lead/ad/campaign/UTM/CRM/sale, classificar matched, probable, unmatched e conflict; nunca forçar vínculo ambíguo.
7. **Playbooks de funil**: transformar modelos em checklist executável, metas, métricas, gatilhos, tarefas, responsáveis e status, sem criar campanhas automaticamente por padrão.
8. **Pacing horário**: snapshots horários, desvio versus esperado, previsão de estouro/subentrega e alertas por prioridade.
9. **Comparação lado a lado**: até quatro campanhas, contas ou períodos, normalizando moeda, fuso e janela de atribuição e destacando variação absoluta/percentual.
10. **Escala**: paginação server-side, filtros no banco, índices, cache, React Query e virtualização de linhas para milhares de anúncios.

## 5. Arquitetura de dados complementar

Criar de forma aditiva: `companies`, `financial_accounts`, `financial_transactions`, `saved_table_views`, `campaign_drafts`, `campaign_change_snapshots`, `traffic_playbooks`, `meta_breakdown_insights`, `meta_video_insights`, `reconciliation_runs`, `reconciliation_items`, `budget_pacing_snapshots` e `budget_pacing_alerts`.

Para cada tabela:

- PK UUID, FKs, timestamps, índices de leitura e unicidades idempotentes.
- RLS, grants mínimos e policies baseadas em membro/papel.
- `metadata jsonb` apenas para extensibilidade; métricas essenciais devem ser colunas tipadas.
- `created_by`, `updated_by` ou `actor_id` nas operações humanas.

## 6. Integrações e jobs

- Edge Functions separadas para ingestão Meta, RD, vendas, Open Finance, reconciliação, forecast e armazenamento.
- Jobs incrementais por cursor e janela de reprocessamento dos últimos 7 dias para absorver atribuição tardia.
- Lock por workspace/conta/job; backoff exponencial; controle de rate limit; dead-letter e reprocessamento manual.
- Salvar `sync_run` com início, fim, registros lidos/upsertados, API version, conta, período e erro sanitizado.
- Para “tempo real”, webhook quando suportado e polling adaptativo; sempre mostrar `última atualização`.

## 7. UX e estados

- Tema claro e escuro usam os mesmos tokens sem cores hardcoded.
- Loading com skeleton, vazio explicativo, erro recuperável, parcial com aviso e sucesso.
- Tooltip de cada KPI mostra fórmula, fonte, janela, fuso e última atualização.
- Filtros globais de unidade, empresa, conta e período devem afetar todas as abas sem misturar contextos.
- No mobile, KPIs em uma coluna, abas roláveis, gráficos legíveis e tabelas em cards.

## 8. Segurança e conformidade

- Validar MIME, extensão, tamanho e checksum de upload; nomes sanitizados; antivírus assíncrono preparado.
- URLs privadas assinadas e curtas; nenhuma listagem pública do bucket.
- Auditoria append-only para ações sensíveis.
- Rate limit, CSRF/state no OAuth, idempotency keys e validação Zod no servidor.
- LGPD: finalidade, consentimento, retenção, exportação e exclusão por workspace sem apagar registros legais antes do prazo.

## 9. Testes obrigatórios

- Unitários para fórmulas de DRE, margem, ROAS, forecast, quota, pacing e reconciliação.
- Integração para RLS entre dois workspaces, upload/download/delete, UPSERT sem duplicar e mutação de campanha em draft.
- E2E desktop 1440 px, tablet 768 px e mobile 390 px para as oito abas, armazenamento e BM.
- Testar vazio, dados parciais, fuso de Brasília versus conta, moeda divergente, API rate limited, token expirado e tabela ainda não migrada.
- Build, lint e testes devem terminar sem erro. Não mascarar teste quebrado.

## 10. Critérios de aceite

- Nenhuma métrica mistura contas/workspaces.
- Todo KPI tem fonte e fórmula identificáveis.
- Financeiro contém as oito abas e previsões de cinco horizontes com gráficos.
- Armazenamento mostra quota real e centraliza novos arquivos; referências legadas aparecem separadamente.
- BM mostra autonomia, última recarga e próxima estimativa por conta.
- Presets, drafts, snapshots, playbooks, reconciliação, pacing, breakdowns e vídeo têm schema seguro e UI preparada.
- Funcionalidades sem credencial externa mostram “Configuração necessária”, nunca números falsos.
- Entregar migration, implementação, testes, documentação de ativação e lista exata do que ainda depende de Meta/RD/Open Finance.

## Ordem de execução

1. Mapear tabelas e integrações existentes; preservar compatibilidade.
2. Criar migration aditiva e testes de RLS.
3. Implementar armazenamento e quota.
4. Implementar Financeiro e fórmulas.
5. Implementar BM e pacing.
6. Implementar as dez evoluções em pequenos incrementos verificáveis.
7. Validar responsividade, build, segurança e observabilidade.
8. Só então habilitar recursos externos, um conector por vez, usando ambiente de teste e aprovação explícita.

