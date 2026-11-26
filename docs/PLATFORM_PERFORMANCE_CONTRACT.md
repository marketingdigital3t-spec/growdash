# Contrato de performance e confiabilidade

## Escopo

`platform_performance_events` registra apenas duração e estado de navegação no
navegador. O evento não contém payload de API, token, identificador de lead ou
resposta de Meta/RD.

## Eventos permitidos

| `metric_name` | Semântica | Origem |
| --- | --- | --- |
| `navigation` | tempo total da navegação inicial e TTFB em `metadata` | Navigation Timing API |
| `route_commit` | tempo até o commit do módulo após uma mudança de rota | React Router |
| `api_batch` | resumo das entradas de recurso do Supabase observadas na rota | Resource Timing API |

Todo evento carrega `workspace_id` (quando disponível), `user_id`, rota,
`duration_ms`, `status` e `created_at`. A leitura é limitada ao próprio usuário,
ao workspace ativo ou a um master por RLS.

## Frescor dos dados

Os indicadores de dados não são inferidos pela telemetria do navegador. Eles
usam os watermarks canônicos de `meta_sync_scope_state` e
`rd_sync_scope_state`:

- `fresh`: último sucesso há até 15 minutos;
- `stale`: último sucesso entre 15 e 60 minutos;
- `degraded`: a execução mais recente está parcial, falhou ou há erro;
- `no_data`: não existe watermark para o escopo consultado.

Um estado `fresh` significa que o snapshot oficial foi confirmado dentro da
janela indicada; não significa que Meta ou RD fornecem streaming instantâneo.

## RAG e MCP

O MCP de tráfego e o fluxo RAG/IA são leitores. Eles recebem somente fatos já
persistidos e devem carregar no contexto a conta, o período civil, o fuso, a
janela de atribuição, a cobertura e a origem. Um dado ausente permanece
`null`/indisponível; a camada de IA não pode transformar ausência de cobertura
em zero. Nenhuma função de IA ou MCP pode avançar watermark, sincronizar
provedor ou substituir o snapshot canônico.
