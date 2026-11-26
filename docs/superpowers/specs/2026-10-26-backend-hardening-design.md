# Backend Hardening — Meta, MCP, IA, RD Station e observabilidade

## Objetivo

Alinhar todas as Edge Functions que leem fatos de Meta, CRM/RD e vendas ao
mesmo contrato de autorização, escopo temporal e diagnóstico. A correção deve
preservar snapshots existentes, nunca converter ausência de dados em zero e
não expor segredos, PII ou payloads de provedores.

## Contratos

### Autorização de contas Meta

- Mestre, dono da conta e gerente do workspace podem acessar a conta conforme
  as funções SQL existentes.
- Usuário delegado só pode acessar uma conta quando existir uma linha em
  `user_ad_account_access` com o mesmo usuário, conta e workspace (ou ambos
  `workspace_id` nulos para a conta legada sem workspace).
- Toda Edge Function que usa `service_role` deve resolver a lista de contas
  por esse contrato; filtrar apenas `ad_accounts.user_id` é incorreto.
- Conta desconectada/perfil desconectado nunca é retornada como fato utilizável.

### Datas e paginação MCP

- `start_date` e `end_date` são datas civis inclusivas, validadas sem conversão
  para UTC do servidor.
- Limites de CRM têm no máximo 500 itens e usam cursor opaco externo baseado
  em `first_received_at` + `id`.
- `has_more` só é verdadeiro quando uma linha adicional foi buscada; atingir
  exatamente o limite não prova truncamento.
- Quando um workspace tem timezone configurado, a borda civil é convertida
  para UTC apenas na camada de consulta.

### Fatos/RAG

O produto atual usa recuperação estruturada de snapshots, não embeddings. O
contrato de resposta deve declarar `retrieval.mode = structured_facts`, fonte,
escopo, cobertura e `retrieved_at`; histórico conversacional nunca é fonte de
verdade. Uma implementação vetorial não será introduzida nesta correção.

### Sentry e sincronizações

Eventos de sincronização continuam não bloqueantes, mas registram somente
metadados redigidos: código estável, mensagem sanitizada limitada, duração,
tentativas, contagens, versão de contrato, trigger, escopo e release. Tokens,
URLs autenticadas e PII devem ser removidos antes do envio.

## Critérios de aceite

1. Testes unitários cobrem delegado autorizado/não autorizado, cursor e
   `has_more`, timezone civil e redaction de Sentry.
2. Meta MCP, IA e agente usam o helper compartilhado de autorização.
3. Consultas de vendas/RD não restringem fatos compartilhados ao usuário que
   criou o registro quando a conta/funil está autorizado no workspace.
4. RD lista funis e atividades usam a mesma verificação de conexão/workspace.
5. Meta Leads aborta requests de provedor no deadline já definido e preserva
   snapshot anterior em timeout.
6. `npm test`, `npm run lint`, `npm run build` e `git diff --check` passam.
7. Produção só será declarada validada após deploy e teste autenticado; sem
   credenciais autenticadas, o relatório deve declarar o bloqueio.
