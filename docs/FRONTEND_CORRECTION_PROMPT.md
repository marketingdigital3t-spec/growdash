# Prompt de correção — Growdash

Execute somente os itens `AUD-001`, `AUD-002` e `AUD-003` do relatório atual.

## Regras

- Não inventar bugs.
- Não alterar rotas, contratos, schema ou integrações públicas sem evidência.
- Não remover ou desativar testes.
- Não colocar tokens, sessões ou dados pessoais no repositório.
- Validar claro, escuro e mobile sempre que houver alteração visual.
- Rodar `npm run lint`, `npm test`, `npm run test:visual`, `npx tsc --noEmit`, `npm run build` e `git diff --check`.
- Se a sessão autenticada ou o Supabase estiverem indisponíveis, registrar o bloqueio; não simular aprovação.

## AUD-001

Separar exports de helpers dos componentes que geram os avisos de Fast Refresh, preservando os nomes públicos. Critério: lint sem os avisos afetados, typecheck e testes verdes.

## AUD-002

Configurar sessão Playwright de teste somente com credenciais temporárias e dados não produtivos. Critério: rotas autenticadas executadas nos breakpoints definidos, com console e screenshots registrados.

## AUD-003

Revalidar conectividade do Supabase e a lista de migrations. Critério: resposta remota registrada; se continuar timeout, manter bloqueado com evidência e não executar alteração de banco.

Ao final, atualizar o relatório, executar regressão e só publicar se todos os critérios aplicáveis estiverem verdes.
