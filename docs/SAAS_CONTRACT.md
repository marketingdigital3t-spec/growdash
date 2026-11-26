# Contrato SaaS da Growdash

Versão: 1.0  
Última atualização: 2026-10-14

Este documento é a fonte de contrato para isolamento de clientes, planos e
limites. A interface pode apresentar os planos, mas autorização e consumo de
limites devem ser decididos no banco/servidor.

## Tenancy

- Cada cliente comercial é um `workspace`.
- `workspace_members` é a única relação de acesso de um usuário a um cliente.
- Um usuário só pode ler ou alterar registros do workspace em que é membro
  ativo.
- Integrações, contas de anúncio, CRM, vendas, funis, WhatsApp, arquivos e
  financeiro devem carregar `workspace_id` e aplicar RLS por essa relação.
- `user_id` identifica autoria; não substitui `workspace_id` como escopo de
  tenant.

## Planos

| Código | Preço mensal (BRL) | Contas de anúncio | Usuários | Créditos de IA/mês | Automações | Relatórios WhatsApp/mês | Histórico (meses) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `starter` | 97 | 2 | 2 | 150 | 3 | 100 | 3 |
| `growth` | 197 | 6 | 5 | 600 | 15 | 500 | 12 |
| `scale` | 397 | 15 | 12 | 2.000 | 50 | 2.000 | 24 |
| `agency` | 797 | 40 | 30 | 6.000 | 150 | 6.000 | 36 |

Os valores acima são o catálogo inicial e devem ser alterados apenas por
migration versionada. O checkout deve usar `plan_catalog.code`, nunca o nome
visível do plano.

## Estados de assinatura

- `trialing`: acesso permitido até `trial_ends_at`.
- `active`: acesso permitido até `current_period_ends_at`, quando preenchido.
- `past_due`: acesso bloqueado para novas operações pagas; leitura somente
  poderá ser liberada por uma decisão explícita de produto.
- `paused` e `canceled`: acesso bloqueado.

A decisão efetiva está centralizada em
`public.get_workspace_access_state(workspace_id)`. A interface não deve
autorizar uma operação apenas porque conseguiu carregar o catálogo de planos.

## Quotas

Quotas de consumo mensal usam `workspace_usage_monthly` e o período civil do
workspace (`date_trunc('month', now())` no banco). O consumo é atômico por
workspace, métrica e período através de
`public.consume_workspace_usage(workspace_id, metric, amount)`.

Métricas mensais suportadas no contrato:

- `ai_credits`
- `whatsapp_reports`

Métricas de capacidade são contagens atuais e devem ser verificadas contra o
entitlement antes da criação:

- `ad_accounts`
- `users`
- `automations`
- `storage_bytes`

Uma quota excedida retorna `allowed = false`; não se deve esconder o erro ou
incrementar parcialmente o consumo.

## Cobrança

O checkout e o webhook ainda não fazem parte deste contrato porque dependem do
provedor escolhido. O webhook deverá atualizar somente
`workspace_subscriptions` usando `provider_customer_id` e
`provider_subscription_id`, com idempotência por evento.
