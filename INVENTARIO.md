# Inventário recuperado da Growdash

## Visão geral

- Dashboard
- CRM
- Comercial

## Inteligência

- Tráfego Pago
- Gerenciador avançado de campanhas
- Análise de Funis
- IA do Funil
- Alertas
- Automações
- Growdash Flow
- Análise de Mídia Social

## Operação

- Agenda & Turmas
- Leads incompletos
- Kanban
- Chamados

## Gestão

- Financeiro
- Anúncios
- Marcas
- Produtos

## Administração

- Integrações
- Usuários
- Agentes
- Configurações
- Saúde dos Dados

## Módulos históricos funcionais preservados

- Dashboard completo e widgets editáveis
- Campanhas, conjuntos, anúncios e métricas
- Funis e negociações do RD Station
- Alertas de campanha, orçamento e saldo
- Eventos, capacidade e membros de turmas
- Auditoria de leads incompletos
- Reconciliação e validação Meta/RD
- Produtos, vendas e atribuição de receita
- Configurações de integração, UTM, métricas e regras
- Usuários e permissões por conta/funil

## Backend recuperado

- 75 migrations do Supabase
- 23 Edge Functions
- sincronização Meta: insights, leads, pixels, saldo, hourly e transações
- sincronização RD: CRM, deals, funis, campos, estados e reconciliação
- diagnóstico: duplicidades, divergência de receita e validação de totais
- IA: `ask-ai`

## Estado dos dados

Os módulos históricos usam os hooks e o cliente Supabase recuperados. Algumas
áreas novas da navegação possuem conteúdo demonstrativo e precisam ser ligadas
às consultas reais antes de uma publicação.
