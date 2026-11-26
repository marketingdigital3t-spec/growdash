# Prompt master — auditoria e correção de integrações, dados e CRM

Você é responsável por evoluir a Growdash sem recriar a aplicação e sem alterar
integrações existentes de forma incompatível. Preserve os contratos canônicos:
Meta Ads é fonte de mídia/entrega/ações atribuídas; RD Station é fonte de
negociações, etapas e vendas; vendas financeiras confirmadas são fonte de
faturamento. Nunca transformar ausência em zero nem misturar contas, workspaces,
funis, períodos, timezones ou janelas de atribuição.

## Diagnóstico obrigatório

Audite código, migrations, Edge Functions, RLS, hooks, MCP, leitores de IA,
webhooks e a rota autenticada. Registre arquivos/linhas e se cada achado é
confirmado, risco ou depende de credencial externa. Verifique separadamente:

- OAuth e permissões reais por provedor;
- escopo por workspace/usuário/conta/funil;
- idempotência, assinatura, replay e retries dos webhooks;
- watermarks, locks, snapshots, paginação e falhas parciais;
- origem e cobertura de cada métrica;
- MCP como leitor (nunca como fonte primária dos cards);
- RAG/IA somente com fatos recuperados e fontes explícitas;
- status de conexão distinto de sincronização saudável.

## Contrato de CRM próprio e entrada multicanal

Criar uma camada canônica `crm_leads` por workspace para leads recebidos de
site, formulários, Meta, Google, TikTok e CRMs externos. O contrato mínimo é:

- identidade: `workspace_id`, `source_provider`, `external_id` e chave
  idempotente;
- contato: nome, e-mail, telefone, cidade e estado;
- rastreamento: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
  `utm_term`, `fbclid`, `gclid`, `ttclid`, landing page e referrer;
- operação: status (`new`, `contacted`, `qualified`, `opportunity`, `won`,
  `lost`, `archived`), timestamps de primeiro/último recebimento;
- vínculo opcional validado com conta Meta e IDs de campanha/conjunto/anúncio;
- payload original preservado para auditoria, sem expor segredos.

Adicionar endpoint público `crm-lead-webhook` protegido por endpoint público
aleatório + segredo rotativo, comparação constante, payload limitado, evento
idempotente e atualização de contadores/último recebimento. Adicionar função
autenticada de configuração que gere/revogue o endpoint e mostre o segredo
somente no momento da criação/rotação. Aplicar RLS por workspace e índices para
workspace/status/data e identidade externa.

## Provedores

Manter RD Station e HubSpot funcionais. Não exibir Pipedrive ou qualquer outro
CRM como conectado antes de existir OAuth, leitura, escrita, paginação, refresh,
escopo e teste autenticado. Exibir claramente `Planejado`/`Não configurado`.
Preparar adaptador por contrato para Salesforce, Pipedrive, PipeRun, Agendor,
Kommo, Moskit, Bitrix24, Zoho e ActiveCampaign, mas não simular integração.

## IA, RAG e MCP

MCP deve declarar fonte, escopo, cobertura e timestamp; criar ferramenta de
leitura CRM somente quando ela consultar `crm_leads`/RD com o mesmo contrato.
IA deve ignorar histórico como fonte factual e responder indisponível quando a
cobertura não estiver confirmada. Não chamar conteúdo estático de RAG sem
retrieval real; se embeddings forem adicionados, usar tenant, fonte e citações.

## Validação e entrega

Executar testes de contrato, RLS e idempotência, TypeScript, lint, build e
testes visuais. Conferir `origin/main`, deployment Cloudflare, assets ativos,
Edge Functions e rota autenticada. Separar no relatório: corrigido localmente,
commit/push, publicado e verificado em produção. Nunca declarar os dez CRMs
integrados sem credenciais e testes reais de cada provedor.
