# Escopo de dados Meta Ads e RD Station

## Identidade e fontes

- Fatos Meta (`insights`, `insight_actions`) são consultados pelo UUID interno de `ad_accounts.id`. O identificador `act_...` é usado apenas para resolver integrações externas.
- Fatos de CRM permanecem no RD. Selecionar uma conta Meta não transforma métricas RD em métricas Meta.
- Uma métrica RD por conta Meta inclui somente funis RD vinculados à conta por `rd_account_connections.external_account_id` (normalizado como `act_<dígitos>`) e `rd_funnels.rd_connection_id`. O vínculo legado direto por `rd_funnels.ad_account_id` também é aceito.

## Regras de escopo

- Um escopo explícito `funnelIds` prevalece sobre a resolução automática.
- Quando a consulta recebe uma conta Meta, mas não recebe funis, os funis são resolvidos pelo vínculo acima antes de consultar `rd_deals`.
- Se algum UUID de conta solicitado não puder ser resolvido, ou se a conta não tiver funil vinculado, a consulta RD usa um escopo sentinela vazio. Ela nunca amplia silenciosamente para todas as pipelines.
- “Todas as contas” só significa todas as pipelines RD ativas quando nenhum escopo de conta ou funil foi solicitado.
- A chave de cache deve incluir o escopo de funis efetivamente resolvido; resultados de outra conta, período ou pipeline não podem ser apresentados como se fossem do filtro atual.

## Datas

- Filtros de calendário usam datas civis inclusivas `YYYY-MM-DD`.
- A data civil do RD é expandida para o início e fim do dia em `America/Sao_Paulo` antes de consultar colunas `timestamptz`.
- Os fatos Meta por dia são consultados usando a mesma chave civil; o timezone e a janela de atribuição pertencem à conta.
- Dia sem fatos confirmados, sincronização pendente e zero legítimo são estados distintos. Falha de fonte não pode ser convertida em zero.
