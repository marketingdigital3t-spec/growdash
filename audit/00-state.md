# Estado Real do Backend — Growdash

Data do levantamento: 2026-11-05
Auditor: Claude Opus 5 (Engenheiro Principal)
Status: Gate da Fase 1 Concluído

---

## 1. Stack Técnica Confirmada

- **Runtime do Frontend:** React 18 / Vite 8.2 / TailwindCSS / Radix UI / Cloudflare Pages
- **Runtime do Backend/Edge:** Deno (Supabase Edge Functions, ~55 funções ativas)
- **Banco de Dados:** PostgreSQL 15+ hospedado no Supabase (projeto `cixnvosxqlacjbpymjha`), schema `public` com 286 migrations versionadas
- **Autenticação:** Supabase GoTrue (Email/Password, Google OAuth, Apple/iCloud)
- **Storage:** Supabase Storage (buckets de relatórios, mídias e criativos)
- **Camada de IA:** OpenAI API (GPT-4 / GPT-4.1-mini) via Edge Functions + Protocolo MCP (`meta-traffic-mcp`) + RAG relacional (injeção estruturada de contexto via SQL no system prompt)
- **Integrações Externas:** Meta Graph API (Marketing API), RD Station CRM API, WhatsApp Cloud API / WAHA, Google Workspace (Drive, Gmail, Sheets), HubSpot CRM, Instagram Graph API
- **Observabilidade:** Sentry (Deno SDK nas Edge Functions e Browser SDK no frontend), tabela de auditoria `sync_execution_runs` e `job_runs`

---

## 2. Ambientes e Segregação

- **Produção:** 
  - Frontend: `https://growdash.com.br` (Cloudflare Pages, project `growdash`)
  - Supabase Project: `cixnvosxqlacjbpymjha` (`https://cixnvosxqlacjbpymjha.supabase.co`)
  - Database Hostinger SDR (legado/híbrido): `srv1671115` (`2.24.99.35`), schema `sdr` em migração
- **Staging / Preview:**
  - Cloudflare Pages Preview URLs (`https://<hash>.growdash.pages.dev`)
  - Supabase Branching: NÃO configurado (todas as Edge Functions e migrations apontam diretamente para o projeto de produção)
- **Desenvolvimento Local:**
  - `npm run dev` (Vite na porta 8080/8081)
  - Variáveis em `.env` apontam para o Supabase de PRODUÇÃO (`cixnvosxqlacjbpymjha`). **RISCO: Não há segregação de banco entre local e produção**.

---

## 3. Matriz de Variáveis de Ambiente (Edge Functions Deno)

| Variável | Onde é Usada | Presente em `.env.example`? | Validação de Schema no Boot? |
|---|---|---|---|
| `SUPABASE_URL` | Todas as funções | Sim | Parcial (fallback para Deno.env) |
| `SUPABASE_ANON_KEY` | Autenticação de caller | Sim | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas | Sim | Não |
| `AI_API_URL` | `ask-ai`, `agent-office-chat` | Sim | Não |
| `AI_API_KEY` | `ask-ai`, `agent-office-chat` | Sim | Não |
| `AI_MODEL` | `ask-ai`, `agent-office-chat` | Sim | Não |
| `OPENAI_API_KEY` | `whatsapp-agent-reply`, `traffic-agent-analyze` | Não | Não |
| `META_APP_ID` | `meta-oauth-start`, `meta-oauth-callback` | Não | Não |
| `META_APP_SECRET` | `meta-oauth-callback`, `meta-webhook` | Não | Não |
| `META_GRAPH_API_VERSION` | `meta-oauth-callback`, `sync-meta-*` | Não | Não |
| `META_WEBHOOK_VERIFY_TOKEN` | `meta-webhook` | Não | Não |
| `WHATSAPP_APP_SECRET` | `whatsapp-webhook` | Sim | Não |
| `WHATSAPP_VERIFY_TOKEN` | `whatsapp-webhook` | Não | Não |
| `WAHA_BASE_URL` | `whatsapp-waha-*` | Não | Não |
| `WAHA_API_KEY` | `whatsapp-waha-*` | Não | Não |
| `GOOGLE_OAUTH_CLIENT_ID` | `google-workspace-oauth-*` | Não | Não |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `google-workspace-oauth-*` | Não | Não |
| `HUBSPOT_CLIENT_ID` | `hubspot-oauth-*` | Não | Não |
| `HUBSPOT_CLIENT_SECRET` | `hubspot-oauth-*` | Não | Não |
| `CRON_SECRET` | Funções de reconciliação e sync | Não | Não |
| `SENTRY_DSN` | Todas as funções | Sim | Não |

---

## 4. Mapeamento dos 9 Fluxos Críticos (arquivo:linha)

### a) Cadastro e Login (incluindo OAuth)
- **Frontend Trigger:** [src/pages/Auth.tsx:49](src/pages/Auth.tsx:49) (`supabase.auth.signInWithPassword({ email, password })`)
- **OAuth Trigger:** [src/pages/Auth.tsx:110](src/pages/Auth.tsx:110) (`supabase.auth.signInWithOAuth({ provider, options })`)
- **Admin User Creation:** [supabase/functions/admin-create-user/index.ts:31](supabase/functions/admin-create-user/index.ts:31) (`supabaseAdmin.auth.admin.createUser`)
- **OAuth Start (Meta):** [supabase/functions/meta-oauth-start/index.ts:40](supabase/functions/meta-oauth-start/index.ts:40) (Geração de `state`, URL de autorização)
- **OAuth Callback (Meta):** [supabase/functions/meta-oauth-callback/index.ts:40](supabase/functions/meta-oauth-callback/index.ts:40) (Troca de `code` por token de curta duração e exchange por `long_lived_token`)

### b) Recuperação e Troca de Senha
- **Solicitação de Reset:** [src/pages/Auth.tsx:88](src/pages/Auth.tsx:88) (`supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`)
- **Listener de Redirecionamento:** [src/pages/ResetPassword.tsx:23](src/pages/ResetPassword.tsx:23) (`supabase.auth.onAuthStateChange((event) => ...)`)
- **Atualização da Senha:** [src/pages/ResetPassword.tsx:43](src/pages/ResetPassword.tsx:43) (`supabase.auth.updateUser({ password })`)

### c) Criação de Sessão, Refresh de Token, Logout e Invalidação
- **Inicialização de Sessão:** [src/contexts/AuthContext.tsx:55](src/contexts/AuthContext.tsx:55) (`supabase.auth.getSession()`)
- **Listener de Sessão:** [src/contexts/AuthContext.tsx:84](src/contexts/AuthContext.tsx:84) (`supabase.auth.onAuthStateChange`)
- **Refresh de Token:** [src/hooks/useMetaOAuth.ts:35](src/hooks/useMetaOAuth.ts:35) e [src/hooks/useSyncMeta.ts:47](src/hooks/useSyncMeta.ts:47) (`supabase.auth.refreshSession()`)
- **Logout (SignOut):** [src/contexts/AuthContext.tsx:151](src/contexts/AuthContext.tsx:151) (`supabase.auth.signOut()`)

### d) Conexão de Integração Externa (OAuth Meta, Claude Opus 5, CRM)
- **Meta Start:** [supabase/functions/meta-oauth-start/index.ts:25](supabase/functions/meta-oauth-start/index.ts:25)
- **Meta Callback:** [supabase/functions/meta-oauth-callback/index.ts:30](supabase/functions/meta-oauth-callback/index.ts:30)
- **Google Workspace Start:** [supabase/functions/google-workspace-oauth-start/index.ts:20](supabase/functions/google-workspace-oauth-start/index.ts:20)
- **Google Workspace Callback:** [supabase/functions/google-workspace-oauth-callback/index.ts:25](supabase/functions/google-workspace-oauth-callback/index.ts:25)
- **HubSpot Start:** [supabase/functions/hubspot-oauth-start/index.ts:20](supabase/functions/hubspot-oauth-start/index.ts:20)
- **HubSpot Callback:** [supabase/functions/hubspot-oauth-callback/index.ts:25](supabase/functions/hubspot-oauth-callback/index.ts:25)
- **Instagram Start:** [supabase/functions/instagram-oauth-start/index.ts:20](supabase/functions/instagram-oauth-start/index.ts:20)
- **Instagram Callback:** [supabase/functions/instagram-oauth-callback/index.ts:25](supabase/functions/instagram-oauth-callback/index.ts:25)

### e) Ingestão de Dados de Campanhas
- **Sincronização Agendada (pg_cron):** `public.daily_incremental_sync_runs` acionada via pg_cron às 03:00 UTC
- **Insights Diários Meta:** [supabase/functions/sync-meta-insights/index.ts:120](supabase/functions/sync-meta-insights/index.ts:120) (Consulta à Graph API `/{ad_account_id}/insights`)
- **Leads Meta:** [supabase/functions/sync-meta-leads/index.ts:110](supabase/functions/sync-meta-leads/index.ts:110) (Busca de formulários e webhooks)
- **Controle de Concorrência e Lock:** [supabase/functions/controlled-realtime-sync/index.ts:45](supabase/functions/controlled-realtime-sync/index.ts:45) (Garante que só uma sync execute por escopo)
- **Reconciliação e Deduplicação:** [supabase/functions/daily-reconciliation/index.ts:50](supabase/functions/daily-reconciliation/index.ts:50)

### f) Execução de Agente de IA
- **Chat com Agentes do Escritório:** [supabase/functions/agent-office-chat/index.ts:30](supabase/functions/agent-office-chat/index.ts:30) (Valida caller, busca fatos no banco e monta prompt)
- **Orquestrador de Agentes:** [supabase/functions/agent-office-orchestrator/index.ts:40](supabase/functions/agent-office-orchestrator/index.ts:40) (Distribui tarefas para Atlas, Fina, Dora, Otto, Nina, Milo)
- **Assistente Global (Ask AI):** [supabase/functions/ask-ai/index.ts:180](supabase/functions/ask-ai/index.ts:180) (Valida cobertura de dados Meta/RD antes de responder)
- **Agente WhatsApp (Mariana / Dra. Ranniely):** [supabase/functions/whatsapp-agent-reply/index.ts:65](supabase/functions/whatsapp-agent-reply/index.ts:65) (Carrega knowledge JSON e regras de handoff)

### g) Consulta RAG (Recuperação e Montagem de Contexto)
- **Mecanismo:** RAG Relacional Determinístico (sem base vetorial / pgvector)
- **Retrieval de Fatos Analíticos:** [supabase/functions/ask-ai/index.ts:200-380](supabase/functions/ask-ai/index.ts:200) (Queries SQL nas tabelas `meta_insights_daily`, `action_totals_daily`, `sales`, `rd_deals`)
- **Montagem do Contexto Factual:** [supabase/functions/ask-ai/index.ts:389-460](supabase/functions/ask-ai/index.ts:389) (Serialização do JSON de fatos e gaps de sincronização)
- **Knowledge Retrieval de WhatsApp:** [supabase/functions/whatsapp-agent-reply/index.ts:67-75](supabase/functions/whatsapp-agent-reply/index.ts:67) (Leitura do objeto `whatsapp_agents.knowledge.content`)

### h) Chamada MCP (Model Context Protocol)
- **Servidor MCP de Tráfego:** [supabase/functions/meta-traffic-mcp/index.ts:35](supabase/functions/meta-traffic-mcp/index.ts:35)
- **Contrato de Tools e Cursors:** [supabase/functions/_shared/mcpContract.ts:1-120](supabase/functions/_shared/mcpContract.ts:1)
- **Tools Expostas:** `get_campaign_performance`, `list_leads_with_attribution`, `get_ad_creatives`, `get_account_balance`
- **Validação de Tenant / Authorization:** [supabase/functions/meta-traffic-mcp/index.ts:45](supabase/functions/meta-traffic-mcp/index.ts:45) (Exige Bearer token e valida `workspace_id`)

### i) Cobrança e Billing
- **Estado Atual:** NÃO IMPLEMENTADO (módulo em desenvolvimento / mockado)
- **Evidência no Código:** [src/App.tsx:310](src/App.tsx:310) renderiza `<BusinessUnavailablePage title="Cobrança e pagamentos" description="Saldo, aportes e transações oficiais serão consultados e exibidos aqui, separados das métricas de campanha." />`
- **Tabela de banco associada:** `workspace_subscriptions` e `financial_invoices` (apenas schema e formulário público de nota fiscal em [src/pages/PublicInvoiceForm.tsx](src/pages/PublicInvoiceForm.tsx))
