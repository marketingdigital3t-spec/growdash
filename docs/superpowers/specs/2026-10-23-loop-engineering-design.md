# Loop Engineering Growdash — especificação

## Objetivo

Criar um ciclo automatizado e auditável para detectar regressões no frontend e
backend, reproduzir o problema, aplicar correções determinísticas cobertas por
testes, validar o resultado e decidir se a mudança pode ser publicada.

O sistema deve reduzir a exposição do usuário a bugs e ausência de dados sem
transformar erro, timeout ou integração indisponível em zero e sem permitir que
uma alteração de alto risco seja publicada sem revisão.

## Escopo

### Incluído

- contrato versionado para achados, evidências, reprodução, correção, validação,
  risco, publicação e rollback;
- runner local/CI em `scripts/loop-engineering.mjs`;
- detectores para testes, lint, build, smoke visual, erros de runtime e
  violações conhecidas do contrato de disponibilidade;
- registro sanitizado e deduplicado de cada execução;
- catálogo de corretores determinísticos com pré-condições e testes associados;
- gates de segurança e de qualidade que bloqueiam publicação quando necessário;
- workflow agendado/manual do GitHub para gerar relatório e artefatos;
- testes unitários do contrato e do ciclo do runner.

### Limites de execução automática

O runner não edita código arbitrário por inferência e não executa JavaScript
fornecido por usuário. Ele pode alterar banco/RLS, permissões, autenticação,
webhooks, callbacks, secrets e métricas financeiras quando a causa raiz for
reproduzida e existir um `remediation_plan` versionado que declare:

- arquivos/migrations/segredos-alvo e o motivo de cada alteração;
- teste de regressão, teste de autorização/isolamento e teste de integração
  aplicáveis;
- patches declarativos com arquivo permitido, texto esperado e substituição
  determinística; a pré-condição precisa corresponder exatamente antes da
  escrita;
- pré-condições, backup ou snapshot recuperável e procedimento de rollback;
- validação pós-alteração e evidência de que o escopo workspace/conta/período
  não foi ampliado;
- limite de impacto e condição explícita de abortar.

O modo `repair` pode preparar e testar o patch. O modo `release` pode aplicá-lo
e publicá-lo somente depois de todos os gates do plano passarem. Se qualquer
evidência, teste, backup, permissão ou rollback estiver ausente, o achado é
registrado como `blocked` e não há alteração parcial.

Patches são aplicados somente em arquivos explicitamente listados. Cada arquivo
é lido antes da escrita, e qualquer falha restaura os conteúdos já alterados no
mesmo ciclo. Comandos de remediação são allowlistados; não há shell arbitrário.

## Contrato do ciclo

Cada execução possui `schema_version`, `run_id`, `started_at`, `finished_at`,
`commit_sha`, `mode` (`detect`, `repair`, `release`), `status` e uma lista de
`findings`.

Um achado possui:

- `id` e `signature` estáveis para deduplicação;
- `layer`: `frontend`, `backend`, `database`, `integration` ou `release`;
- `severity`: `low`, `medium`, `high` ou `critical`;
- `category`: `runtime`, `data_availability`, `performance`, `security`,
  `authorization`, `build`, `test` ou `deployment`;
- `evidence`: comandos, saída sanitizada, rota/escopo e timestamps;
- `reproduction`: passos determinísticos ou comando executável;
- `remediation`: `not_attempted`, `applied`, `blocked` ou `not_applicable`;
- `validation`: testes executados e resultados;
- `release_decision`: `eligible`, `blocked` ou `manual_review`;
- `rollback`: commit/artefato anterior e instrução segura.

Estados do ciclo: `detected`, `reproduced`, `repairing`, `validated`,
`blocked`, `released` e `failed`.

Nenhum detector pode concluir `empty_confirmed` ou valor numérico zero a partir
de timeout, erro, ausência de resposta ou integração indisponível.

## Arquitetura

1. **Collectors** executam comandos permitidos e adaptadores de runtime. Toda
   saída passa por redaction de tokens, cookies, URLs assinadas e valores de
   autorização.
2. **Normalizer** converte falhas em achados com assinatura estável e mantém a
   evidência original somente no artefato privado da execução.
3. **Reproducer** roda o comando/fixture declarado com timeout e limite de
   recursos. Falha de reprodução não é tratada como correção.
4. **Remediation registry** seleciona apenas corretores que declaram a
   assinatura, pré-condições, arquivos permitidos e teste de regressão.
5. **Validator** executa o teste específico e a suíte mínima (`npm test`, lint,
   build e diff check conforme a classe do achado).
6. **Release gate** autoriza mudanças de alto risco somente quando o plano
   versionado comprova causa raiz, escopo, testes, backup e rollback. Bloqueia
   diff sem teste, falha de segurança não corrigida, segredo ausente ou
   alteração fora do plano. Apenas uma execução validada pode produzir o
   artefato de publicação.
7. **Reporter** gera JSON e Markdown com implementado, reproduzido, corrigido,
   validado, bloqueado e pendências reais.

## Modos de execução

- `detect`: somente coleta, normalização e relatório; não escreve código.
- `repair`: pode executar corretores determinísticos em checkout isolado, mas
  nunca publica; exige teste vermelho antes do corretor e teste verde depois.
- `release`: exige commit validado, árvore limpa, origem sincronizada,
  manifesto de assets e gates aprovados. Publicação fica desabilitada por padrão
  no CI até que o ambiente forneça as credenciais e o approval gate.

## Segurança e rollback

- tokens e credenciais nunca entram no relatório;
- workspace, conta, funil, período e timezone são parte da evidência de dados;
- nenhuma consulta de diagnóstico remove o snapshot anterior nem mascara erro;
- mudanças em Supabase exigem migration revisável, advisors, backup/snapshot,
  teste de RLS e validação pós-migration;
- cada publicação registra SHA, URL, manifesto de assets e versão anterior;
- rollback é feito por novo deploy do artefato anterior, sem `reset --hard` ou
  destruição do checkout.

## Critérios de aceite

- um erro conhecido de loading/zero falso é detectado com assinatura estável;
- o runner reproduz uma falha por fixture, aplica o corretor registrado e prova
  o teste de regressão vermelho→verde;
- timeout, erro de rede e fonte indisponível preservam estado `stale` ou
  `unavailable`, nunca `empty_confirmed`;
- um achado de segurança/permissão com plano completo pode alterar os arquivos,
  aplicar migration e validar isolamento; sem o plano, é bloqueado sem alteração;
- execução duplicada do mesmo commit e assinatura é deduplicada;
- `npm test`, lint direcionado, build e `git diff --check` são executados e
  aparecem no relatório;
- o workflow CI salva relatório mesmo quando o gate bloqueia a publicação;
- o runner não expõe secrets e mantém a sidebar/fluxos existentes intactos.
