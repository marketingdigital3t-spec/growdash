# Prompt master — espelho RD Station completo, fiel e quase em tempo real

## Objetivo

Garantir que a Growdash seja um espelho somente leitura do RD Station CRM: o RD
é a fonte canônica de negociações, etapas, oportunidades, vendas e histórico.
Nenhum MCP, RAG, agente ou modelo de IA pode criar, completar, classificar ou
substituir uma negociação RD exibida nos cards, funil ou CRM.

## Contrato obrigatório de identidade e escopo

- Identidade do negócio: `rd_connection_id + rd_deal_id`.
- Conta Meta selecionada limita os dados Meta e resolve somente os funis RD
  vinculados à conexão daquela conta.
- Um funil local ativo por `rd_funnel_id` de provedor; associações antigas ficam
  inativas para auditoria e nunca criam uma segunda coluna ou contagem.
- A rota `/crm` é somente leitura: não oferece edição de negócio, etapa, contato,
  valor, UTM ou anotação como alteração do espelho. Ajustes são feitos no RD e
  retornam pela sincronização; o botão de atualização apenas reconcilia a fonte.
- Período é inclusivo em data civil e timezone da conta; negociações abertas do
  pipeline continuam visíveis no CRM, enquanto relatórios usam a regra de data
  declarada pelo componente.
- Paginação continua até uma página curta. Nunca impor teto silencioso de 1.000
  ou 10.000 registros.
- Deduplicar antes de agregar e preservar o registro mais recentemente
  atualizado para a mesma identidade do provedor.

## Contrato de estados

Cada consulta deve diferenciar `loading`, `fresh`, `syncing`, `partial`, `error`,
`unavailable` e `empty_confirmed`. Erro, timeout, cursor incompleto ou lock não
podem virar `0` nem “nenhuma negociação”. Durante refetch, manter o último
snapshot do mesmo escopo e mostrar o estado da atualização.

## Sincronização

- Ciclo automático atualiza somente a janela recente e preserva todo o histórico.
- Backfill histórico é explícito, paginado, retomável por cursor e só marca
  cobertura completa após conferir IDs persistidos e duplicidades.
- Cada execução fecha `sync_runs` com status, erro, páginas, linhas e horário.
  Runs órfãos são encerrados antes de nova execução; o índice parcial permite
  apenas uma execução ativa por funil.
- Falha de Meta ou RD mantém o snapshot anterior; nunca apaga linhas válidas.
- Mudança de etapa do RD atualiza o mesmo `rd_deal_id`, não insere cópia.
- Realtime invalida o escopo exato; respostas de uma conta/período antigo não
  podem sobrescrever a tela atual.

## Consumidores MCP, RAG e IA

MCP, RAG e agentes são consumidores analíticos e devem receber fatos já
escopados, cobertura e origem. Eles não são fonte dos cards e não podem usar
`insights.leads`, inferência sem vínculo, memória de conversa ou dado agregado
da Meta para preencher um atributo RD.

## Critérios de aceite

1. O mesmo funil, conta e filtro de criação exibem o mesmo total do RD Station.
2. Troca de conta/período não mostra o snapshot de outro escopo.
3. Uma falha/timeout exibe erro e preserva o último snapshot, sem zerar.
4. Oportunidades e vendas usam apenas os estágios/IDs persistidos pelo RD.
5. Duplicação de pipeline não cria colunas nem duplica negócios.
6. Mais de 1.000 negócios são paginados integralmente.
7. Cursor parcial aparece como parcial até completar.
8. Logs e `sync_runs` permitem auditar conexão, funil, período, páginas e erro.
9. Testes cobrem identidade, paginação, escopo, deduplicação, lock, cursor,
   erro-preserva-snapshot e paridade autenticada.

## Validação de entrega

Executar TypeScript, lint, testes, build e `git diff --check`; conferir
`origin/main`, migration e versões das Edge Functions; publicar backend e
frontend; depois comparar no navegador autenticado o mesmo funil, conta,
período e timezone no RD Station e na Growdash. Relatar separadamente local,
commit/push, Supabase, Cloudflare e produção. Não declarar paridade quando o
escopo externo não puder ser confirmado.

## Auditoria executada em 16/10/2026

- A comparação autenticada da conta `CA01 - DRA RANNIELY SILVA [GRUPO ZNTT]`,
  funil `Dra. Ranniely Silva – Paciente Modelo` e período de criação
  `01/09/2026–30/09/2026` retornou `449` no RD Station e `449` na Growdash.
- A captura com `205` pertence a outro escopo efetivo de funil; não deve ser
  comparada com o pipeline de `449`.
- MCP, RAG e IA não são fontes do espelho RD. Eles recebem fatos já escopados
  e não podem criar, completar ou substituir negócios.
- A resolução de conta foi endurecida: um vínculo direto Meta→funil tem
  precedência sobre vínculos antigos apenas por conexão RD. Isso impede que um
  token compartilhado reintroduza funis de outra conta.
- O webhook RD agora falha fechado quando encontra mais de um vínculo ativo
  para o mesmo pipeline, registra o motivo e aguarda reparo/reconciliação; ele
  não escolhe uma associação arbitrária.
- O quadro do CRM informa separadamente o total histórico exibido e quantos
  negócios foram criados no período, evitando interpretar o pipeline completo
  como um relatório de criação.
- A comparação adicional no mesmo funil confirmou `1.179` negócios no histórico
  completo e `24` na etapa `Venda Realizada` tanto no RD Station quanto na
  Growdash. No recorte de criação de setembro, ambos retornam `449` negócios;
  o RD retorna `12` vendas na etapa quando o filtro é por criação. A Growdash
  mantém a métrica financeira por data de fechamento e encontrou `13` nesse
  recorte, por isso o card agora deve ser lido como “ganhas no período de
  fechamento”, não como a contagem da coluna filtrada por criação.
- A regra compartilhada de venda foi corrigida para usar a etapa atual do RD
  quando ela existe e só usar `win=true` em registros legados sem etapa. Isso
  evita contar como venda um negócio reaberto que conserva um flag antigo.

## Prompt master de execução — auditoria integral e reparo seguro

> Audite e corrija o espelho RD Station da Growdash sem inventar dados e sem
> transformar uma sincronização parcial em sucesso. O RD Station é a fonte
> canônica; a Growdash é somente leitura. Preserve a identidade
> `rd_connection_id + rd_deal_id`, o isolamento por workspace/conta/funil e os
> filtros de data civil no timezone da operação.

### Checklist obrigatório

1. Mapear, antes de editar, todos os consumidores de `rd_deals`, `sales`,
   `sync_runs`, `rd_sync_scope_state`, `rd_account_connections`, Edge Functions,
   MCPs, RAGs e agentes. Nenhum consumidor analítico pode ser fonte de verdade.
2. Usar a etapa atual `rd_stage_name` para decidir venda; `win=true` é apenas
   fallback de linha legada sem etapa. Deduplicar por conexão + ID do RD.
3. Paginar o RD até página curta; usar cursor retomável e marcar `partial` em
   qualquer limite, ID ausente, duplicidade, erro ou timeout.
4. Manter o último snapshot em qualquer falha. Não deletar histórico em ciclos
   recentes; reconciliação destrutiva só em backfill explicitamente completo.
5. O webhook deve autenticar segredo, ser idempotente, resolver um único funil,
   registrar tentativa/resultado e não avançar `last_success_at` quando
   `rd-sync-deals` retornar `partial`, `ok=false` ou `success=false`.
6. Nunca chamar `rd_deals.updated_at` de webhook. Sem uma tabela de eventos
   comprováveis, rotular a métrica como “atividade do espelho” e informar a
   limitação na interface.
7. Watermarks de integração devem vir da conexão RD escopada
   (`rd_account_connections.last_success_at`), nunca do último negócio global
   de qualquer cliente/conta.
8. Corrigir diagnósticos para reutilizar a regra canônica e incluir escopo de
   conexão/workspace; divergência deve mostrar contagem, receita, funil e regra
   de data comparados.
9. Conferir pipelines duplicados por conexão + `rd_funnel_id`; não escolher um
   vínculo arbitrariamente e não apagar registros sem confirmação.
10. Executar TypeScript, lint, Vitest, build e `git diff --check`; conferir
    `origin/main`; publicar funções e frontend separadamente; validar no domínio
    autenticado com os mesmos filtros do RD. Relatar evidência de cada camada.

### Resultado desta execução

- `useRDHealthCheck` passou a contar vendas pela etapa canônica, respeitar a data
  de fechamento/transição e deduplicar a identidade do provedor.
- A tela de observabilidade deixou de afirmar que `rd_deals.updated_at` é um
  webhook; ela exibe “Atualizações do espelho RD” e explica a origem real.
- O status global de RD usa o watermark `last_success_at` das conexões visíveis,
  evitando “Nunca sincronizado” causado por um negócio de outra conta.
- `sync-rd-crm` agora preserva o watermark anterior e responde erro parcial
  quando o sincronizador devolve snapshot incompleto.
- `useRDObservability` deixou de limitar silenciosamente qualidade e atribuição
  aos primeiros 1.000 registros do Data API; as duas leituras agora percorrem
  páginas de 1.000 até uma página curta.

### Pendência que não deve ser mascarada

O repositório não possui uma tabela de eventos de webhook RD. Portanto, até que
uma auditoria de eventos seja criada e implantada, nenhum painel pode afirmar
“webhook recebido em tempo real”; ele deve mostrar atividade do snapshot,
status da conexão e execução do reconciliador. A prova final de tempo real
exige um evento real do RD, seus logs remotos e a linha persistida correspondente.
