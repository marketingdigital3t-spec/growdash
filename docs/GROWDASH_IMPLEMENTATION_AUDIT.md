# Growdash — auditoria de implementação

Data: 14/07/2026

O plano de produto e arquitetura que passa a orientar as próximas fases está em [`GROWDASH_MASTER_PRODUCT_PLAN.md`](./GROWDASH_MASTER_PRODUCT_PLAN.md).

## Princípios aplicados

- Preservar Supabase, integrações e dados existentes.
- Nunca preencher módulos com números fictícios.
- Conta Meta, período e segmento são filtros globais persistentes.
- Credenciais permanecem no backend; a interface nunca consulta tokens.
- Escritas em Meta/RD exigem uma ação explícita e confirmação quando alteram campanha.

## Situação atual

| Área | Estado | Fonte |
|---|---|---|
| Autenticação e permissões | Funcional | Supabase Auth + permissões |
| Tema claro/escuro | Funcional | `next-themes`, padrão escuro |
| Filtros globais | Funcional | Conta, período e segmento persistidos |
| Dashboard | Funcional | Insights Meta, vendas e RD |
| Campanhas | Funcional | Campanha → conjunto → anúncio, edição confirmada |
| CRM | Funcional | Negociações e etapas do RD Station |
| Comercial | Funcional | Vendas, produtos e responsáveis RD/campos de venda |
| Análise de funis | Funcional | RD Station, etapas reais e filtros globais |
| Financeiro resumido | Funcional | Meta Insights + vendas + saldo configurado |
| Integrações Meta/RD | Funcional | OAuth/manual Meta e RD server-side |
| Agenda, leads incompletos e saúde | Funcional | Supabase/RD |
| Growdash Flow | Funcional em versão existente | Canvas salvo pela aplicação |
| Automações estilo ManyChat | Pendente | Sem modelo real de fluxo/executor |
| Mídia social Instagram | Pendente | Requer OAuth/permissões e persistência de insights |
| Chamados | Pendente | Requer tabelas, políticas e fluxo de status |
| Marcas multiempresa | Pendente | Requer modelo de tenant e migração de ownership |
| Agentes de IA em toda tela | Parcial | Componentes analíticos existem; faltam franquia, auditoria e contexto global |
| DRE, cartões e conciliação | Pendente | Financeiro atual cobre mídia x faturamento |

## Próximas fases seguras

1. Criar tenant/marca e migrar todas as tabelas para `workspace_id`, com RLS por membership.
2. Implementar DRE, despesas, cartões, comissões e metas configuráveis.
3. Implementar relatório de leads com templates, agendamento e entrega por WhatsApp.
4. Implementar Instagram Graph OAuth e armazenar snapshots de mídia/insights.
5. Implementar automações com versionamento, fila, idempotência e log por execução.
6. Adicionar testes E2E de login, filtros, campanha, RD, exportação e responsividade.

## Critérios de aceite

- Build e testes automatizados sem erro.
- Nenhum token em bundle, localStorage, log ou resposta pública.
- RLS validada para owner, membro e usuário externo.
- Métricas reconciliadas por conta, timezone e período.
- Estado vazio e erro explícitos; nenhum fallback com número mockado.
- Mobile sem overflow não intencional; tabelas usam scroll ou cards.
