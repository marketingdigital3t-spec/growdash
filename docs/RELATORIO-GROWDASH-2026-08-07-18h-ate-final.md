# Relatório de estabilização — Growdash

Período: 07/08/2026, 18:00 (America/Sao_Paulo) até o encerramento da auditoria.

> Documento em andamento. O fechamento final incluirá as verificações e publicações realizadas após esta atualização.

## Publicações e correções confirmadas

| Horário | Commit | Entrega |
| --- | --- | --- |
| 07/08 22:34 | `5b52858` | Refinamentos de operações do dashboard e integrações. |
| 07/08 22:48 | `eae6399` | Templates prontos e estados de carregamento resilientes no Kanban. |
| 07/08 22:50 | `4d5b827` | Testes alinhados ao dashboard com KPIs editáveis. |
| 07/08 22:58 | `9e28e5a` | Aceleração do carregamento inicial. |
| 07/08 23:06 | `3ce238d` | Endurecimento de OAuth e saúde de tokens. |
| 07/08 23:28 | `ff0c741` | Remoção de renderizações desnecessárias no dashboard e tipagem do Kanban. |
| 07/08 23:40 | `07ede6c` | Atualização da ferramenta de build/testes e snapshots visuais. |
| 07/08 23:42 | `94d4828` | Recuperação para falha de módulos carregados sob demanda. |
| 07/08 23:46 | `932e3f3` | Saída mantida exclusivamente no menu do perfil. |
| 07/08 23:47 | `d13423f` | Health check Meta passa a validar `ads_read` e `leads_retrieval`. |
| 08/08 00:00 | `6b6830a` | Removido pré-carregamento indevido de rotas pesadas; recuperação de boot adicionada; TypeScript estabilizado. |
| 08/08 00:26 | `96ea7dc` | Criação de agendamento WhatsApp corrigida para usar `local_time` e `include_metrics`, os nomes reais da tabela. |
| 08/08 00:30 | `a0159a7` | Migration criada para permitir, por RLS, turmas personalizadas sem conta de anúncio nem funil RD. |
| 08/08 00:47 | `aeb7cba` | Filtro de período do CRM passa a priorizar `stage_updated_at`, evitando que `closed_at` antigo esconda negócios movimentados no intervalo selecionado. Deploy Cloudflare: `https://b6bdb08d.growdash.pages.dev`. |
| 08/08 00:56 | `7c8e179` | Corrigida a configuração do Cloudflare Pages Git: build `npm run build` e diretório de saída `dist`. O domínio estava publicando o código-fonte (`/src/main.tsx`), causando a tela de carregamento permanente. Deploy de produção: `https://40a7ba1e.growdash.pages.dev`; `growdash.com.br` e `www.growdash.com.br` passaram a servir o bundle Vite. |
| 08/08 01:04 | `32a9175` | Unificada a navegação Meta Connect com a Central de integrações: o menu duplicado foi removido, `/meta-connect` mantém redirecionamento legado para `integracoes?tab=paid` e permissões antigas `can_meta_connect` continuam autorizando a tela unificada. Deploy: `https://13b4dc2f.growdash.pages.dev`. |
| 08/08 01:12 | `c543c3a` | KPIs de leads do dashboard passaram a somar conversas iniciadas pelo evento oficial `onsite_conversion.messaging_conversation_started_7d`. O resumo fixo permite clicar em “Leads” para ver Forms, Site, Conversas iniciadas e Total. Deploy: `https://aca494cd.growdash.pages.dev`. |
| 08/08 01:15 | `6638d12` | Widgets KPI de Leads agora exibem no hover o detalhamento por Forms, Site e Conversas iniciadas, preservando a edição individual do dashboard. Deploy: `https://2c834575.growdash.pages.dev`. |
| 08/08 01:21 | `4ecbae7` | Growdash Flow agora recarrega elementos, zoom, grade e snap quando outro funil salvo é aberto sem remontar a tela; Kanban mostra erro recuperável e botão de nova tentativa; OAuth Instagram aceita respostas com `id` ou `user_id`; a sincronização classifica vídeos/Reels corretamente para retenção e visualizações. Deploy: `https://94863119.growdash.pages.dev`. |
| 08/08 01:24 | `ab64bd3` | A edição de dashboard só fecha após confirmar que o banco alterou a visualização. Atualizações bloqueadas por RLS/permissão deixam o rascunho aberto e exibem erro acionável, evitando perda silenciosa de ajustes individuais de KPI. Deploy: `https://57f36f38.growdash.pages.dev`. |
| 08/08 01:28 | `6c727c2` | Filtros de CRM/comercial e relatórios RD agora expandem o limite final até o fim do dia local. Intervalos personalizados deixam de perder negócios criados no próprio último dia selecionado. Deploy: `https://fb95e47d.growdash.pages.dev`. |
| 08/08 01:31 | `e04ca27` | Corrigida a publicação do domínio raiz `growdash.com.br`: o edge havia guardado uma resposta HTML no URL do JavaScript principal com cache imutável, recriando a tela de carregamento. Foi publicado o build validado diretamente no Pages (`https://dc4ae050.growdash.pages.dev`); raiz e `www` agora devolvem `application/javascript` para o bundle de entrada. |
| 08/08 01:42 | `6445d21` | Leitura de perfil do Instagram OAuth e sincronização passaram a tentar separadamente os campos compatíveis `id` e `user_id`. Isso evita rejeitar uma autorização válida quando a versão da API aceita somente uma das variantes. GitHub publicado; Pages validado em `https://a8603b2f.growdash.pages.dev`. |

## Desempenho e carregamento

- O HTML de produção pré-carregava vários módulos de rota, inclusive o pacote de gráficos Recharts de aproximadamente 517 kB. Isso fazia a tela inicial competir por recursos que só são necessários após autenticação.
- O Vite agora pré-carrega somente o shell inicial. Os módulos de gráficos e de páginas são carregados sob demanda.
- Se o módulo de entrada for bloqueado por conexão, cache ou extensão do navegador, a tela inicial deixa de ficar em carregamento infinito e oferece recarregamento após 12 segundos.
- A produção em `https://growdash.com.br` foi conferida carregando a tela de autenticação e uma rota protegida, sem erros no console.

## Publicações Cloudflare verificadas

- `https://8d033948.growdash.pages.dev` — publicação anterior de estabilização.
- `https://d9df8425.growdash.pages.dev` — melhoria de carregamento e recuperação de boot.
- `https://bb88e612.growdash.pages.dev` — correção do agendamento WhatsApp.
- O domínio `https://growdash.com.br` foi verificado apontando para os bundles publicados mais recentes.
- O projeto Pages tinha `build_command` e `destination_dir` vazios; a publicação automática do Git entregava o repositório sem build. A configuração foi corrigida via API do Cloudflare e versionada em `wrangler.toml`. Após o novo push, a produção passou a responder com `assets/app-*.js`.

## Validações executadas

- TypeScript: aprovado sem erros.
- Vitest: 21 arquivos, 56 testes aprovados.
- ESLint: sem erros; permanecem 15 avisos antigos de Fast Refresh.
- Build Vite: aprovado.
- Playwright visual: telas de login mobile, tablet e desktop aprovadas; rotas autenticadas requerem credenciais E2E e foram puladas.
- `npm audit`: nenhuma vulnerabilidade encontrada.
- Playwright visual após a correção do CRM: 3 testes aprovados e 3 rotas autenticadas puladas por falta de `E2E_EMAIL`/`E2E_PASSWORD`.
- Após a correção do Pages, `npx tsc --noEmit`, ESLint, Vitest (21 arquivos/56 testes) e Vite build foram executados novamente com sucesso; ESLint manteve apenas 15 warnings antigos de Fast Refresh.
- Para a unificação de integrações: TypeScript aprovado, ESLint sem erros (15 warnings antigos), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual 3/3 testes executados aprovados (3 rotas autenticadas puladas sem credenciais E2E).
- Para os KPIs de leads: TypeScript aprovado, ESLint sem erros (15 warnings antigos), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual 3/3 testes executados aprovados.
- Para o commit `4ecbae7`: TypeScript aprovado, ESLint sem erros (15 warnings antigos), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual com 3 testes executados aprovados e 3 rotas autenticadas puladas por falta de credenciais E2E.
- Para o commit `ab64bd3`: TypeScript aprovado, ESLint sem erros (15 warnings antigos), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual com 3 testes executados aprovados e 3 rotas autenticadas puladas por falta de credenciais E2E.
- Para o commit `6c727c2`: TypeScript aprovado, ESLint sem erros (15 warnings antigos), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual com 3 testes executados aprovados e 3 rotas autenticadas puladas por falta de credenciais E2E.
- Verificação HTTP pós-publicação: `growdash.com.br`, `www.growdash.com.br` e a URL de produção do Pages respondem com HTML 200 e seus respectivos bundles de entrada respondem 200 como JavaScript. Antes da correção, apenas o domínio raiz devolvia HTML para o arquivo `.js`; a tentativa de purge seletivo foi recusada porque o token local não possui escopo de purge de cache, por isso o build validado foi republicado com hash novo.
- Para o commit `6445d21`: TypeScript aprovado, ESLint sem erros (15 warnings antigos de Fast Refresh), Vitest 21/56 aprovado, build Vite aprovado e Playwright visual 3/3 telas públicas aprovado (3 rotas autenticadas continuam puladas sem credenciais E2E). A checagem Deno das Edge Functions ficou indisponível porque o executável `deno` não está instalado nesta máquina. O Pages foi publicado manualmente e os hosts `growdash.com.br`, `www.growdash.com.br` e `a8603b2f.growdash.pages.dev` devolvem 200; o bundle `app-BcdILXXN.js` devolve `application/javascript` em todos eles.

## Pendências externas e limites de validação

- A migration `20260808003000_fix_custom_event_class_rls.sql` está versionada no GitHub, mas ainda precisa ser aplicada ao Supabase. Esta máquina não tem `SUPABASE_ACCESS_TOKEN`, projeto vinculado ou banco local ativo.
- Ainda faltam `META_APP_SECRET` e `INSTAGRAM_APP_SECRET` no Supabase para concluir OAuth Meta/Instagram em produção.
- O commit `6445d21` contém o código das Edge Functions, mas a publicação delas no Supabase permanece bloqueada pelas mesmas credenciais de deploy ausentes; o deploy do Cloudflare Pages não publica funções Supabase.
- A conta Meta continua bloqueada pela Meta Developers; duas conexões no banco estavam desconectadas com erro 200 de acesso bloqueado. Os tokens não foram apagados porque essa exclusão exige autorização específica.
- A validação visual autenticada e o fluxo real de OAuth dependem de credenciais e da liberação dos provedores externos.

## Próximas verificações

1. Aplicar a migration de RLS no Supabase assim que o acesso de deploy estiver configurado.
2. Testar criação e edição de turma personalizada autenticada.
3. Prosseguir com a auditoria de campos mascarados por `any`, sobretudo em integrações e registros de criação.
4. Atualizar este documento no encerramento com o resultado das verificações restantes.
