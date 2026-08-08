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

## Pendências externas e limites de validação

- A migration `20260808003000_fix_custom_event_class_rls.sql` está versionada no GitHub, mas ainda precisa ser aplicada ao Supabase. Esta máquina não tem `SUPABASE_ACCESS_TOKEN`, projeto vinculado ou banco local ativo.
- Ainda faltam `META_APP_SECRET` e `INSTAGRAM_APP_SECRET` no Supabase para concluir OAuth Meta/Instagram em produção.
- A conta Meta continua bloqueada pela Meta Developers; duas conexões no banco estavam desconectadas com erro 200 de acesso bloqueado. Os tokens não foram apagados porque essa exclusão exige autorização específica.
- A validação visual autenticada e o fluxo real de OAuth dependem de credenciais e da liberação dos provedores externos.

## Próximas verificações

1. Aplicar a migration de RLS no Supabase assim que o acesso de deploy estiver configurado.
2. Testar criação e edição de turma personalizada autenticada.
3. Prosseguir com a auditoria de campos mascarados por `any`, sobretudo em integrações e registros de criação.
4. Atualizar este documento no encerramento com o resultado das verificações restantes.
