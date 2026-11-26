# Plano de Automação de Tráfego Pago — 10/11/2026

> **Status:** Proposto (implementação não iniciada).
> **Contexto:** usuário opera tráfego pago para 4 experts (Dra. Ranniely, Dr. José, Dra. Natália,
> Dra. Fernanda Nassar) + 5 franquias (Mordidela, No Coffee, Santa Palmilha, Vida Leve,
> Viva América). Cada expert tem 2 contas Meta: "Aluna" e "Paciente Modelo".
> **Motivo da priorização:** limitação de tempo do usuário — meta é reduzir trabalho manual
> recorrente e transformar tarefas repetitivas em automações com aprovação.

---

## 1. Diagnóstico: o que já existe no Growdash (verificado no código)

O Growdash **já possui** a maior parte da infraestrutura. Reaproveitar, não reconstruir.

| Peça | Onde está | Estado |
|---|---|---|
| Cliente Meta Graph API | `supabase/functions/_shared/metaToken.ts` | Funcionando |
| Sync de insights (campanha/adset/ad) | `supabase/functions/sync-meta-insights/index.ts` | Funcionando |
| Sync de leads | `supabase/functions/sync-meta-leads/index.ts` | Funcionando |
| Sync de saldo / pixel / transições | `sync-meta-balance`, `sync-meta-pixels`, `sync-meta-hourly` | Funcionando |
| Tabela de métricas canônicas | `public.meta_insights_contract` (migration `20261009150000`) | Funcionando |
| Função de agregação por conta | `public.fn_dashboard_metricas(start, end, tz)` | Funcionando |
| Mapeamento conta de anúncio | `public.ad_accounts` (colunas `id`, `account_id`, `name`, `user_id`) | Funcionando |
| Autorização por conta | `_shared/adAccountAccess.ts` → `resolveAuthorizedAdAccounts()` | Funcionando |
| UTM → RD Station (nível banco) | Migrations `20261024213858`, `20261024231500`, `20261024225040` | Existe, com gaps |
| Envio WhatsApp | `supabase/functions/whatsapp-send/index.ts` (Meta Graph API / WAHA) | Funcionando, **não usa Z-API** |
| Criativos de vídeo | `scripts/traffic-agent-runner.mjs` + `traffic-agent-analyze` | Parcial |

### Tabela de origem do relatório

`public.meta_insights_contract` tem exatamente o necessário para o relatório:

```
level ('campaign'|'adset'|'ad') | item_id | campaign_id | campaign_name | objective
| optimization_event | spend | impressions | reach | clicks | ctr | cpc | cpm
| results | result_type | cpa | roas | date_start | date_end | ad_account_id
```

`level = 'ad'` traz o criativo nível anúncio — é daí que sai a **imagem do criativo campeão**
(via `adcreatives` na Graph API, usando `item_id` como `ad_id`).

**Mapeamento cliente → conta:** `ad_accounts.name` (texto livre). O relatório itera
`ad_accounts` do usuário e agrupa por `name`.

---

## 2. Lacunas reais (o que precisa ser construído)

### Gap 1 — UTM de campanha de formulário não chega ao RD Station

**Sintoma relatado:** UTMs chegam à planilha Google Sheets, mas o RD Station não recebe.

**Constatação no código:** o Growdash já tem um trigger
(`fill_rd_deal_utm_meta_tracking`) que copia `utm_campaign/utm_term/utm_content/utm_source`
do lead do RD para `meta_campaign_name/meta_adset_name/meta_ad_name/meta_platform`.
Isso resolve o caminho **RD → banco**, mas **não** o caminho **Meta → RD**.

**Hipótese principal:** em campanha de formulário, o lead é criado no RD a partir do
formulário nativo do Meta. O RD recebe os UTMs apenas se a URL do formulário os carrega
como query string (ex.: `?utm_source=facebook&utm_campaign=...`). O webhook do Meta
(`meta-webhook`) entrega os UTMs ao Growdash, mas o RD não os recebe porque ninguém os
repassa de volta.

**Ação proposta (Make, sem tocar no Growdash):** no cenário Make já existente, no passo
onde o lead é cadastrado no RD, incluir as UTMs vindas do webhook/formulário nos campos
de lead do RD (`lead["utm_campaign"]`, etc.) ou em campos customizados do RD.

**Antes de implementar:** validar empiricamente se o RD aceita UTM em lead de formulário
nativo. Se o formulário for nativo do Meta (sem URL controlável), a solução é migrar
para **Lead Forms com URL de destino rastreável** ou usar **Click-to-WhatsApp + evento
customizado** para transporting a atribuição.

### Gap 2 — Não existe relatório diário automatizado

**Proposto:** Edge Function `daily-traffic-report` no Supabase, agendada via `pg_cron`
para 07:00 America/Sao_Paulo, com atraso de 1 dia (reporta D-1).

### Gap 3 — Não existe envio via Z-API

Growdash envia WhatsApp por Meta Graph API / WAHA. A Z-API é uma第三条 via. **Decisão
pendente do usuário:** usar Z-API (instância já configurada, token fornecido) **ou**
reusar o canal WhatsApp que o Growdash já tem. Reusar o canal existente é o caminho
com menos retrabalho e mantém o histórico de envio auditável.

---

## 3. Entregáveis acordados com o usuário

### Entregável A — Relatório diário (WhatsApp, 07:00, dia anterior)

Um relatório **separado por cliente** (conta de anúncio). Conteúdo:

```
📊 RELATÓRIO DIÁRIO - {cliente}
📅 {DD/MM/AAAA}

💰 GASTO DO DIA
- Total: R$ X.XXX,XX
- Campanhas ativas: X

📈 PERFORMANCE
- Leads gerados: X
- CPL médio: R$ XX,XX
- Melhor campanha: {nome}

🎯 CRIATIVO CAMPEÃO (últimos 7 dias)
[IMAGEM DO CRIATIVO]

💡 SUGESTÃO: {texto automático}

🔗 {link direto para o Gerenciador de Anúncios da conta}
```

### Entregável B — Comparação semanal (toda segunda, 07:00)

```
📊 COMPARAÇÃO SEMANAL - {cliente}
📅 Semana: {DD/MM} a {DD/MM}

📈 ESTA SEMANA vs SEMANA ANTERIOR
- Gasto: R$ X.XXX vs R$ X.XXX (↑↓ X%)
- Leads: X vs X (↑↓ X%)
- CPL: R$ XX vs R$ XX (↑↓ X%)

🏆 MELHOR CRIATIVO DA SEMANA
[IMAGEM]

📉 PIOR CRIATIVO DA SEMANA
[IMAGEM]

💡 AÇÃO RECOMENDADA: {texto}
```

### Entregável C — Geração de criativos a cada 3 dias

Ciclo de 3 dias: analisa o criativo campeão dos **últimos 7 dias**, gera novas variações
(baseadas no que já funciona + ângulo novo), envia para aprovação e, após aprovação,
publica. Se a performance do campeão cair, o ciclo gera **mais** variações (conforme
acordo: "sempre a cada 3 dias, analisa; se está ruim, fazer mais").

---

## 4. Dados sensíveis fornecidos pelo usuário (NÃO versionar)

O usuário forneceu credencial da Z-API nesta conversa. **Não commitar, não escrever em
arquivo versionado.** Fica apenas em Secret do Supabase Edge Function / variável de
ambiente local.

```
Instância Z-API: 3F9B4B4692321248DA66BAEF369AB30C
Token Z-API:     64F238CDBD619F59554875D5
Número destino: 11961551875
```

Usar via Secret: `supabase secrets set ZAPI_INSTANCE_ID=... ZAPI_TOKEN=... ZAPI_REPORT_NUMBER=...`

---

## 5. Ordem de execução proposta

1. **Validar empiricamente o Gap 1 (UTM→RD)** — 1 conversa, sem código. Define se a correção
   é no Make, no formulário, ou se exige mudança de campanha.
2. **Relatório diário** (Entregável A) — Edge Function + query sobre `meta_insights_contract`
   + envio + agendamento 07:00.
3. **Comparação semanal** (Entregável B) — mesmo núcleo, janela de 7 dias vs 7 dias.
4. **Criativos a cada 3 dias** (Entregável C) — reaproveitar `traffic-agent-runner.mjs`.

**Guardrails (CLAUDE.md da agência):** nada de publicar, enviar mensagem, alterar credencial
ou gastar verba sem autorização explícita do usuário. O relatório é leitura + envio
autorizado por este plano; publicação de criativo e alteração de campanha **exigem
portão de aprovação**.

---

## 6. Estado não verificado

- Quais contas de anúncio existem e como `ad_accounts.name` se mapeia aos 9 clientes —
  **precisa de leitura do banco** (não verificado; a lista de nomes aqui é do contexto
  da conversa, não do banco).
- Se o Growdash tem pg_cron ativo e como agendar Edge Functions.
- Se o RD Station aceita UTMs em lead de formulário nativo do Meta (Gap 1).
- Quantidade real de imagens de criativo acessíveis via `adcreatives` com os tokens atuais.
