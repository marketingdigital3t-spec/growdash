# Incidente do plano de dados Supabase — Meta/RD

Data da verificação: 2026-10-27.

## Observado

O projeto `cixnvosxqlacjbpymjha` responde ao endpoint raiz do Supabase e aparece como `ACTIVE_HEALTHY` na Management API. O status global do Supabase também aparece operacional.

Com chaves válidas do projeto, os seguintes caminhos expiram sem corpo de resposta:

- `auth/v1/settings`;
- `rest/v1/ad_accounts?select=id&limit=1`;
- `functions/v1/sync-meta-insights`;
- `functions/v1/sync-meta-leads`;
- `functions/v1/sync-meta-hourly`;
- `functions/v1/meta-traffic-mcp`.

Sem chave, os endpoints devolvem `401` imediatamente. `rd-sync-deals` alcança o handler e devolve a validação de `funnel_id`, mas não há evidência de leitura autenticada do banco.

Consultas administrativas via `supabase db query --linked` e `supabase inspect db` alternaram entre sucesso e `Connection terminated due to connection timeout`; na verificação final também expiraram. Isso aponta para falha específica do plano de dados, API-key validation, pooler/PostgREST/Auth ou conexões do projeto, e não para divergência entre o código local e o publicado.

## Estado do código

As funções Meta, RD, MCP e RAG usam `supabaseFetch.ts` para limitar consultas internas. O cliente web usa limites de 30 segundos para Data API e 120 segundos para Edge Functions. Os hashes dos arquivos locais e publicados foram comparados e coincidiram.

## Próxima verificação necessária

Quando o plano de dados voltar a responder, executar uma consulta autenticada a `ad_accounts`, uma sincronização Meta, uma sincronização RD, uma chamada MCP e confirmar linhas persistidas e watermarks atualizados. Não considerar HTTP 200, build ou publicação como prova de sincronização.
