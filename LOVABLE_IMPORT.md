# Growdash - Importacao Para Lovable

Este pacote contem o codigo fonte do SaaS Growdash para ser importado no Lovable.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Shadcn UI
- Supabase Auth
- Supabase Database
- Supabase Edge Functions
- React Query
- Lucide Icons

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Variaveis de ambiente necessarias

Crie um arquivo `.env` no Lovable com:

```bash
VITE_SUPABASE_URL=COLE_A_URL_DO_SUPABASE
VITE_SUPABASE_PUBLISHABLE_KEY=COLE_A_ANON_PUBLIC_KEY_DO_SUPABASE
VITE_SUPABASE_PROJECT_ID=COLE_O_PROJECT_ID_DO_SUPABASE
```

Nao coloque service role key no frontend.

## Estrutura importante

- `src/`: frontend React.
- `src/pages/`: telas principais da plataforma.
- `src/components/`: componentes reutilizaveis.
- `src/hooks/`: hooks de dados, RD, Meta, dashboard e permissoes.
- `src/integrations/supabase/`: cliente e tipos Supabase.
- `supabase/functions/`: Edge Functions.
- `supabase/migrations/`: estrutura do banco, RLS e tabelas.

## Rotas principais

- `/auth`
- `/`
- `/campaigns`
- `/funnels`
- `/crm`
- `/commercial`
- `/classes`
- `/leads-incompletos`
- `/alerts`
- `/users`
- `/integrations`
- `/announcements`
- `/automations`
- `/plans`
- `/settings`

## Regras para continuar no Lovable

1. Nao recriar do zero.
2. Nao remover Edge Functions.
3. Nao remover migrations.
4. Nao quebrar o login atual.
5. Nao inventar dados de RD Station ou Meta Ads.
6. Leads devem vir das negociacoes iniciadas no RD Station.
7. Gasto, cliques, impressoes e metricas de midia devem vir da Meta Ads.
8. Receita e vendas devem priorizar RD Station.
9. Manter a identidade visual roxa/glass da Growdash.

## Observacao de seguranca

O arquivo `.env` real nao foi incluido no pacote por conter credenciais. Use apenas chaves publicas `VITE_` no frontend e configure segredos das Edge Functions diretamente no Supabase.
