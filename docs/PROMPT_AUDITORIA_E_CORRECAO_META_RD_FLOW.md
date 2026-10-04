# Prompt de auditoria e correção — Meta Ads + RD no Growdash Flow

## Prompt executável

> Você é responsável por auditar e corrigir o fluxo de métricas da Growdash Flow sem inventar valores e sem misturar fontes. Siga o repositório como fonte de verdade e preserve alterações locais não relacionadas.
>
> Rastreie, em código e dados disponíveis, o caminho completo: filtros globais (UUID interno da conta, data civil inclusiva e funis RD) → hooks/adaptadores → snapshots Supabase → sincronização Meta/RD → métricas da interface. Faça também auditoria dos leitores RAG/IA e MCP para encontrar divergências de contrato, mas não use RAG/MCP como fonte primária dos cards.
>
> Meta Ads é fonte de investimento, entrega e ações atribuídas; RD Station é fonte de negociações, etapas e vendas ganhas. A conta Meta selecionada limita os fatos Meta e resolve somente os funis RD vinculados a essa conta. O período é inclusivo, em data civil e timezone da conta/funil. Leads Meta é formulário + site + conversas iniciadas; aliases equivalentes dentro do mesmo grupo são alternativas e nunca podem ser somados em duplicidade. Não use `insights.leads` como substituto das ações canônicas.
>
> Diferencie zero confirmado, ausência de fatos, cobertura incompleta, sincronização em andamento, erro de permissão/token e falha de consulta. Preserve snapshots válidos durante refetch. Não alargue conta, campanha ou funil quando o resultado estiver vazio.
>
> Compare as regras em frontend, sincronizador, MCP e IA. Unifique regras de domínio divergentes na menor camada compartilhada possível e cubra com testes para aliases de formulários, site e conversas, aliases duplicados, conta/período, zero versus ausência e cobertura. Verifique a vinculação Meta→RD, deduplicação de negócio e datas canônicas RD.
>
> Apresente evidência para cada conclusão: arquivos/linhas, escopo consultado, status de cobertura, número de linhas e erro original se disponível. Não declare paridade com Ads Manager ou RD sem uma comparação autenticada do mesmo escopo. Execute testes, lint e build aplicáveis. Separe explicitamente o que foi corrigido localmente, publicado, verificado na produção e ainda depende de acesso externo.

## Registro desta execução

- Escopo autenticado reproduzido: conta `CA02 - DRA RANNIELY SILVA [GRUPO ZNTT]`, 04/10/2026–04/10/2026, timezone São Paulo.
- Interface observada: investimento R$ 18,46; 1.074 impressões; 78 cliques; Leads Meta/forms/site/conversas = 0; RD apresenta 0 negociações/oportunidades/vendas e estado `Sincronizando`.
- O valor de investimento é um snapshot Meta exibido pelo Flow. A tela sozinha não comprova que zero ações ou zero RD sejam um zero legítimo; isso exige cobertura e comparação da mesma conta/data no Ads Manager e no RD.
- Auditoria de código identificou duas listas de action types: `src/lib/metaActionMetrics.ts` e `supabase/functions/_shared/metaLeadMetrics.ts`. A lista compartilhada, consumida pelo MCP e por `ask-ai`, estava desatualizada em relação à lista local. A lista/fórmula agora é única e compartilhada por esses leitores e pelo `sync-meta-insights`.
- Causa adicional que mascarava a falha como zero: watermarks antigos registravam `rowsPersisted` com qualquer ação (incluindo clique), e o leitor interpretava isso como confirmação de leads. A cobertura agora exige `leadRowsPersisted` explícito; watermarks legados não podem confirmar zero de leads. O sincronizador grava esse campo e versão de evidência.
- O refresh selecionado invalida o cache de Insights e de cobertura, mas não invalidava `action-totals-by-ads`, que tem cache de dois minutos e não está na assinatura Realtime. Isso mantinha leads zerados após uma sincronização já persistida; a chave agora participa da invalidação ao concluir o ciclo.
- O painel RD agora usa o timestamp do watermark do funil e período exatos, em vez do último sucesso genérico da conexão, e explica quando um snapshot confirmado permanece visível durante refetch.
- `meta-traffic-mcp` lê snapshots `insights`, `insight_actions` e watermarks; não sincroniza a Meta e não alimenta os cards do Flow. `ask-ai` também agrega snapshots e cobertura; sua saída é consumidora analítica, não fonte canônica.
- Após a última inclusão da invalidação de cache, a validação final foi: Vitest 304/304, TypeScript, ESLint nos arquivos alterados, `git diff --check` e build Vite aprovados. O lint global foi interrompido após mais de 2 minutos de CPU sem resultado; Deno não está instalado.
- Publicação: commit `c1b8744`; Edge Functions `sync-meta-insights` v79, `meta-traffic-mcp` v4 e `ask-ai` v30 ativas. O build automático Pages de `c1b8744` falhou; o bundle local validado foi publicado manualmente em produção como `76fa00a7.growdash.pages.dev`, associado à `main`/`c1b8744`. `growdash.com.br` serviu `assets/app-CQxp-GPI.js` com o mesmo SHA-256 do artefato local (`11ef0b05ad8a8896d2bc27d30f21212449c1280b4d3ace6d0e65b185537adacc`).
- Verificação autenticada pós-publicação: Flow/CA02/04-10-2026 exibiu investimento R$ 19,33, 1 lead (1 formulário, 0 site, 0 conversas), CPM R$ 17,26, 1.120 impressões, 81 cliques e CPL R$ 19,33; Meta `Atualizado`. Ads Manager, mesma conta/data/janela padrão, exibiu 1 resultado `Lead (formulário)` e nenhum resultado nas campanhas de mensagem visíveis; o total de leads coincide neste recorte. O valor gasto do Gerenciador não ficou legível na leitura acessível da tabela, então investimento não foi declarado comparado.
- O snapshot RD autenticado exibiu 1 negociação criada, 0 oportunidades, 0 vendas ganhas e R$ 0,00, com status `Atualizado` e watermark do período às 05:33:40. Não foi aberto o RD Station externo para reconciliação independente; não declarar paridade RD.
- Limite da evidência: o RAG/MCP do Codex não tem servidor Growdash configurado. O repositório contém a Edge Function MCP `meta-traffic-mcp`, leitor protegido dos snapshots, não conector externo nem fonte dos cards. Não foi validada paridade para as outras contas Meta nem outros períodos.

## Critério de conclusão

Uma correção local não equivale a publicação. Para declarar paridade, registrar separadamente commit remoto, deployment Cloudflare, versões das Edge Functions/migrations e comparação autenticada de investimento, leads e RD no mesmo recorte. Se a conta selecionada ou o dia atual não tiver retorno verificável na Meta/RD, reportar a limitação sem substituir o resultado por zero.

## Retomada e correção de troca de escopo — 04/10/2026

- Causa reproduzível no fluxo de sincronização global: `useNearRealtimeSync` mantinha uma única promessa em voo. Ao trocar o filtro de conta/data enquanto a solicitação anterior ainda executava, a chamada do novo escopo reutilizava a promessa antiga e deixava de iniciar seu próprio refresh até o próximo ciclo/foco.
- Correção local: lock em voo agora é indexado pela chave completa do escopo; chamadas duplicadas do mesmo escopo continuam coalescidas, mas contas/períodos diferentes podem sincronizar sem bloquear umas às outras. Respostas do escopo anterior não alteram o status visual do escopo atualmente selecionado.
- Regressão coberta por testes para deduplicação no mesmo escopo, execução independente entre contas diferentes e liberação do lock após falha.
- Comparação autenticada às 08:00 BRT: CA01 Ranniely (`1355510419881651`), 04/10/2026, Ads Manager em “Hoje” e atribuição padrão. Growdash mostrou investimento R$ 16,41, 1.395 impressões, CPM R$ 11,76, 113 cliques e 11 leads (5 formulário + 5 site + 1 conversa); Ads Manager, após atualizar a tabela, mostrou R$ 16,53, 5 leads na Meta, 5 leads no site, total de leads 10 e 1 conversa iniciada. A diferença de investimento é 0,73%; a soma canônica Growdash é 11 porque inclui conversa, enquanto “Leads” da Meta é 10. O total de impressões da Meta não ficou suficientemente claro após a atualização, portanto CPM não foi declarado comparado nesta rodada.
- O painel RD autenticado mostrou 5 negociações criadas, 0 oportunidades, 0 vendas ganhas e R$ 0,00 de receita RD para 04/10. A confirmação do snapshot interno não substitui uma comparação independente na interface do RD Station.
- Auditoria do consumidor MCP: `meta-traffic-mcp` lê os snapshots e watermarks; não é fonte dos cards nem inicia sincronização. A auditoria anterior registrada acima já confirma que o MCP e `ask-ai` usam o contrato canônico compartilhado. Não há servidor externo Growdash RAG/MCP disponível nesta sessão.
- Validação desta correção local: Vitest 73 arquivos/316 testes aprovados; ESLint nos três arquivos alterados e build Vite aprovados. O typecheck completo do projeto continua falhando em erros TypeScript preexistentes distribuídos por outras áreas, incluindo tipos em `src/lib/metaTraffic.ts`; nenhuma falha apontou para o hook ou o utilitário novo nesta execução. O commit/deploy/produção desta correção ainda precisam ser registrados após publicação.
