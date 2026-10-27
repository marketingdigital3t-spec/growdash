# Plano de execução — backend hardening

## Sequência TDD

1. Criar contrato compartilhado de autorização de contas e testes RED/GREEN.
2. Aplicar o contrato em Meta MCP, ask-ai, agente, análise de tráfego e
   sincronizadores que usam `service_role`.
3. Estender contrato MCP com timezone civil, cursor opaco e paginação honesta;
   adaptar `get_crm_leads` e adicionar testes de fronteira.
4. Unificar autorização de leitura RD e manter escritas protegidas pelo
   `can_edit_workspace`; testar owner, manager e membro delegado.
5. Tornar Meta Leads bounded por timeout/retry e preservar snapshot; adicionar
   telemetria de causa.
6. Redigir mensagens Sentry sem segredos/PII e incluir diagnóstico útil.
7. Revisar migrações/contratos, executar testes unitários, lint, build e diff
   check; conferir alinhamento remoto e, se autorizado pelo ambiente, publicar
   somente após validação.

## Limites

- Não alterar os arquivos visuais já modificados pelo usuário.
- Não trocar orçamento, publicar campanhas ou apagar dados.
- Não inventar RAG vetorial nem considerar build/HTTP 200 como prova de fluxo
  autenticado.
- Toda mudança de código deve ser precedida por teste que falha pela causa
  correspondente.
