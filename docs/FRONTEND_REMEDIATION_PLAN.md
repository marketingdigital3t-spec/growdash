# Plano de ação — auditoria Growdash

## Lote 1 — cobertura autenticada (prioridade alta)

1. Criar sessão Playwright de teste em ambiente seguro, sem credenciais versionadas.
2. Executar as 54 rotas/combinações atualmente puladas.
3. Reabrir cada falha com screenshot, console e request associado.

Critério de aceite: nenhum teste autenticado ser pulado por ausência de sessão; falhas devem ser reproduzíveis ou marcadas como dependência externa.

## Lote 2 — disponibilidade do Supabase (prioridade alta)

1. Reexecutar `supabase migration list` quando o projeto aceitar conexão.
2. Rodar advisors sem alterar schema automaticamente.
3. Comparar migrations locais e remotas antes de qualquer mudança.

Critério de aceite: status remoto confirmado ou bloqueio documentado com erro de conexão e horário.

## Lote 3 — manutenção de lint (prioridade baixa)

Separar helpers exportados de componentes nos arquivos apontados pelo ESLint. Cada alteração deve manter os imports públicos e passar por lint, typecheck, testes e build.

Critério de aceite: zero erros e, se o lote for executado, redução dos 20 avisos sem regressão.

## Regra de publicação

Não publicar mudanças de manutenção enquanto os lotes não tiverem evidência. O commit `5a01235` permanece a versão validada em produção.
