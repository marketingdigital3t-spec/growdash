# Sincronização de métricas Meta Ads + RD Station

## Escopo e fontes

- **Meta Ads** é a fonte oficial de investimento, impressões, cliques e ações atribuídas. A ingestão usa `/{ad_account}/insights`, nível `ad`, `time_increment=1`, `action_report_time=impression` e a janela de atribuição configurada na conta (`account_default` quando não há override).
- **RD Station** é a fonte oficial de negócios, etapas, vendas e receita. A sincronização percorre a paginação da API, persiste por `rd_deal_id` e deduplica por conexão + ID do negócio.
- Todas as datas de seleção são civis em `America/Sao_Paulo` (ou no timezone persistido da conta Meta). A data enviada ao provedor nunca é derivada de `Date#toISOString()` do navegador.

## Caminho de atualização

1. A tela lê primeiro os fatos persistidos (`insights`, `insight_actions` e `rd_deals`) pelo escopo conta + período + atribuição.
2. O `useNearRealtimeSync` atualiza a janela recente em segundo plano a cada cinco minutos e ao recuperar foco. O Realtime invalida apenas as consultas derivadas das tabelas alteradas.
3. O botão **Sincronizar agora** força o período atualmente selecionado, aguarda Meta e RD e invalida as consultas do escopo. O shell mostra `Atualizado às HH:MM` quando o ciclo termina.
4. Para históricos longos, `sync-meta-insights` divide o intervalo em blocos civis mensais, processa até três blocos simultaneamente e drena o cursor de cada bloco. Cada resposta incompleta preserva o snapshot anterior.
5. A pressão `X-App-Usage`/`X-Business-Use-Case-Usage` da Graph API é lida sem registrar o conteúdo do header. Pressão alta e respostas transitórias usam backoff exponencial limitado; não há retry imediato em cascata.

## Cache e validade

O cache persistente é o próprio conjunto de fatos diários no banco, com chave lógica `(ad_account_id, ad_id, date, attribution_window)` para Meta e `(rd_connection_id, rd_deal_id)` para RD. `meta_sync_scope_state`/`rd_sync_scope_state` guardam a cobertura, timezone, janela, status e último snapshot válido. O React Query mantém esses fatos em memória por até 24 horas e os revalida em segundo plano.

Histórico fechado não é apagado por uma falha transitória. O dia corrente é reconsultado pela rotina incremental e pelo botão manual; uma resposta sem linhas só vira zero depois da confirmação completa da API e da persistência.

## Operação

- Para atualizar: selecione a conta e o período e use **Sincronizar agora**.
- Para verificar cobertura: abra **Saúde dos Dados** e confira o bloco Meta/ações, o status da conta e o horário de sucesso.
- Para forçar apenas o ciclo automático, aguarde o próximo intervalo de cinco minutos ou recarregue a rota autenticada.
- Se a Meta retornar OAuth expirado/permissão removida, reconecte a conta em **Integrações → Meta Ads**. Nenhuma métrica é estimada durante a indisponibilidade.

## Limites de verificação

Build e testes locais confirmam o contrato do código, não a conciliação de uma conta real. A tabela de prova só deve ser preenchida após consultar a mesma conta, datas civis, timezone, status `ALL`, janela de atribuição e definição de lead no Gerenciador de Anúncios e no RD Station.
