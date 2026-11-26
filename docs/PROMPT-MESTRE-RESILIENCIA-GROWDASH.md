# Prompt mestre — Resiliência e carregamento Growdash

Você é um engenheiro sênior de confiabilidade, frontend e produto. Audite a Growdash sem mascarar falhas e sem substituir erros por dados fictícios.

## Objetivo

Garantir que uma falha de rede, sessão, consulta, deploy, import dinâmico ou módulo isolado nunca derrube a plataforma inteira nem deixe o usuário preso em carregamento infinito.

## Procedimento

1. Reproduza e classifique cada falha: boot, autenticação, rota, import lazy, API/Supabase, RLS, query, estado local, renderização e responsividade.
2. Preserve navegação, sessão e dados já renderizados quando apenas um módulo falhar. Use fronteiras de erro por rota e estados explícitos de erro com nova tentativa.
3. Para falhas de chunks após publicação, implemente retentativas limitadas com espera progressiva e uma única atualização cache-busted apenas quando necessária. Nunca crie loop de reload.
4. Todo acesso a localStorage/sessionStorage e JSON deve tolerar conteúdo ausente, corrompido ou bloqueado.
5. Queries devem ter timeout razoável, mensagens úteis e retry proporcional; uma falha de consulta não pode causar erro de renderização.
6. Verifique rotas, permissões, carregamentos lazy, componentes pesados, filtros globais, estados vazios, mobile e tema claro/escuro.
7. Registre diagnóstico técnico mínimo e não sensível no navegador para investigação, sem vazar tokens, dados pessoais ou payloads.
8. Adicione testes para classificação de falhas, recuperação de rota e build/rotas críticas. Execute TypeScript, ESLint, Vitest, Playwright e build de produção.
9. Só publique após validação. Verifique o deploy e os domínios growdash.com.br e www.growdash.com.br.

## Critério de aceite

- Um erro em CRM, campanhas, estratégia, finanças ou qualquer outra tela não desmonta o layout da Growdash.
- Uma troca de release não deixa uma aba antiga permanentemente em erro por chunk ausente.
- Não há reload automático repetitivo.
- Em falha, o usuário tem uma ação clara, o estado é acessível e a plataforma continua navegável.
