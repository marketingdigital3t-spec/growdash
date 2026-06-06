# GrowthOS AI

SaaS de growth, performance e operacao comercial com dashboard em tempo real, integracoes de midia/CRM, configuracao de marca, IA operacional e controle de permissoes por usuario.

## Onde Esta Cada Parte

- Front-end: `src/`
- Telas principais: `src/pages/`
- Componentes reutilizaveis: `src/components/`
- Hooks de dados: `src/hooks/`
- Cliente Supabase: `src/integrations/supabase/client.ts`
- Tipos do banco: `src/integrations/supabase/types.ts`
- Banco de dados e policies: `supabase/migrations/`
- Edge Functions/back-end serverless: `supabase/functions/`
- Configuracao Supabase local: `supabase/config.toml`
- Variaveis de ambiente de exemplo: `.env.example`

## Stack

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Supabase Auth, Postgres, RLS e Edge Functions
- Integrações com Meta Ads, RD Station e canais comerciais via APIs

## Rodar Localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha `.env` com as chaves reais do Supabase. Nunca envie `.env` para o GitHub.

## Banco De Dados

A base esta no Supabase. A estrutura versionada fica em `supabase/migrations/`.

O projeto Supabase atual aparece em `supabase/config.toml` como:

```toml
project_id = "tpseftxktzhwthekydac"
```

Para producao, mantenha as migrations no GitHub e aplique no ambiente Supabase usando Supabase CLI ou pelo painel do Supabase.

## Publicar No GitHub

O projeto ja esta em um repositorio Git local. Antes de subir:

```bash
git status
git add .
git commit -m "Prepare GrowthOS AI for production"
```

Depois crie um repositorio privado no GitHub e conecte o remoto:

```bash
git remote add origin git@github.com:SEU_USUARIO/NOME_DO_REPO.git
git branch -M main
git push -u origin main
```

Recomendacao: mantenha o repositorio privado enquanto existirem integracoes, tokens, dados de clientes e regras de negocio sensiveis.

## Deploy E Dominio

Opcoes recomendadas:

- Vercel: melhor caminho para Vite/React, preview automatico por PR e dominio simples.
- Netlify: bom para site estatico com CI simples.
- Cloudflare Pages: boa opcao para performance global e protecao na borda.

Deploy na Vercel:

1. Conecte o repositorio GitHub.
2. Defina o root directory como este projeto.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Configure as variaveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`.
6. Aponte o dominio em Vercel > Project > Domains.

## Seguranca

- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no front-end.
- Tokens da Meta, RD, WhatsApp e outros provedores devem ficar apenas no back-end/Edge Functions.
- Use RLS em todas as tabelas com dados de usuario, contas, vendas, leads e campanhas.
- Use permissoes por perfil e por conta vinculada.
- Criptografe tokens de API salvos no banco ou use Supabase Vault quando possivel.
- Edge Functions sensiveis devem validar JWT e checar permissao do usuario antes de executar.
- Use HTTPS, dominio confiavel, CSP, logs de auditoria e rotacao periodica de tokens.

## Validacao

```bash
npm run build
npm run lint
```

Se uma integracao falhar, valide primeiro variaveis de ambiente, RLS, permissao do usuario e logs da Edge Function no Supabase.
