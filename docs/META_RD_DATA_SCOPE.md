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
- A cobertura RD de métricas analíticas é confirmada por `rd_sync_scope_state`, vinculada a funil, intervalo civil e timezone. Um snapshot anterior válido continua utilizável durante uma nova tentativa; uma linha vazia só confirma zero depois que o período exato foi sincronizado com sucesso.
- Agentes/RAG/MCP são consumidores analíticos e não alimentam os cards do Growdash Flow. O Flow consulta os snapshots canônicos diretamente; diferenças ou indisponibilidade precisam ser corrigidas no pipeline Meta/RD, não mascaradas na camada de IA.
- Os action types e a resolução de aliases Meta de formulário/site/conversa têm fonte compartilhada em `supabase/functions/_shared/metaLeadMetrics.ts`; frontend importa essa mesma regra. Sincronizador, MCP e `ask-ai` não devem manter listas locais divergentes.
- Para formulários Meta, os aliases explícitos são alternativas, não parcelas somáveis: usar a primeira ação presente nesta ordem: `onsite_conversion.lead_grouped`, `leadgen_grouped`, `onsite_conversion.lead`, `leadgen.other`. `omni_lead` e `lead` genérico não comprovam formulário e não podem confirmar um zero nem servir como fallback. Aliases de conversas também seguem a prioridade declarada em `CONVERSATION_ACTION_TYPES` (começando por `onsite_conversion.messaging_conversation_started_7d`), não o maior número entre janelas diferentes. O total Meta pretendido é formulários + conversões de site comprovadas + conversas iniciadas. A configuração de ação de site é atualmente por conta e nunca basta para contar o evento: cada anúncio precisa ter destino `WEBSITE` confirmado em `adset.destination_type`; conversas só entram quando o destino do conjunto é de mensagem (`WHATSAPP`, `MESSENGER` ou `INSTAGRAM_DIRECT` e variantes). Se o destino não puder ser confirmado, o componente afetado fica indisponível/parcial, não zero confirmado. Aliases equivalentes são resolvidos sem soma duplicada por anúncio/dia/janela.
- O quadro operacional do CRM mostra o snapshot atual das negociações do RD, sem cortar leads antigos só porque o calendário global está em “Hoje”. Os indicadores do CRM continuam respeitando o período selecionado. As etapas devem vir da API RD; se ela falhar, IDs, nomes e ordem reais persistidos nas negociações podem reconstruir um snapshot recuperável, que deve ficar marcado como parcial.
- Um funil associado por `rd_connection_id` pode não ter `ad_account_id`; etapas pertencem ao funil RD e não podem exigir conta Meta. A visibilidade de usuários continua sendo validada pela política no funil pai e pelos grants de acesso.
- Os readers MCP/IA consultam snapshots e watermarks; eles não substituem o sync Meta/RD nem validam igualdade com as plataformas de origem.
