# Prompt de implementação — Relatório Diário de Tráfego Pago

> **Como usar:** abra uma sessão nova no Claude Sonnet 5 Code com a pasta `Growdash` como diretório
> de trabalho e cole o bloco abaixo. Leia primeiro
> `docs/PLANO_AUTOMACAO_TRAFEGO_PAGO_2026-11-10.md` (contexto e evidências).

---

## Contexto

Usuário opera tráfego pago para 9 clientes (4 experts + 5 franquias) do Instituto, cada um
com contas Meta separadas. Hoje ele gasta ~4h/dia ajustando campanhas manualmente.
O objetivo é automatizar: relatório diário às 07:00 no WhatsApp (um por cliente),
comparação semanal às segundas, e geração de criativos a cada 3 dias.

O Growdash **já tem** todo o motor de dados (Meta Graph API, sync de insights, tabela
`meta_insights_contract`, função `fn_dashboard_metricas`). **Não reconstruir** — apenas
construir a camada de leitura + formatação + envio + agendamento.

## Tarefas (nesta ordem)

### 1. Confirmar o mapeamento conta → cliente

```sql
select id, account_id, name, user_id from public.ad_accounts order by created_at;
```

Ler via service_role. O `name` é a chave de agrupamento do relatório. Se os nomes
não batem com os 9 clientes, **perguntar ao usuário o mapeamento** antes de seguir.

### 2. Edge Function `daily-traffic-report`

Novo arquivo: `supabase/functions/daily-traffic-report/index.ts`

Regras:
- Ler de `public.meta_insights_contract` com `level = 'ad'` (tem `item_id` = ad_id,
  `campaign_name`, `spend`, `results`, `cpa`, `date_start`/`date_end`).
- Janela: relatório de **D-1** (dia anterior). Aceitar `?date=YYYY-MM-DD` para teste manual.
- Agrupar por `ad_account_id` → resolver nome do cliente via `ad_accounts`.
- Payload por cliente:
  - gasto total, leads (`results`), CPL médio, nº de campanhas ativas
  - campanha com melhor CPL
  - **criativo campeão**: ad com menor CPA (e `spend > 0`) nos últimos 7 dias
  - URL da imagem do criativo: Graph API `/{ad_id}/adcreatives` → `thumbnail_url`
    ou o `image_url`/`video_url` do criativo
  - link do Gerenciador de Anúncios: `https://business.facebook.com/adsmanager/manage/campaigns?ids={account_id}`
  - sugestão: regra simples sobre variação de CPL vs média de 7 dias

### 3. Envio no WhatsApp — DECISÃO PENDENTE DO USUÁRIO

Duas opções. **Perguntar antes de implementar:**

- **Opção 1 (recomendada):** reusar o canal que o Growdash já tem
  (`supabase/functions/whatsapp-send/index.ts` — Meta Graph API / WAHA).
  Vantagem: histórico auditável, sem credencial nova, sem provider novo.
- **Opção 2:** Z-API (`https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text`).
  Instância e token já fornecidos pelo usuário — guardar **apenas** como Secret
  (`supabase secrets set`), nunca em arquivo versionado.

Para imagens: Z-API aceita `send-image`; Meta Graph API usa `type: "image"`.

### 4. Agendamento 07:00 America/Sao_Paulo

- Se Edge Function: `pg_cron` + `pg_net` chamando a função.
- Verificar se já existe padrão de agendamento no repo (`.github/workflows/loop-engineering.yml`
  referencia `daily-reconciliation` — seguir o mesmo padrão).
- Segunda-feira → também enviar a comparação semanal.

### 5. Entregar para o usuário revisar

Uma mensagem de WhatsApp de exemplo por cliente, **antes** de agendar. Não agendar sem
o "ok" dele (portão de autorização da CLAUDE.md da agência).

## Guardrails

- Nada de alterar, pausar ou criar campanhas — o relatório é **leitura**.
- Publicação de criativo exige aprovação explícita.
- Não commitar credencial.
- Migrations: verificar schema real antes de escrever; usar blocos `IF EXISTS` defensivos;
  qualificar extensões (`extensions.gen_random_uuid()`).
- Validar localmente antes de publicar; nunca declarar produção validada sem evidência.

## Critérios de aceite

- [ ] Relatório de D-1 entregue às 07:00, um por cliente, com imagem do criativo campeão
- [ ] Comparação semanal toda segunda com melhor e pior criativo (imagem)
- [ ] Link direto para o Gerenciador de Anúncios correto por conta
- [ ] Agendamento sobrevive a reinício (pg_cron)
- [ ] Nenhuma credencial em arquivo versionado
