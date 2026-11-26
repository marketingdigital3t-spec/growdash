# Growdash — Módulo de Automações (MVP)

## Objetivo

Adicionar ao Growdash uma página `Automações` para criar, editar, salvar e executar workflows visuais próprios, com foco inicial nas integrações usadas pelo time: Webhook, HTTP, Google Sheets, Meta Ads e RD Station.

## Limite do primeiro marco

O MVP será um módulo novo e isolado. Não substituirá as telas existentes, não alterará sincronizações atuais e não importará workflows do n8n.

Entrega inicial:

- nova rota e item de menu `Automações`;
- canvas visual com nós e conexões;
- nós `Webhook`, `HTTP Request` e `Google Sheets`;
- definição persistida como `WorkflowDefinition` versionada;
- execução manual de um workflow;
- histórico de execuções, duração, status e erro por nó;
- referências de credenciais sem expor segredos no workflow;
- validação de ciclos, nós inválidos e parâmetros obrigatórios.

Meta Ads e RD Station entram como adaptadores após o motor básico estar validado, preservando as conexões já existentes do Growdash.

## Integração com a arquitetura atual

```text
Growdash shell/navigation
  -> página Automações
  -> editor e contrato WorkflowDefinition
  -> serviço de execução
  -> adaptadores de integração
  -> persistência e histórico
```

A nova página deve seguir o layout, autenticação, tema e componentes já usados no Growdash. O motor de execução não deve depender diretamente de componentes React ou de uma biblioteca de canvas.

## Contratos

### WorkflowDefinition

- `id`, `name`, `version`, `active`;
- `nodes[]`: `id`, `type`, `position`, `parameters`;
- `connections[]`: `source`, `target`, `sourcePort`, `targetPort`.

Tipos permitidos no MVP: `webhook.trigger`, `http.request`, `google.sheets.append`.

### ExecutionRecord

- `id`, `workflowId`, `status`, `startedAt`, `finishedAt`;
- `nodeRuns[]` com status, duração, entrada/saída resumidas e erro;
- `trigger` e `error`.

### CredentialRef

O workflow armazena apenas `credentialName` e `credentialType`. Tokens e segredos ficam em conexão/armazenamento seguro já adotado pelo Growdash e nunca aparecem em exportação ou logs.

## Fluxo de uso

1. Usuário abre `Automações`.
2. Cria um workflow em branco.
3. Arrasta Webhook, HTTP ou Google Sheets para o canvas.
4. Conecta os nós e configura parâmetros.
5. Salva o workflow.
6. Executa manualmente ou inicia pelo webhook.
7. Consulta o histórico e o detalhe do erro por nó.

## Segurança e falhas

- manter autenticação e escopo de conta existentes;
- bloquear protocolos fora de HTTP/HTTPS no nó HTTP;
- aplicar timeout em chamadas externas;
- não executar código arbitrário no canvas;
- interromper a execução no primeiro erro e registrar contexto sanitizado;
- impedir duplicação de execução quando o trigger carregar um identificador de evento.

## Verificação de aceite

- A rota `Automações` abre sem regressão nas rotas atuais.
- Um workflow com Webhook → HTTP → Google Sheets pode ser criado, salvo e recarregado.
- Uma execução bem-sucedida aparece no histórico.
- Uma falha HTTP aparece no nó correto sem vazar credenciais.
- O JSON exportado não contém tokens.
- Os testes existentes do Growdash continuam passando.

## Sequência de implementação

1. Mapear navegação, persistência e autenticação atuais.
2. Adicionar contrato e armazenamento de workflows.
3. Adicionar rota, menu e canvas.
4. Implementar motor local e histórico.
5. Implementar os três adaptadores do MVP.
6. Integrar Meta Ads/RD Station somente após a base ser validada.
