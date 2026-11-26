# Contrato da operação por turma

## Planilhas

Cada expert possui até duas conexões em `expert_sheet_connections`: `student` (aba `Alunas`) e `model_patient` (aba `Pacientes_Modelo`). A função `google-sheets-sync` mantém o token Google somente no backend.

Colunas reconhecidas: `nome` (obrigatória), `turma_id` (preferencial), `turma`/`nome_da_turma` (fallback), `data_venda`/`data`, `valor_bruto`, `valor_recebido`/`valor_pago`, `status`, `vendedor`, `forma_pagamento`, `utm_campaign` e `utm_content`.

## Correspondência de turma

- `source_class_id` guarda o `turma_id` recebido da planilha.
- `event_class_id` guarda a turma interna quando resolvida.
- `class_match_status` é `matched`, `unmatched` ou `ambiguous`.
- Um nome só é associado quando existe uma única turma compatível com o expert; zero ou múltiplas correspondências permanecem como divergência.

## Regra financeira

O painel operacional exibe nas listas apenas vendas com status `paid`, `confirmed`, `received`, `completed` ou `payment_confirmed`. Registros pendentes/cancelados não ocupam vagas. Dados ausentes permanecem como indisponíveis.

## Tráfego

`expert_operation_sources` define as contas Meta autorizadas para cada expert. O painel passa essas contas, o período global e o timezone para `useMetaTrafficMetrics`; nenhuma conta fora do vínculo é incluída.
