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
- Validação local: Vitest completo 303/303, TypeScript e build passaram. ESLint global foi interrompido após mais de 2 minutos de CPU sem emitir resultado; ESLint nos arquivos alterados e `git diff --check` passaram. Deno não está instalado; o deploy via Supabase CLI será usado para validar o bundle das Edge Functions.
- Limite da evidência: o RAG/MCP do Codex não tem servidor Growdash configurado. O repositório contém a Edge Function MCP `meta-traffic-mcp`, mas ela é um leitor protegido dos snapshots, não um conector de dados externos nesta sessão. Ainda falta comparar Ads Manager/RD no mesmo escopo autenticado.

## Critério de conclusão

Uma correção local não equivale a publicação. Para declarar paridade, registrar separadamente commit remoto, deployment Cloudflare, versões das Edge Functions/migrations e comparação autenticada de investimento, leads e RD no mesmo recorte. Se a conta selecionada ou o dia atual não tiver retorno verificável na Meta/RD, reportar a limitação sem substituir o resultado por zero.
