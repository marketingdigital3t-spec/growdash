# Growdash × Meta Ads Manager — arquitetura de réplica funcional

Data da revisão: 15/07/2026

## Objetivo

Reproduzir na Growdash o fluxo operacional do Ads Manager sem copiar a marca da Meta e sem prometer recursos que não sejam expostos pela Marketing API. A fonte da verdade para entrega, gasto, atribuição e ações continua sendo a Graph/Marketing API; a Growdash adiciona reconciliação com CRM, vendas, metas e inteligência.

Fontes primárias consultadas:

- Meta Marketing API — workspace oficial: https://www.postman.com/meta/facebook-marketing-api/overview
- Insights API — coleção oficial: https://www.postman.com/meta/facebook-marketing-api/folder/zzd6d5p/insights-api
- Campaigns: https://www.postman.com/meta/facebook-marketing-api/request/45f5yj7/getcampaignsdetails
- Ad sets: https://www.postman.com/meta/facebook-marketing-api/request/i3u5n9r/getadsetdetailsforaccount
- Ads: https://www.postman.com/meta/facebook-marketing-api/request/uisas2z/getadsfromaccountidwithfields

## Regra central da hierarquia

Os três níveis são independentes e sempre acessíveis:

1. Campanhas mostra todas as campanhas do escopo atual.
2. Conjuntos mostra todos os conjuntos quando nenhuma campanha está marcada.
3. Anúncios mostra todos os anúncios quando nenhuma campanha está marcada.
4. Uma ou mais campanhas marcadas filtram somente os níveis descendentes.
5. Trocar de conta limpa seleções antigas; seleções inexistentes são removidas após cada recarga.
6. As contagens respondem aos filtros ativos e ao escopo de seleção.

O frontend implementa isso em `src/lib/metaHierarchy.ts` e cobre o comportamento com testes unitários.

## Sincronização confiável

### Ordem

1. Sincronizar campanhas, conjuntos, anúncios e insights diários.
2. Persistir ações e métricas diárias.
3. Somente depois sincronizar o breakdown horário, que depende das linhas diárias para reconciliação.

Executar as duas funções em paralelo produz corrida de dados e dobra picos de consumo. A Growdash passou a executá-las sequencialmente.

### Erros

- HTTP 401 ou Meta `code=190`: token inválido/expirado; marcar conexão como expirada e orientar OAuth.
- HTTP 429, HTTP 5xx, Meta 1/2/4/17/32/613/80004 ou `is_transient`: retry exponencial com jitter.
- Erro de payload/permissão: não repetir cegamente; devolver mensagem, status, código e subcódigo.
- Nunca registrar URL completa, token ou corpo contendo credenciais.
- Um erro no relatório horário não invalida uma sincronização diária concluída.
- Breakdowns pesados não são executados em todo refresh; somente quando solicitados.

### Versão da API

Todas as funções usam `META_GRAPH_API_VERSION`, com fallback único. Antes de trocar a versão em produção, executar o conjunto de testes de contrato em uma conta de teste e revisar o changelog oficial da Meta.

## Modelo mínimo de dados

- `ad_accounts`: conta, proprietário, status da conexão e diagnóstico da última sincronização.
- `campaigns`: ID Meta, conta, nome, objetivo, status e datas.
- `adsets`: ID Meta, campanha, nome, status, orçamento e destino.
- `ads`: ID Meta, conjunto, nome, status, creative ID e miniatura.
- `insights`: uma linha por anúncio/data com gasto, impressão, alcance, clique, CTR, CPM, frequência, leads e CPL.
- `insight_actions`: uma linha por anúncio/data/action_type; evita somar eventos incompatíveis.
- `insights_hourly`: anúncio/data/hora para pacing e melhor horário.
- `insights_breakdowns`: campanha/data/tipo/segmento para idade, gênero, plataforma, posicionamento e região.
- `campaign_changes`: auditoria de alterações locais e atividades recebidas da Meta.

Chaves externas devem preservar a árvore conta → campanha → conjunto → anúncio. Upserts usam o ID da Meta como chave idempotente.

## Métricas e fórmulas

- Investimento: `spend` retornado pela Meta.
- Impressões: `impressions`.
- Alcance: `reach`; não somar alcance diário para representar alcance único de um período sem avisar que é direcional.
- Frequência: `impressions / reach` quando os dois pertencem ao mesmo nível/período.
- CTR: preferir o CTR retornado pela API para a mesma consulta; quando recalculado, `clicks / impressions × 100`.
- CPM: `spend / impressions × 1000`.
- CPC: `spend / clicks`.
- Resultado: depende do objetivo e do `action_type` configurado.
- CPL: `spend / leads`.
- ROAS da plataforma: receita reconciliada / gasto; deve ser rotulado separadamente do ROAS atribuído pela Meta.

Para leads, a Growdash mantém `onsite_conversion.lead_grouped` para formulário nativo e permite um evento de landing page configurado por conta. Não se deve somar genericamente `lead`, pixel lead e lead nativo, pois isso duplica conversões.

## Atribuição e fuso

Para comparar com o Ads Manager, conta, período, fuso da conta, janela de atribuição, nível, filtros, breakdown e `action_type` precisam ser idênticos. A sincronização usa a configuração unificada de atribuição do conjunto e mantém a janela explícita onde suportada. A interface deve exibir a janela usada no relatório.

## Interface operacional

### Cabeçalho

- conta de anúncio;
- período;
- última sincronização bem-sucedida;
- botão Sincronizar com estado de progresso;
- diagnóstico de token/rate limit e ação Reconectar.

### Filtros

- busca por nome ou ID;
- status de entrega;
- tiveram veiculação;
- objetivo;
- saúde;
- filtros salvos por usuário.

### Tabela

- cabeçalho e totalizadores fixos;
- colunas redimensionáveis;
- presets Desempenho, Tráfego, Engajamento, Vídeo, Conversões e Personalizado;
- ordenação sem alterar a soma;
- paginação/virtualização para milhares de linhas;
- cards no mobile, evitando tabela comprimida;
- drawer de detalhe com histórico, diagnóstico e recomendações.

### Alterações

Ativar, pausar, renomear e alterar orçamento passam por backend autenticado, autorização por conta e auditoria. Para alteração otimista, guardar snapshot, exibir estado pendente e reverter se a API recusar. Alterações em massa devem entrar em rascunho, oferecer revisão e exigir confirmação antes do envio.

## Insights em escala

Consultas pequenas podem ser síncronas. Períodos longos, muitas contas, breakdowns ou grande volume devem usar jobs assíncronos da Insights API, polling com backoff e persistência de cursor/estado. O agendador deve distribuir contas em filas para evitar rajadas.

Cadência sugerida:

- hoje: a cada 10–15 minutos para contas ativas;
- ontem: reprocessar algumas vezes por atraso de atribuição;
- últimos 7 dias: reconciliação diária;
- histórico antigo: sob demanda ou backfill controlado.

## Segurança

- tokens somente no backend e protegidos por RLS/colunas não selecionáveis pelo cliente;
- OAuth com `state` de uso único, redirect URI exata e sessão validada;
- permissões mínimas (`ads_read` para leitura; permissões de gestão somente quando edição for oferecida);
- autorização por workspace e conta em toda mutation;
- rate limit por usuário/conta;
- logs sem segredo;
- trilha de auditoria e rollback local;
- conta de teste separada para criação/edição.

## Limites da réplica

A Growdash pode reproduzir a navegação, leitura, filtros, presets, edição permitida e análises, mas não deve alegar equivalência absoluta com recursos internos da interface Meta que não estejam publicados na API. Opportunity Score, recomendações internas, alguns diagnósticos, experiências em rollout e certas operações criativas podem exigir endpoints/permissões específicos ou não estar disponíveis.

## Fases restantes

1. Contagens server-side (`count: exact`) para bases acima do limite de resposta.
2. Virtualização dos níveis conjunto/anúncio.
3. Jobs assíncronos para breakdowns e períodos longos.
4. Presets de colunas persistidos por usuário/workspace.
5. Rascunhos, revisão em massa e rollback.
6. Reconciliação Meta × RD × vendas com painel de divergências.
7. Testes de contrato por versão da Graph API.
8. Monitoramento de uso, rate limit, latência e cobertura por conta.
