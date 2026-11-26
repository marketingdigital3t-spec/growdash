# Growdash — configuração do projeto

Este repositório contém o código-fonte do SaaS Growdash e é independente de construtores visuais externos.

## Stack

- React, TypeScript e Vite
- Tailwind CSS e componentes Shadcn UI
- Supabase Auth, Database e Edge Functions
- React Query e Lucide Icons

## Execução

```bash
npm install
npm run dev
npm run build
```

## Variáveis públicas do frontend

```bash
VITE_SUPABASE_URL=COLE_A_URL_DO_SUPABASE
VITE_SUPABASE_PUBLISHABLE_KEY=COLE_A_CHAVE_PUBLICA_DO_SUPABASE
VITE_SUPABASE_PROJECT_ID=COLE_O_PROJECT_ID_DO_SUPABASE
```

Nunca coloque `service_role` ou tokens privados em variáveis `VITE_`.

## Segredos das Edge Functions

Configure no ambiente seguro do Supabase:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=...
AI_MODEL=gpt-4.1-mini
```

Tokens da Meta, RD Station, WhatsApp e demais provedores devem permanecer somente no backend.

## Estrutura

- `src/`: frontend React.
- `src/pages/`: telas principais.
- `src/components/`: componentes reutilizáveis.
- `src/hooks/`: acesso a dados, RD, Meta, dashboard e permissões.
- `src/integrations/supabase/`: cliente e tipos Supabase.
- `supabase/functions/`: Edge Functions.
- `supabase/migrations/`: estrutura do banco, RLS e tabelas.

## Regras de manutenção

1. Preservar autenticação, Edge Functions, migrations e RLS.
2. Não inventar métricas de RD Station ou Meta Ads.
3. Leads e etapas comerciais devem respeitar a origem do RD Station.
4. Gasto, cliques, impressões e mídia devem respeitar a origem da Meta Ads.
5. Receita e vendas devem manter origem e atribuição explícitas.
6. Preservar a navegação independente entre campanhas, conjuntos e anúncios.
7. Manter identidade visual e componentes nativos da Growdash.

