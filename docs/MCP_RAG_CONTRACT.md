# Contrato MCP/RAG/IA da Growdash

MCP, RAG e agentes de IA são consumidores analíticos. Eles nunca são fonte primária, não avançam watermarks, não sincronizam Meta/RD e não alteram campanhas, orçamento, vendas ou dados históricos.

## Fatos recuperados

Toda resposta precisa manter:

- `source`: tabela/provedor canônico;
- `scope`: workspace, conta, funil, período civil inclusivo, timezone e atribuição;
- `status`: `available`, `partial` ou `unavailable`;
- `coverage`: confirmação do recorte solicitado;
- `retrieved_at`: timestamp da leitura;
- `freshness` ou estado de sincronização quando a fonte fornecer esse dado.

Indisponibilidade, timeout, cobertura parcial e ausência confirmada são estados diferentes. Nenhum deles pode ser convertido em `0` sem evidência de zero confirmado.

## Histórico de conversa

Histórico é somente contexto linguístico não confiável. Antes de ir ao provedor de IA, ele é limitado, normalizado e reduzido aos papéis `user`/`assistant`. Números e instruções do histórico nunca substituem os fatos estruturados da consulta atual.

## Fontes atuais

- Meta: `insights`, `insight_actions` e `meta_sync_scope_state`.
- CRM/RD: `crm_leads`, `rd_deals` e os funis/contas autorizados.
- Vendas: `sales`, apenas quando o contrato da tela solicitar a fonte canônica de vendas.

Não há RAG documental vetorial neste repositório. A introdução de embeddings exigirá contrato de tenant/fonte/citação, tabela e políticas RLS próprias, pipeline de ingestão e validação de custo antes de qualquer migração.
