# Growdash — Plano Mestre de Produto e Arquitetura

Versão: 1.0  
Data: 14/07/2026  
Status: base oficial para as próximas implementações

## 1. Visão do produto

A Growdash será um **sistema operacional de crescimento** para gestores de tráfego, infoprodutores, operações SaaS e agências. Ela não deve ser somente um painel que copia números de outras ferramentas. O valor central será:

1. Conectar mídia, CRM, receita, despesas e IA.
2. Reconciliar dados e explicar divergências.
3. Transformar métricas em decisões e tarefas.
4. Permitir ações controladas nas plataformas conectadas.
5. Separar com rigor operações de Infoproduto e SaaS.

### Princípios inegociáveis

- Nenhum KPI demonstrativo em ambiente real.
- Credenciais nunca expostas ao navegador.
- Toda métrica mostra fonte, período, timezone e última sincronização.
- Toda ação externa crítica exige confirmação, auditoria e possibilidade de rastrear quem executou.
- IA recomenda; alterações de orçamento, campanha, CRM ou financeiro exigem aprovação humana por padrão.
- Módulos premium devem reduzir esforço operacional, não apenas aumentar quantidade de telas.

## 2. As três dimensões que não podem ser confundidas

### 2.1 Modo de negócio

O alternador **Infoproduto / SaaS** define qual operação está sendo analisada. Ele muda contas, dashboards, métricas e regras de negócio.

### 2.2 Plano contratado

Starter, Growth, Scale ou Agency definem franquias, usuários, quantidade de conexões, armazenamento e uso de IA/automações.

### 2.3 Integrações

São os provedores externos conectados ao workspace: Meta, Google Ads, TikTok Ads, RD Station, HubSpot, Pipedrive, OpenAI, Anthropic, WhatsApp, Stripe etc.

## 3. Arquitetura multiempresa e multissegmento

Antes de ampliar integrações, criar a fundação multiempresa:

```text
Usuário
  └── Membership
       └── Workspace (cliente/empresa)
            ├── Business unit: Infoproduto
            │    ├── marcas
            │    ├── contas de mídia
            │    ├── CRMs/funis
            │    └── dashboard/layout/metas
            └── Business unit: SaaS
                 ├── produtos/planos
                 ├── contas de mídia
                 ├── billing/subscriptions
                 └── dashboard/layout/metas
```

### Entidades-base

- `workspaces`: empresa pagante.
- `workspace_members`: usuário, função e status.
- `business_units`: `infoproduct` ou `saas`.
- `brands`: marca/produto dentro de uma unidade.
- `user_profiles`: dados pessoais não sensíveis.
- `workspace_preferences`: timezone, moeda, idioma e tema padrão.
- `workspace_entitlements`: limites efetivos do plano.

Todas as tabelas de negócio passam a ter `workspace_id`. Quando aplicável, também terão `business_unit_id`, `brand_id` e `external_account_id`.

### Regra do alternador Infoproduto/SaaS

- Persistir `business_unit_id`, não apenas uma string visual.
- A lista de contas só mostra contas vinculadas à unidade ativa.
- Dashboard e visualizações salvas são independentes por unidade.
- Nenhuma consulta pode combinar segmentos sem o usuário escolher “Consolidado”.
- O modo consolidado será exclusivo de owner/financeiro e mostrará claramente que soma operações distintas.

## 4. Central de Integrações

### 4.1 Navegação superior

A página `/integracoes` terá abas horizontais:

1. **Tráfego pago**
2. **CRM & Vendas**
3. **IA**
4. **Mensageria & Automação**
5. **Pagamentos & Checkout**
6. **Arquivos & Produtividade**
7. **API, Webhooks & MCP**
8. **Saúde & Logs**

No mobile, as abas usam scroll horizontal com indicador de posição. Nunca devem quebrar em duas linhas ou sair da tela.

### 4.2 Padrão de cada card de integração

Cada provedor terá:

- Logotipo, nome, categoria e descrição curta.
- Estado: disponível, conectando, conectado, atenção, token expirado ou erro.
- Quantidade de recursos importados.
- Última sincronização e próxima execução.
- Botões: Conectar/Gerenciar, Sincronizar, Diagnóstico, Logs e Desconectar.
- Escopos autorizados e proprietário da conexão.
- Unidade/brand associada.
- Indicador somente leitura ou leitura/escrita.

Ao abrir um provedor, usar painel lateral ou página de detalhe com as subabas **Visão geral**, **Recursos**, **Mapeamento**, **Sincronização**, **Permissões** e **Logs**.

### 4.3 Tráfego pago

#### Fase 1

- Meta Ads.
- Google Ads.
- TikTok Ads.

#### Fase 2

- LinkedIn Ads.
- Pinterest Ads.
- Kwai Ads, condicionado à disponibilidade e aprovação da API.
- Microsoft Ads.

#### Recursos comuns

- OAuth oficial como fluxo principal.
- Conexão avançada por token apenas para owner e casos legados.
- Importar contas, campanhas, grupos/conjuntos, anúncios, criativos e insights.
- Normalizar hierarquia em `ad_platform_accounts`, `ad_campaigns`, `ad_groups`, `ad_items` e `ad_insights_daily`.
- Preservar payload original em JSONB para auditoria e novos campos.
- Mapear moeda, timezone, attribution window e ação de conversão por conta.
- Sincronização incremental do dia e backfill histórico em fila.
- Escrita desabilitada até o usuário conceder escopo de gestão.

A Meta continuará usando a Marketing API oficial, com permissões separadas para leitura e gestão e revisão do aplicativo quando exigida. [Meta Marketing APIs](https://developers.facebook.com/docs/marketing-apis/)

Google Ads exige projeto, OAuth e developer token, e organiza os recursos em cliente → campanha → grupo → anúncio; sua API permite consulta e mutações. A Growdash deve adaptar essa hierarquia ao modelo canônico sem fingir que é idêntica à Meta. [Documentação oficial do Google Ads](https://developers.google.com/google-ads/api/docs/concepts/api-structure)

A Marketing API do TikTok permite consultar relatórios e gerenciar campanhas/anúncios; a conexão deve ser registrada como adaptador independente. [TikTok API for Business](https://business-api.tiktok.com/gateway/docs/index?identify_key=c0138ffadd90a955c1f0670a56fe348d1d40680b3c89461e09f78ed26785164b&language=ENGLISH)

### 4.4 CRM & Vendas

Recomendação inicial para o público brasileiro da Growdash:

1. **RD Station CRM** — prioridade nacional e integração já existente.
2. **HubSpot** — forte ecossistema, contatos, empresas, deals, pipelines e propriedades.
3. **Pipedrive** — excelente aderência comercial, deals, pipelines, estágios e atividades.

“Melhores” aqui significa melhor combinação de mercado-alvo, qualidade de API e utilidade para a Growdash; não é um ranking universal.

#### Modelo canônico

- `crm_connections`
- `crm_pipelines`
- `crm_stages`
- `crm_contacts`
- `crm_organizations`
- `crm_deals`
- `crm_activities`
- `crm_owners`
- `crm_custom_fields`

Cada registro mantém `provider`, `external_id`, `raw_payload`, `source_updated_at` e `synced_at`.

RD CRM v2 usa OAuth2 e tokens com renovação; a documentação informa expiração de duas horas, portanto refresh automático e bloqueio de concorrência são obrigatórios. [Autenticação RD Station CRM](https://developers.rdstation.com/reference/crm-v2-authentication)

HubSpot deve usar OAuth e escopos mínimos por objeto. [OAuth do HubSpot](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide)

Pipedrive deve usar OAuth2 para uma integração distribuída e oferece deals com valor, proprietário, estágio e campos personalizados. [OAuth Pipedrive](https://developers.pipedrive.com/docs/api/v1/Oauth) · [Deals Pipedrive](https://developers.pipedrive.com/docs/api/v1/Deals)

### 4.5 Provedores de IA

Provedores iniciais:

- OpenAI.
- Anthropic Claude.
- Google Gemini.
- OpenRouter ou endpoint compatível, apenas como opção avançada.

#### Dois modelos de consumo

1. **IA gerenciada pela Growdash**: consumo incluído na franquia do plano.
2. **BYOK**: cliente conecta a própria chave e paga diretamente ao provedor.

O workspace escolhe provedor/modelo por função: chat, resumo, análise profunda, visão e geração de relatório. Não expor nomes fixos de modelos na lógica da aplicação; usar um catálogo atualizado no backend.

#### Gateway interno

Toda chamada passa por `ai-gateway`:

- autentica workspace e entitlement;
- seleciona provedor/modelo;
- aplica limite de entrada e saída;
- remove/mascara PII quando possível;
- registra custo estimado, latência e uso;
- aplica retry, timeout e circuit breaker;
- valida saída estruturada;
- usa fallback somente quando autorizado;
- guarda prompt versionado e contexto utilizado.

Chaves devem ficar em secret manager/servidor, nunca no bundle ou repositório, conforme a recomendação oficial da OpenAI. [OpenAI — API keys em produção](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys)

Anthropic também recomenda secret manager, rotação e revogação de chaves, oferecendo Workload Identity Federation para cargas de produção compatíveis. [Autenticação Claude](https://platform.claude.com/docs/en/manage-claude/authentication)

#### Franquias obrigatórias

- Nenhum plano terá IA ilimitada.
- Medir `input_tokens`, `output_tokens`, chamadas, relatórios, imagens e custo interno.
- Alertas em 70%, 90% e 100%.
- Ao atingir 100%: comprar pacote, usar BYOK ou aguardar renovação.
- Limites adicionais por minuto para impedir abuso.

### 4.6 Mensageria & Automação

- WhatsApp Cloud API.
- E-mail transacional.
- Slack/Teams para alertas.
- Webhooks de saída.
- n8n por webhook/API; não expor ou revender a interface sem validar licença comercial/Embed.

Mensagens de marketing do WhatsApp ficam separadas da assinatura. Preferência: cliente paga diretamente o consumo Meta; a Growdash cobra automação, orquestração e franquia operacional.

### 4.7 Pagamentos & checkout

- Stripe Billing para assinatura da Growdash.
- Stripe/Hotmart/Kiwify/Eduzz/Asaas como fontes de receita dos clientes.
- Separar `platform_billing` (o que o cliente paga à Growdash) de `customer_revenue_sources` (vendas do negócio do cliente).

### 4.8 O que sai de Configurações

Transferir para Integrações:

- Conexão OAuth/manual Meta.
- Lista e status de contas Meta.
- Sincronização e backfill Meta.
- Conexão RD.
- Webhook RD.
- Funis RD por conta.
- Campos personalizados RD.
- Diagnóstico, reconciliação, UTM e observabilidade RD.
- Mapeamento de UTM e regras de atribuição.
- Chaves de IA.
- Webhooks, MCP e chaves externas.

Configurações fica apenas com:

- Workspace e identidade visual.
- Idioma, moeda, timezone e formatos.
- Metas e regras gerais.
- Notificações.
- Privacidade e retenção.
- Aparência.
- Preferências do usuário.

## 5. Arquitetura técnica das integrações

### Tabelas

- `integration_providers`
- `integration_connections`
- `integration_credentials` — inacessível a `anon` e `authenticated`.
- `integration_resources`
- `integration_mappings`
- `sync_jobs`
- `sync_cursors`
- `sync_runs`
- `integration_webhook_events`
- `integration_errors`
- `integration_usage_daily`

### Interface de adaptador

```ts
interface IntegrationAdapter {
  authorize(): Promise<AuthResult>;
  refreshCredentials(): Promise<void>;
  discoverResources(): Promise<Resource[]>;
  backfill(range: DateRange): Promise<SyncResult>;
  syncIncremental(cursor?: string): Promise<SyncResult>;
  healthCheck(): Promise<HealthResult>;
  revoke(): Promise<void>;
}
```

### Segurança

- OAuth `state` assinado, nonce de uso único e PKCE quando suportado.
- Callback allowlist exata.
- Tokens criptografados com chave fora do banco.
- Refresh token com lock para evitar renovações concorrentes.
- RLS por `workspace_id` e membership.
- Webhooks com verificação de assinatura e replay protection.
- Jobs idempotentes por `provider + resource + external_id + date`.
- Logs nunca armazenam token, senha ou payload pessoal completo.
- Botão “Testar conexão” sem revelar segredo.
- Desconectar revoga no provedor quando possível e encerra jobs futuros.

## 6. Perfil do usuário

Ao clicar no perfil, abrir menu com:

- Meu perfil.
- Meu workspace.
- Plano e cobrança.
- Preferências.
- Segurança.
- Sair.

### Página Meu perfil

Abas:

1. **Dados pessoais**: nome, sobrenome, telefone, cargo, sexo/gênero opcional, pronome opcional e bio curta.
2. **Foto**: upload com corte, compressão e remoção.
3. **E-mail**: alteração com confirmação no endereço novo e aviso no antigo.
4. **Senha e segurança**: senha atual/reauth, nova senha, sessões ativas, MFA e encerramento de sessões.
5. **Notificações**: e-mail, WhatsApp, in-app e tipos de alerta.
6. **Aparência**: claro, escuro ou sistema; densidade confortável/compacta.

Nunca criar uma coluna de senha em `user_profiles`. Senha e e-mail autenticável continuam no Supabase Auth. Dados de perfil ficam em tabela pública protegida por RLS. A documentação do Supabase recomenda tabela própria referenciada a `auth.users`, com RLS. [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data)

### Papéis

- Owner.
- Admin.
- Gestor de tráfego.
- Comercial.
- Financeiro.
- Analista.
- Leitura.

Permissão deve existir por módulo, unidade, marca, conta e ação. “Pode visualizar campanhas” é diferente de “pode alterar orçamento”.

## 7. Planos e cobrança do SaaS

### Tela Plano e cobrança

- Plano atual, ciclo e próxima cobrança.
- Uso atual versus franquia.
- Upgrade/downgrade.
- Cartão e dados fiscais.
- Faturas.
- Cancelamento e reativação.
- Pacotes adicionais.

### Proposta inicial de entitlements

| Recurso | Starter | Growth | Scale | Agency |
|---|---:|---:|---:|---:|
| Usuários | 2 | 5 | 12 | 30 |
| Unidades/marcas | 1 | 3 | 8 | 25 |
| Contas de mídia | 3 | 10 | 30 | 100 |
| Conexões CRM | 1 | 2 | 5 | 15 |
| Histórico | 6 meses | 18 meses | 36 meses | 60 meses |
| Automações ativas | 3 | 15 | 50 | 200 |
| Execuções/mês | 1.000 | 10.000 | 50.000 | 250.000 |
| Créditos IA/mês | baixo | médio | alto | pool da agência |
| Relatórios agendados | 4 | 30 | 150 | 600 |
| White-label | — | — | opcional | incluído/controlado |
| Suporte | padrão | prioritário | prioritário | onboarding + SLA |

Os números finais devem ser ajustados após medir custo real por sincronização, armazenamento, IA e WhatsApp. Não usar “ilimitado”.

### Modelo de cobrança recomendado

- Mensalidade recorrente.
- Franquia incluída.
- Overage ou pacote pré-pago para IA, automações, armazenamento e relatórios.
- WhatsApp marketing cobrado à parte.
- Add-ons: contas adicionais, usuários, white-label, histórico estendido e onboarding.

Stripe suporta assinatura recorrente, portal do cliente e cobrança por uso com meters/eventos; isso combina com franquia + excedente. [Stripe Subscriptions](https://docs.stripe.com/billing/subscriptions/overview) · [Stripe Usage-Based Billing](https://docs.stripe.com/billing/subscriptions/usage-based/how-it-works)

## 8. Infoproduto e SaaS

### 8.1 Dashboard Infoproduto

KPIs principais:

- Investimento.
- Leads e CPL por tipo.
- Vendas aprovadas, pendentes e reembolsadas.
- Receita bruta/líquida.
- ROAS, ROI, CPA e margem.
- Ticket médio.
- Chargeback e reembolso.
- Conversão lead → oportunidade → venda.
- Receita por produto, campanha, criativo e checkout.

Blocos premium:

- Lançamento versus perpétuo.
- Curva de captação e vendas por dia/hora.
- Criativos vencedores e fadiga.
- Diagnóstico de atribuição.
- Projeção do fechamento da campanha.

### 8.2 Dashboard SaaS

Fontes: billing/checkout, produto, CRM e mídia.

KPIs principais:

- MRR e ARR.
- New MRR, Expansion, Contraction e Churned MRR.
- NRR e GRR.
- Logo churn e revenue churn.
- Trials, ativação e conversão trial → pago.
- Clientes ativos e novos clientes.
- ARPA/ARPU.
- CAC pago e blended.
- LTV e relação LTV:CAC.
- Payback em meses.
- Receita por plano e coorte.
- Inadimplência e recuperação.

Regras:

- MRR não é faturamento recebido: normalizar contratos anuais/mensais.
- Separar cancelamento, inadimplência e downgrade.
- Coortes por mês de aquisição.
- CAC usa mídia + custos de vendas configurados.
- LTV mostra fórmula e premissas.

### 8.3 Configuração das contas

Na integração ou marca, cada conta recebe:

- Unidade: Infoproduto ou SaaS.
- Marca/produto.
- Funil/CRM relacionado.
- Fonte de receita.
- Regras de atribuição.
- Meta de CPL/CAC/ROAS.

Alterar a unidade exige confirmação e reprocessamento; nunca mover silenciosamente.

## 9. Financeiro premium

A página Financeiro terá abas:

1. **Resumo executivo**
2. **DRE**
3. **Lançamentos**
4. **Fluxo de caixa**
5. **Previsão**
6. **Orçamento**
7. **Contas e cartões**
8. **Conciliação**
9. **Centros de custo**
10. **Relatórios**

### 9.1 DRE

- Receita bruta.
- Deduções, taxas, impostos, reembolsos e chargebacks.
- Receita líquida.
- Custos variáveis.
- Margem de contribuição.
- Despesas operacionais por categoria.
- EBITDA gerencial.
- Resultado operacional.
- Resultado líquido.

Permitir regime de caixa e competência, com aviso visível sobre o regime ativo.

### 9.2 Lançamentos

- Receita ou despesa.
- Data de competência e pagamento.
- Categoria/subcategoria.
- Centro de custo.
- Conta/cartão.
- Unidade, marca, produto e campanha.
- Recorrência.
- Anexo/comprovante.
- Status previsto, pago, vencido ou conciliado.
- Importação CSV com pré-visualização e deduplicação.

### 9.3 Fluxo de caixa

- Saldo inicial.
- Entradas/saídas realizadas.
- Contas futuras.
- Saldo diário/semanal/mensal.
- Mínimo de caixa e alertas.

### 9.4 Previsão de 12 meses

Entradas:

- 12 a 24 meses de receita real.
- Investimento de tráfego.
- Despesas fixas e variáveis.
- Sazonalidade por mês/dia.
- Pipeline ponderado do CRM.
- Assinaturas, churn e expansão no modo SaaS.
- Orçamento e lançamentos recorrentes futuros.

Saídas:

- Receita, despesa, investimento e caixa previstos.
- Cenários conservador, base e agressivo.
- Banda de confiança.
- Premissas editáveis.
- Comparação previsto versus realizado.
- Data/modelo da última previsão.

Regras de qualidade:

- Menos de seis meses: mostrar “baixa confiança” e usar média móvel simples.
- De seis a onze meses: tendência sem afirmar sazonalidade anual.
- Doze meses ou mais: tendência + sazonalidade, com backtest.
- Outliers identificados e revisáveis.
- IA explica a previsão, mas o cálculo principal é determinístico e auditável.
- Guardar snapshots para não reescrever o passado.

### 9.5 Orçamento e conciliação

- Planejado versus realizado por categoria/unidade/marca.
- Alertas em 70%, 90% e 100%.
- Conciliação manual inicialmente; Open Finance só após análise regulatória, segurança e parceiro autorizado.

## 10. Correção definitiva de light/dark mode

O problema atual nasce da mistura de tokens semânticos com cores hexadecimais fixas.

### Estratégia

- Um único conjunto semântico: `background`, `surface`, `surface-raised`, `text-primary`, `text-secondary`, `border`, `primary`, `success`, `warning`, `danger`.
- Variáveis diferentes em `.light` e `.dark`.
- Proibir novos `bg-[#...]`, `text-[#...]` e `border-[#...]` em páginas de produto; exceções apenas para logos de provedores.
- Gráficos usam `--chart-1...--chart-n`, tooltip e grid próprios de cada tema.
- Remover sobrescritas locais como temas paralelos em módulos analíticos.
- Usar `resolvedTheme` e evitar render diferente antes da hidratação.
- Persistir preferência por usuário; “sistema” acompanha o sistema operacional.
- Tema aplicado antes do primeiro paint para eliminar flash branco.

### Matriz de QA

Testar todas as rotas em:

- Light e dark.
- 360×800, 390×844, 768×1024, 1280×800 e 1440×900.
- Loading, vazio, erro e com dados.
- Modal, dropdown, tooltip, gráfico, tabela e painel lateral.
- Contraste mínimo WCAG AA para texto e controles.

## 11. Estrutura lateral recomendada

Para manter aparência premium, reduzir itens duplicados. O menu terá grupos recolhíveis e favoritos.

### Visão geral

#### Dashboard

- Resumo executivo por segmento.
- Metas configuráveis.
- Comparação com período anterior.
- Widgets salváveis e explicação de cada métrica.

#### CRM

Subabas: Visão geral, Pipeline/Kanban, Lista, Contatos, Atividades e Qualidade. O item Kanban deixa de ser um item lateral duplicado.

#### Comercial

Subabas: Resumo, Ranking, Vendas, Metas, Comissões e Forecast.

### Aquisição

#### Tráfego pago

Subabas: Campanhas, Conjuntos, Anúncios, Criativos, Orçamento, Contas/BM, Relatórios de leads e IA de tráfego. O item “Anúncios” deixa de ser duplicado em Gestão.

#### Análise de funis

- Conversões, vazamentos, aging, origem, região, horário, vendedor e produto.
- Comparação entre funis e coortes.

#### Mídia social

- Perfis, conteúdo, calendário, insights e relatório.
- Só liberar métricas suportadas oficialmente pelas permissões concedidas.

### Inteligência e automação

#### Copiloto Growdash

- Chat contextual global.
- Seleção explícita de fontes e período.
- Respostas com links para os dados usados.
- Ações sugeridas entram em fila de aprovação.

#### Alertas

- Caixa de entrada, regras, resolvidos, silenciados e histórico.

#### Automações

- Fluxos, templates, execuções, erros e credenciais.
- Editor visual separado do Growdash Flow conceitual.

#### Growdash Flow

- Canvas de planejamento/jornada, templates, versões e colaboração.
- Nós podem exibir métricas, mas não devem executar automações sem um modo publicado explícito.

### Operação

#### Agenda & Turmas

- Calendário, turmas, presença, capacidade, responsáveis e notificações.

#### Leads incompletos

- Causa, completude, origem, recuperação, responsável e impacto financeiro.

#### Chamados

- Inbox, SLA, responsáveis, tags, cliente, histórico e satisfação.

### Gestão

#### Financeiro

- Estrutura descrita na seção 9.

#### Marcas e produtos

- Unidades, marcas, produtos, metas, fontes e responsáveis.

### Administração

#### Integrações

- Central única descrita na seção 4.

#### Usuários e acessos

- Membros, convites, papéis, escopos e histórico.

#### Agentes de IA

- Agentes, versões de prompt, fontes permitidas, franquia, avaliações e logs.

#### Configurações

- Preferências sem credenciais externas.

#### Saúde dos dados

- Cobertura, atraso, duplicidade, divergência, token, webhooks, jobs e reconciliação.

## 12. Aparência premium

- Dourado como acento, não como fundo de todos os elementos.
- Superfícies neutras e contraste alto.
- Tipografia em escala consistente.
- Densidade confortável e compacta.
- Command palette para navegar e executar ações.
- Breadcrumbs em páginas profundas.
- Filtros fixos com chips ativos e botão “Limpar”.
- Views salvas por usuário/equipe.
- Skeleton fiel ao conteúdo, sem tela branca.
- Empty states com causa e próxima ação.
- Painel lateral para detalhes sem perder filtros.
- Tabelas com colunas fixáveis, redimensionáveis, ordenação e exportação.
- No mobile, métricas viram cards; tabelas usam cards ou scroll intencional.
- Exibir “Atualizado há X min”, fonte e timezone próximos da métrica.

## 13. Observabilidade e confiabilidade

- SLO de disponibilidade por integração.
- P95 de carregamento por página.
- Taxa de sync bem-sucedido.
- Lag de dados por provedor.
- Jobs em fila, retry exponencial e dead-letter queue.
- Idempotência em importação e webhooks.
- Tracing por `workspace_id`, `connection_id` e `sync_run_id`.
- Alertas internos sem revelar dados de outro tenant.
- Dashboard administrativo de custo por cliente.

## 14. Roadmap de implementação

### Fase 0 — correção visual e contratos de dados

- Design tokens light/dark.
- Auditoria de responsividade.
- Estados loading/vazio/erro.
- Remover dados fictícios restantes.

**Aceite:** todas as rotas passam pela matriz de tema e viewport; zero overflow involuntário.

### Fase 1 — workspace, unidade e perfil

- `workspace_id`, memberships e RLS.
- Business units Infoproduto/SaaS.
- Mapeamento de contas por unidade.
- Perfil, avatar, e-mail, senha e segurança.

**Aceite:** nenhuma consulta mistura workspace/unidade; teste de isolamento automatizado.

### Fase 2 — centralizar integrações

- Nova página com abas.
- Migrar todos os componentes de Configurações.
- Modelo genérico de conexão, credencial, recursos, jobs e logs.
- Manter Meta/RD funcionando durante a migração.

**Aceite:** Configurações não contém credenciais; Meta/RD continuam conciliados.

### Fase 3 — planos e billing

- Catálogo, assinatura, entitlements e uso.
- Portal, upgrade/downgrade e webhooks Stripe.
- Bloqueio server-side por limite.

**Aceite:** o frontend não consegue ultrapassar limite chamando a API diretamente; webhooks idempotentes.

### Fase 4 — financeiro completo

- Lançamentos, categorias, centros de custo, contas e DRE.
- Orçamento e fluxo de caixa.
- Previsão com snapshots e backtest.

**Aceite:** DRE fecha com os lançamentos e explica qualquer diferença de centavos/arredondamento.

### Fase 5 — CRM universal

- Adaptador canônico.
- RD v2 consolidado.
- HubSpot.
- Pipedrive.

**Aceite:** contatos/deals não duplicam; etapas, owners e campos customizados são rastreáveis.

### Fase 6 — mídia multiplataforma

- Google Ads.
- TikTok Ads.
- Normalização e comparação entre canais.

**Aceite:** cada métrica mantém a semântica do provedor e não soma conversões incompatíveis.

### Fase 7 — IA multi-provider

- AI gateway, BYOK, franquias e observabilidade.
- Copiloto contextual.
- Relatórios e recomendações.
- Evals e aprovação humana.

**Aceite:** custo por workspace medido; saída estruturada validada; chave nunca exposta.

### Fase 8 — automações, social e operação premium

- WhatsApp, editor de automação, mídia social e chamados.
- Templates, logs e relatórios.

**Aceite:** cada execução é idempotente, auditável e respeita opt-in/limite.

## 15. Ordem recomendada imediata

1. Corrigir definitivamente light/dark e responsividade.
2. Criar workspace + business unit; sem isso o alternador não é confiável.
3. Refatorar Integrações e retirar tudo de Configurações.
4. Criar perfil e billing/planos.
5. Evoluir Financeiro com banco correto.
6. Adicionar HubSpot/Pipedrive.
7. Adicionar Google Ads/TikTok.
8. Implementar AI gateway e franquias.

Começar por Google/TikTok ou por novas telas financeiras antes da separação de workspace/unidade aumentaria a dívida e o risco de mistura de dados.

## 16. Definition of Done global

Uma funcionalidade só está pronta quando:

- possui migrations versionadas e rollback conhecido;
- tem RLS e teste de isolamento;
- funciona em claro/escuro e mobile;
- tem loading, vazio, erro e retry;
- possui log/auditoria para ações críticas;
- não expõe segredo;
- mede uso e custo quando aplicável;
- tem teste unitário e E2E do caminho crítico;
- exibe fonte, data e timezone das métricas;
- documentação de suporte foi atualizada.
