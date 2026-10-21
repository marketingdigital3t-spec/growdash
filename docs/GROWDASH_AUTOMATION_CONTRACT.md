# Contrato do motor Growdash Automations

## Definição

Um workflow é armazenado em `growdash_automations.workflow_definition` e possui
`id`, `name`, `version`, `active`, `nodes` e `connections`. Cada nó tem `id`,
`type`, `position` e `parameters`. Uma conexão liga `source` a `target` e pode
ter `sourcePort` (`true` ou `false` para IF).

## Estados

- Workflow: `draft`, `active`, `paused`, `error`.
- Execução: `success`, `partial`, `error`.
- Etapa: `queued`, `running`, `success`, `skipped`, `error`, `retrying`.

Toda execução recebe uma `idempotency_key` derivada de workflow, versão e evento.
O índice único em `growdash_automation_runs` impede uma segunda execução do
mesmo evento.

## Entrada e variáveis

O executor recebe `{ workflow_id, input, idempotency_key, mode }`. O contexto
expõe `trigger`, `lead`, `node.<id>.output` e `date.now`. A sintaxe de variável é
`{{lead.nome}}`. Valores são resolvidos como texto ou como valor nativo quando o
campo inteiro é uma expressão.

## Segurança

Tokens só são lidos no backend. Logs passam por redaction de tokens, secrets,
senhas e autorizações. Requisições HTTP bloqueiam redes privadas, URLs `.local`
e HTTP externo. O executor limita payload a 256 KB e cada execução a 100 etapas.
Não existe execução de JavaScript fornecido pelo usuário.

## Endpoints

- `POST /functions/v1/workflow-execute`: execução autenticada manual/teste.
- `POST /functions/v1/workflow-webhook/{path_token}`: disparo público com
  `x-workflow-secret` opcional e `x-idempotency-key` recomendado.

## Integrações

Os nós que exigem credencial específica devem retornar erro explícito até que a
conexão do workspace esteja configurada. Nunca registrar o conteúdo da
credencial nem mascarar uma integração ausente como sucesso.
