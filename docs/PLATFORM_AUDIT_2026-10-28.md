# Auditoria da plataforma Growdash — 2026-10-28

Este registro separa falhas reproduzidas, riscos observados e limites de
publicação. Não é uma declaração de que a produção está corrigida.

## Falhas reproduzidas

1. **Supabase Auth indisponível por timeout.** Três chamadas independentes a
   `/auth/v1/settings` usando a chave pública configurada excederam 3 segundos,
   sem resposta HTTP.
2. **PostgREST indisponível por timeout.** Três chamadas independentes a
   `/rest/v1/ad_accounts` excederam 3 segundos, sem resposta HTTP.
3. **Dashboard degradado.** A sessão autenticada exibiu métricas Meta como
   indisponíveis/carregando e cards financeiros em `R$ 0,00` com indicação de
   atualização em segundo plano. Sem snapshot confirmado, esse estado precisa
   permanecer explicitamente indisponível, nunca ser interpretado como zero.
4. **CRM degradado.** A rota autenticada permaneceu em abertura/carregamento e,
   após a tentativa, exibiu `Negociações indisponíveis` e `Sincronização RD
   aguardando`.
5. **Campanhas sem catálogo carregado.** A rota autenticada permaneceu em
   `Campanhas (carregando…)`, com as ações dependentes do catálogo desabilitadas.
6. **Datas legadas incorretas.** Integrações Meta exibiram `31/12/1969 às 21:00`
   como expiração de token em várias contas. Esse valor é epoch/zero legado, não
   uma expiração plausível.
7. **Produção atrás do código local.** O domínio serviu `app-BAakJasz.js`,
   enquanto o build local corrigido gerou `app-DjF-tL5t.js`; portanto as correções
   locais ainda não estavam na produção durante a auditoria.
8. **Smoke autenticado automatizado não executável.** A matriz Playwright tem
   54 testes autenticados pulados porque `GROWDASH_AUTH_STATE` não está disponível.
9. **Observabilidade e publicação não comprováveis neste ambiente.** Não existem
   `SUPABASE_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   `SENTRY_AUTH_TOKEN` nem estado autenticado exportável.

## O que respondeu corretamente

- O gateway das Edge Functions respondeu às funções protegidas com HTTP 401 e
  `Missing authorization header`/`Não autenticado` quando chamado sem sessão.
- Isso confirma que o gateway está alcançável, mas não comprova sessão autenticada,
  leitura do banco ou persistência de sincronização.
- O MCP retornou 401 sem cabeçalho; não foi possível validar uma chamada MCP real
  porque Auth/PostgREST não responderam e não havia token de sessão disponível.

## Riscos de qualidade observados

- O build ainda emite aviso de chunks acima de 500 kB, com alguns chunks acima de
  1 MB; isso aumenta o tempo de carregamento e o risco de falha de chunk após
  publicação.
- O lint passa sem erros, mas mantém avisos preexistentes de Fast Refresh e
  dependências de hooks.
- Google Ads e TikTok Ads aparecem explicitamente como `Em preparação` e não são
  integrações funcionais.
- Campanhas de pausar/ativar, publicar, arquivar e excluir continuam marcadas
  como `Em breve`; são capacidades não implementadas, não sincronizações
  confirmadas.

## Correções locais realizadas

- Datas de token e sincronização agora passam por `parsePlausibleDate`, que rejeita
  datas anteriores a 2000.
- Dashboard Meta sai do estado visual de carregamento após 4,5 s sem cancelar a
  requisição remota e preserva snapshot válido.
- CRM sai do spinner infinito após 4,5 s e mostra estado explícito de atualização
  RD em segundo plano.
- Hierarquia de campanhas usa listas memoizadas para evitar recomputação e avisos
  de dependência em hooks.

## Verificações locais

- `npm test -- --run`: 165 arquivos, 758 testes aprovados.
- Testes específicos de datas, sincronização, escopo CRM e campanhas: 10 testes
  aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: 0 erros; avisos não bloqueantes registrados acima.
- `npm run build`: aprovado; avisos de tamanho de chunks registrados acima.
- `git diff --check`: aprovado.
- Testes visuais públicos: 9 aprovados; 54 testes autenticados pulados por falta
  de `GROWDASH_AUTH_STATE`.

## Bloqueios externos

Auth e PostgREST do projeto Supabase ficaram indisponíveis em três verificações
independentes. Sem recuperar esses serviços ou fornecer acesso operacional seguro,
não é possível provar sincronização Meta/RD real, persistência, RAG/MCP, logs de
Postgres/Auth, advisors, pooler, publicação de Edge Functions ou deployment do
Cloudflare.

## Revalidação após a auditoria

- O commit `f2f3895` foi publicado pelo pipeline `40617339988`; migrations,
  Edge Functions, Sentry, Cloudflare e smoke autenticado passaram.
- O ajuste de cadência do Growdash Flow foi publicado no commit `0891156` pelo
  pipeline `40618340755`. A reconciliação automática RD agora usa quinze minutos
  para cobertura, deduplicação e intervalo, mantendo Realtime para atualizações
  entre ciclos.
- O segundo pipeline terminou com sucesso; o smoke autenticado de produção
  passou em 18 rotas e o smoke das Edge Functions confirmou 401 sem sessão.
- Depois da publicação, uma sessão real no navegador voltou a exibir
  `Não foi possível verificar sua sessão`. Com a chave pública configurada, as
  chamadas a `/auth/v1/settings` e `/rest/v1/ad_accounts` excederam 10 segundos
  sem resposta. Sem chave, os mesmos endpoints respondem 401 rapidamente; isso
  separa indisponibilidade do gateway autenticado de uma simples rota inexistente.
- Portanto, o frontend e a cadência foram publicados, mas a persistência real de
  Meta/RD, MCP e RAG continua não comprovável enquanto Auth/PostgREST do projeto
  não responderem a uma sessão válida.
