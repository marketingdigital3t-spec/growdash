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
