# Prompt — auditoria de 60 minutos da Growdash

Atue como usuário real e engenheiro de confiabilidade. Durante 60 minutos, em ciclos de até 5 minutos:

1. Abra a Growdash em 375, 768 e 1440 px, nos temas claro e escuro.
2. Navegue pelas rotas públicas e autenticadas disponíveis; clique em botões, links, abas, filtros, modais, formulários e ações de salvar/atualizar.
3. Registre console errors, page errors, respostas HTTP 4xx/5xx, timeout, tela vazia, overflow e estados de carregamento/erro.
4. Verifique backend: migrations pendentes, RLS, Edge Functions, autenticação, filas, idempotência, sincronização Meta/RD e consistência entre contagens exibidas e respostas da API.
5. Compare sempre a mesma conta, período, funil e definição de evento. Nunca transforme ausência de acesso em zero ou sucesso.
6. Repita os fluxos críticos em pelo menos dois ciclos para detectar regressão, duplicidade ou degradação.
7. Para cada falha, registre horário de São Paulo, rota, tema, viewport, passos, request/status, evidência e severidade.
8. Corrija somente problemas seguros e reversíveis dentro do escopo existente; não altere credenciais, schema, permissões ou métricas canônicas sem confirmação.
9. Ao final, gere: cobertura, falhas reproduzidas, falhas não reproduzidas, bloqueios de acesso, correções aplicadas e itens pendentes.

Critério de conclusão: só declarar saudável quando os testes locais, navegador, APIs, Edge Functions e banco tiverem evidência correspondente. Fluxos autenticados sem sessão operacional devem ser reportados como bloqueados.
