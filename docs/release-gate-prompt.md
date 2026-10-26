# Growdash — prompt operacional para fechar os bloqueios de release

Você é o responsável técnico pelo Growdash. Trabalhe em sequência, preserve o
checkout e nunca transforme ausência de credencial em sucesso.

## Objetivo

Fechar os bloqueios reais da auditoria e só publicar quando houver evidência
reprodutível de autenticação, Supabase, dependências, observabilidade e
Cloudflare.

## Procedimento obrigatório

1. Leia `AGENTS.md`, registre `git status`, branch, diff, `origin/main` e o
   deployment atual. Preserve alterações externas.
2. Valide `GROWDASH_AUTH_STATE`. Se não existir, não crie sessão, não copie
   token e marque `authenticated_gate=blocked`.
3. Valide `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_ORG` e `SENTRY_PROJECT`. Sem os quatro,
   não invente configuração e marque `observability_gate=blocked`. Se
   existirem, valide release por commit, source maps privados e um evento de
   teste sem PII correlacionado por `sync_run_id`.
4. Execute `supabase db advisors --linked --type all`, classifique cada aviso
   e só corrija segurança/RLS/RPC com causa reproduzida, migration versionada,
   teste de isolamento, rollback e nova rodada de advisors.
5. Execute `npm audit --omit=dev` e investigue cada dependência. Atualize uma
   família por vez em cópia isolada; nunca use `npm audit fix --force` sem
   avaliar breaking changes e repetir testes, typecheck, lint, build e visual.
6. Investigue o último deploy Cloudflare falho. Gere build limpo e valide os
   assets. Só use Wrangler direto se todos os gates anteriores estiverem
   aprovados; caso contrário, mantenha `release_gate=blocked`.
7. Execute `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run
   build`, `npm run test:visual -- --workers=1`, `git diff --check` e o loop de
   engenharia com `LOOP_ENGINEERING_BACKEND_SCAN=1`.
8. Com sessão real, teste todas as rotas protegidas em claro/escuro e nos
   breakpoints definidos. Sem sessão, registre exatamente o bloqueio.
9. Não faça commit ou deploy de alterações não relacionadas. O relatório deve
   separar `concluído`, `parcial`, `blocked` e `não reproduzido`, incluindo
   commit, push, deployment, domínio, evidências e rollback.

## Critério de saída

`release_gate=approved` somente quando autenticação automatizada real, advisors
Supabase, dependências e observabilidade estiverem verificáveis e o domínio
principal servir o mesmo commit validado. Qualquer gate ausente mantém o
release bloqueado.

## Execução automática

O workflow `.github/workflows/loop-engineering.yml` roda no GitHub Actions a
cada três horas, no minuto 17, em UTC. Ele também pode ser iniciado manualmente
com `workflow_dispatch`.

Para liberar o smoke autenticado no CI, cadastre o conteúdo do arquivo de
Playwright compactado com gzip e codificado em base64 como o secret
`GROWDASH_AUTH_STATE_B64`. O workflow descompacta e grava esse conteúdo somente
no runner, com permissão `600`, e define
`GROWDASH_AUTH_STATE` para a execução. Sem esse secret, o gate autenticado fica
bloqueado deliberadamente.

Para o gate de observabilidade, configure os secrets `SENTRY_AUTH_TOKEN` e `SENTRY_DSN` e as
variáveis `SENTRY_ORG` e `SENTRY_PROJECT`. O workflow passa esses valores
somente ao processo do loop; nenhum deles é incluído no frontend.
