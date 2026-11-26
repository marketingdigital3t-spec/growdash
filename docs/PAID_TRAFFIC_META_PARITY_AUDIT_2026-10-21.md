# Auditoria de tráfego pago — paridade Growdash × Meta Ads Manager

Data: 21/10/2026  
Escopo: `/campanhas`, abas Campanhas / Conjuntos de anúncios / Anúncios, resultados, período, colunas, filtros e rolagem.

## Limite da evidência

Foi realizada uma inspeção funcional da conta autenticada no Ads Manager da Meta e uma auditoria estática/automática da implementação da Growdash. A Meta exibiu as três hierarquias, período com presets e calendário, menu de colunas, resultados por objetivo, custo por resultado e rolagem vertical/horizontal. A sessão observada foi a conta `act_1872139953321002`, em São Paulo, com o período de 21–22/10/2026 (hoje).

Isso não autoriza declarar equivalência de 100%: ações de publicação, edição em massa, arquivamento, exclusão, comparação completa de atribuição e permissões dependem de integração Graph autorizada e não podem ser simuladas com segurança no frontend.

## Comportamento de referência observado na Meta

- Hierarquia: Campanhas → Conjuntos de anúncios → Anúncios, preservando o escopo ao trocar de aba.
- Período: Hoje, Ontem, Hoje e ontem, últimos 7/14/28/30 dias, esta semana, semana passada, este mês, mês passado, máximo e personalizado; calendário mensal, comparação e fuso de São Paulo.
- Colunas: tráfego, desempenho/cliques, desempenho, engajamento, veiculação e configuração; personalização, redefinição de largura e formatação condicional.
- Resultados: a coluna é determinada pelo objetivo/otimização da campanha. Exemplos observados: Leads no site, Conversa por mensagem iniciada, Lead (formulário) e Engajamento com o post.
- Totais: a Meta apresenta o total de campanhas do escopo e o custo por resultado correspondente ao mesmo evento da coluna Resultados.
- Rolagem: tabela com rolagem horizontal e vertical, mantendo a hierarquia/nome acessível durante a leitura.

## Achados

| ID | Severidade | Área | Tema | Descrição | Evidência | Correção |
| --- | --- | --- | --- | --- | --- | --- |
| PAID-001 | CRÍTICO | Resultados | funcional | O resultado principal era escolhido pelo maior volume entre leads e conversas, em vez do resultado oficial da Meta. Uma campanha de leads podia aparecer como conversas. | `src/lib/campaignResultEvents.ts` | Resultado oficial persistido e depois objetivo/otimização; fallback somente para dados legados sem objetivo. Corrigido. |
| PAID-002 | ALTO | Campanhas | dados | `insights.result_type/result_value` já existiam no banco, mas não eram usados na tabela principal. | `src/pages/Campaigns.tsx` consulta e agregação de insights | Consulta e agregação passaram a carregar e selecionar o tipo compatível. Corrigido. |
| PAID-003 | ALTO | Conjuntos | resultados | A aba de conjuntos agregava fatos de Insights, mas não compunha as ações canônicas dos anúncios descendentes. | `selectedAdsets` em `Campaigns.tsx` | Ações por anúncio são agregadas e passam pelo mesmo resolver canônico. Corrigido. |
| PAID-004 | ALTO | Anúncios | resultados | A aba de anúncios não usava `result_type/result_value` oficial por anúncio. | `selectedAds` em `Campaigns.tsx` | Resultado oficial do snapshot passou a ter prioridade. Corrigido. |
| PAID-005 | MÉDIO | Toolbar | funcional/feedback | `Ações` não tinha handler nem menu. | `Campaigns.tsx`, toolbar superior | Permanece pendente até existir contrato Graph seguro para ações em massa. Não foi criado botão falso. |
| PAID-006 | MÉDIO | Toolbar | funcional/feedback | `Ver mais` não tinha comportamento. | `Campaigns.tsx`, filtros de escopo | Pendente: precisa definir quais filtros adicionais são suportados pelo contrato da plataforma. |
| PAID-007 | MÉDIO | Header | funcional/feedback | `Mais opções` não tinha menu. | `Campaigns.tsx`, header | Pendente: ações destrutivas/publicação exigem backend, permissão e confirmação. |
| PAID-008 | BAIXO | Header | feedback | Pontuação de oportunidade era visual, sem detalhe acessível. | `Campaigns.tsx`, header | Pendente: falta contrato de explicação da pontuação. |
| PAID-009 | MÉDIO | Paginação/scroll | UX | Growdash usa página de 50 itens; Meta usa tabela com rolagem contínua no escopo observado. | `CAMPAIGN_PAGE_SIZE` e tabela em `Campaigns.tsx` | Preservada a paginação para evitar consultas ilimitadas; paridade visual de scroll deve ser validada com conta grande. |
| PAID-010 | ALTO | Ações em massa | funcional | Pausar/ativar/publicar/arquivar/excluir estão indisponíveis. | componentes de edição/publicação em `Campaigns.tsx` | Pendente por integração Graph e autorização; não habilitar sem endpoint real. |
| PAID-011 | MÉDIO | Colunas | funcional | Meta possui presets e personalização mais amplos, inclusive configuração de atribuição e formatação condicional. | menu de colunas observado no Ads Manager; `MetaTableControls.tsx` | Parte local existe; comparação de atribuição e formatação condicional permanecem pendentes. |
| PAID-012 | MÉDIO | Período | funcional | Growdash tem seletor próprio, mas comparação de período e todos os estados da Meta não foram comprovados na UI autenticada nesta rodada. | `MetaDateRangePicker.tsx` | Validar cada preset/comparação com conta autenticada antes de declarar paridade. |

## Alterações aplicadas nesta rodada

- `src/lib/campaignResultEvents.ts`: adicionada seleção compatível por objetivo/otimização; removido o identificador indefinido `isLeadCampaign`; resultados oficiais passaram a ser tipados para leads, conversas, visualizações, compras e alcance.
- `src/pages/Campaigns.tsx`: carregamento de `result_type`, `result_value` e `optimization_goal`; seleção oficial na campanha, conjunto e anúncio; composição de ações canônicas nos conjuntos; consultas descendentes passaram a carregar destino/otimização.
- `src/lib/campaignResultEvents.test.ts`: testes para evitar troca de evento e para seleção por objetivo.

## Prompt mestre de correção (executado nesta rodada)

> Corrija a área de tráfego pago da Growdash mantendo o contrato de dados existente. O campo Resultados deve seguir esta ordem: (1) `result_type/result_value` persistido pela sincronização Meta quando o tipo for compatível com objetivo/otimização; (2) resolver canônico por objetivo/`optimization_goal`; (3) fallback apenas para dados antigos sem objetivo conhecido. Nunca selecionar o maior evento alternativo quando existe objetivo conhecido. Aplicar a mesma regra nas abas Campanhas, Conjuntos de anúncios e Anúncios. Compor somente ações canônicas, sem duplicar aliases. Preservar o período, filtros, colunas, rolagem e seleção atuais. Não habilitar publicação, exclusão ou ações em massa sem endpoint Graph real, autorização, idempotência, auditoria e confirmação. Não expor tokens. Adicionar testes para Leads, Mensagens/Engajamento, Tráfego, Vendas, Alcance, ausência de resultado, múltiplos eventos e resultado oficial persistido. Validar TypeScript, lint, build e suíte completa.

## Validação

- `npx tsc --noEmit` — passou.
- `npx vitest run src/lib/campaignResultEvents.test.ts` — 18 testes passaram.
- `npm test -- --run` — 114 arquivos / 542 testes passaram.
- `npm run lint` — passou.
- `npm run build` — passou; apenas aviso existente de chunks grandes do Vite.
- `git diff --check` — passou.

## Pendências para paridade funcional completa

1. Validar visualmente, em sessão autenticada, os breakpoints 375, 768 e 1440, nos temas claro/escuro, para as três abas e todos os presets de período.
2. Definir e implementar contratos Graph para ações, publicação, edição em massa, arquivamento e exclusão.
3. Implementar comparação de atribuição, formatação condicional e todos os filtros adicionais da Meta.
4. Testar uma conta com mais de 50 campanhas para comparar paginação da Growdash com o scroll contínuo do Ads Manager.
5. Repetir uma sincronização real e conferir os números da mesma conta, período, janela de atribuição e definição de resultado nos dois produtos.

Até esses itens serem comprovados, o estado correto é **paridade de resultados corrigida e validada por testes**, não “100% igual ao Gerenciador”.
