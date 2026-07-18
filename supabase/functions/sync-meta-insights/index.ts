import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    // Cron-only path: pg_cron invokes with the service role key. Client-controlled
    // body flags are NOT trusted for skipping auth.
    const isCron = bearer.length > 0 && bearer === supabaseServiceKey;

    let userId: string | null = null;
    if (!isCron) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId : undefined;
    const adAccountIds = Array.isArray(body.adAccountIds)
      ? body.adAccountIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const includeBreakdowns = body.includeBreakdowns === true;
    const incremental = body.incremental === true;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    // A sincronização sem intervalo é sempre incremental. Backfills continuam
    // enviando startDate/endDate explicitamente e preservam todo o histórico.
    const startDate = body.startDate || today;
    const endDate = body.endDate || today;
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
    const graphBase = `https://graph.facebook.com/${graphVersion}`;

    let accountsQuery = supabaseAdmin.from("ad_accounts").select("*");
    if (adAccountId) accountsQuery = accountsQuery.eq("id", adAccountId);
    else if (adAccountIds.length > 0) accountsQuery = accountsQuery.in("id", adAccountIds);
    if (userId) accountsQuery = accountsQuery.eq("user_id", userId);
    const { data: accounts, error: accError } = await accountsQuery;
    if (accError) throw accError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma conta de anúncio encontrada", synced: 0, accounts: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    const errors: string[] = [];
    let needsReauth = false;
    let failedAccounts = 0;

    for (const account of accounts) {
      const attemptedAt = new Date().toISOString();
      try {
        const accessToken = account.access_token;
        const rawAccountId = account.account_id;
        const metaAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;

        console.log(`Syncing: ${account.name} (${metaAccountId})`);

        // 1. Fetch campaigns (incluindo arquivadas/finalizadas)
        const campaignStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"],
        }]));
        const adsetStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "CAMPAIGN_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
        }]));
        const adStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
        }]));
        const campaignsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/campaigns?fields=id,name,objective,effective_status&filtering=${campaignStatusFilter}&access_token=${accessToken}&limit=200`
        );
        if (campaignsRes.error) {
          failedAccounts++;
          errors.push(`Conta ${account.name}: ${campaignsRes.error}`);
          const tokenExpired = campaignsRes.errorCode === 190;
          needsReauth ||= tokenExpired;
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              connection_status: tokenExpired ? "expired" : campaignsRes.retryable ? "error" : "disconnected",
              last_sync_error: campaignsRes.error,
              last_sync_error_code: campaignsRes.errorCode ?? null,
              last_sync_attempt_at: attemptedAt,
            })
            .eq("id", account.id);
          continue;
        }
        const campaigns = campaignsRes.data;
        console.log(`Found ${campaigns.length} campaigns (incl. archived/completed)`);

        // Batch upsert campaigns + detect status changes / track last_activated_at
        if (campaigns.length > 0) {
          const ids = campaigns.map((c: any) => c.id);
          const { data: prevCampaigns } = await supabaseAdmin
            .from("campaigns").select("id, status, last_activated_at").in("id", ids);
          const prevMap = new Map((prevCampaigns || []).map((c: any) => [c.id, c]));

          const campaignChanges: any[] = [];
          const upsertRows = campaigns.map((c: any) => {
            const newStatus = c.effective_status || null;
            const prev = prevMap.get(c.id);
            const prevStatus = prev?.status ?? null;
            let last_activated_at = prev?.last_activated_at ?? null;
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus) {
                campaignChanges.push({
                  campaign_id: c.id, entity_type: "campaign", entity_id: c.id,
                  change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus,
                });
              }
            } else if (prevStatus && newStatus && prevStatus !== newStatus) {
              campaignChanges.push({
                campaign_id: c.id, entity_type: "campaign", entity_id: c.id,
                change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus,
              });
            }
            return {
              id: c.id, name: c.name, ad_account_id: account.id,
              objective: c.objective || null, status: newStatus,
              previous_status: prevStatus, last_activated_at,
            };
          });
          await supabaseAdmin.from("campaigns").upsert(upsertRows, { onConflict: "id" });
          if (campaignChanges.length > 0) {
            await supabaseAdmin.from("campaign_changes").insert(campaignChanges);
          }
        }

        // 2. Fetch adsets (incluindo arquivadas)
        const adsetsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/adsets?fields=id,name,campaign_id,daily_budget,effective_status,destination_type&filtering=${adsetStatusFilter}&access_token=${accessToken}&limit=200`
        );
        if (adsetsRes.error) errors.push(`Conta ${account.name} conjuntos: ${adsetsRes.error}`);
        const adsetsList = adsetsRes.data;
        if (adsetsList.length > 0) {
          console.log(`Found ${adsetsList.length} adsets`);
          const ids = adsetsList.map((a: any) => a.id);
          const { data: prev } = await supabaseAdmin
            .from("adsets").select("id, status, last_activated_at, campaign_id").in("id", ids);
          const prevMap = new Map((prev || []).map((a: any) => [a.id, a]));
          const changes: any[] = [];
          const rows = adsetsList.map((a: any) => {
            const newStatus = a.effective_status || null;
            const p = prevMap.get(a.id);
            const prevStatus = p?.status ?? null;
            let last_activated_at = p?.last_activated_at ?? null;
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus) changes.push({ campaign_id: a.campaign_id, entity_type: "adset", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            } else if (prevStatus && newStatus && prevStatus !== newStatus) {
              changes.push({ campaign_id: a.campaign_id, entity_type: "adset", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            }
            return {
              id: a.id, name: a.name, campaign_id: a.campaign_id,
              daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
              status: newStatus, previous_status: prevStatus, last_activated_at,
              destination_type: a.destination_type ?? null,
            };
          });
          await supabaseAdmin.from("adsets").upsert(rows, { onConflict: "id" });
          if (changes.length > 0) await supabaseAdmin.from("campaign_changes").insert(changes);
        }

        // 3. Fetch ads (incluindo arquivados)
        const adsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/ads?fields=id,name,adset_id,effective_status,creative{id,thumbnail_url,image_url}&filtering=${adStatusFilter}&access_token=${accessToken}&limit=200`
        );
        if (adsRes.error) errors.push(`Conta ${account.name} anúncios: ${adsRes.error}`);
        const adsList = adsRes.data;
        if (adsList.length > 0) {
          console.log(`Found ${adsList.length} ads`);
          const ids = adsList.map((a: any) => a.id);
          const { data: prev } = await supabaseAdmin
            .from("ads").select("id, status, last_activated_at, adset_id").in("id", ids);
          const prevMap = new Map((prev || []).map((a: any) => [a.id, a]));
          // Need campaign_id for change log: fetch adsets
          const adsetIds = [...new Set(adsList.map((a: any) => a.adset_id).filter(Boolean))];
          const { data: adsetRows } = await supabaseAdmin
            .from("adsets").select("id, campaign_id").in("id", adsetIds);
          const adsetCampaign = new Map((adsetRows || []).map((r: any) => [r.id, r.campaign_id]));
          const changes: any[] = [];
          const rows = adsList.map((a: any) => {
            const newStatus = a.effective_status || null;
            const p = prevMap.get(a.id);
            const prevStatus = p?.status ?? null;
            let last_activated_at = p?.last_activated_at ?? null;
            const campaignId = adsetCampaign.get(a.adset_id);
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus && campaignId) changes.push({ campaign_id: campaignId, entity_type: "ad", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            } else if (prevStatus && newStatus && prevStatus !== newStatus && campaignId) {
              changes.push({ campaign_id: campaignId, entity_type: "ad", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            }
            return {
              id: a.id, name: a.name, adset_id: a.adset_id,
              creative_id: a.creative?.id || null,
              thumbnail_url: a.creative?.thumbnail_url || a.creative?.image_url || null,
              status: newStatus, previous_status: prevStatus, last_activated_at,
            };
          });
          await supabaseAdmin.from("ads").upsert(rows, { onConflict: "id" });
          if (changes.length > 0) await supabaseAdmin.from("campaign_changes").insert(changes);
        }

        // 3.5 O histórico de atividades dos últimos 60 dias é pesado. Ele roda
        // apenas em sincronizações manuais/backfill; o ciclo de 15 min atualiza
        // somente entidades e métricas do dia.
        if (!incremental) try {
          const since = Math.floor((Date.now() - 60 * 86400000) / 1000); // last 60d
          const until = Math.floor(Date.now() / 1000);
          let activitiesUrl = `${graphBase}/${metaAccountId}/activities?fields=event_time,event_type,translated_event_type,object_id,object_name,object_type,extra_data&since=${since}&until=${until}&access_token=${accessToken}&limit=200`;
          let pageGuard = 0;
          const activityRows: any[] = [];
          // map adset->campaign and ad->campaign for activity attribution
          const { data: allAdsets } = await supabaseAdmin.from("adsets").select("id, campaign_id");
          const adsetToCampaign = new Map((allAdsets || []).map((r: any) => [String(r.id), r.campaign_id]));
          const { data: allAds } = await supabaseAdmin.from("ads").select("id, adset_id");
          const adToCampaign = new Map(
            (allAds || []).map((r: any) => [String(r.id), adsetToCampaign.get(String(r.adset_id))])
          );
          const validCampaignIds = new Set(campaigns.map((c: any) => String(c.id)));

          while (activitiesUrl && pageGuard < 10) {
            const actData = await fetchMeta(activitiesUrl);
            if (actData.error) {
              console.warn(`Activities error: ${actData.error.message}`);
              break;
            }
            for (const ev of (actData.data || [])) {
              const objType = String(ev.object_type || "").toLowerCase();
              const objId = String(ev.object_id || "");
              let campaignId: string | null = null;
              let entityType = "campaign";
              if (objType.includes("campaign") || validCampaignIds.has(objId)) {
                if (validCampaignIds.has(objId)) { campaignId = objId; entityType = "campaign"; }
              } else if (objType.includes("adset") || objType.includes("ad set")) {
                campaignId = adsetToCampaign.get(objId) ?? null;
                entityType = "adset";
              } else if (objType.includes("ad")) {
                campaignId = adToCampaign.get(objId) ?? null;
                entityType = "ad";
              }
              if (!campaignId) continue;
              const extra = ev.extra_data ? (typeof ev.extra_data === "string" ? safeParse(ev.extra_data) : ev.extra_data) : null;
              activityRows.push({
                campaign_id: campaignId,
                entity_type: entityType,
                entity_id: objId || null,
                changed_at: ev.event_time ? new Date(ev.event_time).toISOString() : new Date().toISOString(),
                change_type: ev.event_type || "update",
                field: extra?.field ?? null,
                old_value: extra?.old_value != null ? String(extra.old_value).slice(0, 500) : null,
                new_value: extra?.new_value != null ? String(extra.new_value).slice(0, 500) : null,
                note: ev.translated_event_type || ev.object_name || null,
              });
            }
            activitiesUrl = actData.paging?.next || "";
            pageGuard++;
          }

          if (activityRows.length > 0) {
            // Dedup against existing rows (campaign_id + entity_id + changed_at + change_type)
            const campaignIds = [...new Set(activityRows.map((r) => r.campaign_id))];
            const { data: existing } = await supabaseAdmin
              .from("campaign_changes")
              .select("campaign_id, entity_id, changed_at, change_type")
              .in("campaign_id", campaignIds)
              .gte("changed_at", new Date(since * 1000).toISOString());
            const seen = new Set(
              (existing || []).map((r: any) => `${r.campaign_id}|${r.entity_id ?? ""}|${r.changed_at}|${r.change_type}`)
            );
            const fresh = activityRows.filter(
              (r) => !seen.has(`${r.campaign_id}|${r.entity_id ?? ""}|${r.changed_at}|${r.change_type}`)
            );
            if (fresh.length > 0) {
              for (let i = 0; i < fresh.length; i += 200) {
                await supabaseAdmin.from("campaign_changes").insert(fresh.slice(i, i + 200));
              }
              console.log(`Inserted ${fresh.length} activity rows for ${account.name}`);
            }
          }
        } catch (actErr) {
          console.warn(`Activity log fetch failed: ${(actErr as Error).message}`);
        }

        // 4. Buscar insights a nível de CONTA (não depende da listagem de campanhas)
        //    Captura inclusive ads de campanhas arquivadas/finalizadas
        const insightsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/insights?fields=ad_id,ad_name,adset_id,campaign_id,spend,impressions,reach,clicks,inline_link_clicks,unique_inline_link_clicks,ctr,cpm,frequency,actions,action_values&level=ad&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}&action_attribution_windows=${encodeURIComponent('["7d_click","1d_view"]')}&use_unified_attribution_setting=true&access_token=${accessToken}&limit=500`
        );
        if (insightsRes.error) {
          errors.push(`Conta ${account.name} insights: ${insightsRes.error}`);
          failedAccounts++;
          const tokenExpired = insightsRes.errorCode === 190;
          needsReauth ||= tokenExpired;
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              connection_status: tokenExpired ? "expired" : insightsRes.retryable ? "error" : "disconnected",
              last_sync_error: insightsRes.error,
              last_sync_error_code: insightsRes.errorCode ?? null,
              last_sync_attempt_at: attemptedAt,
            })
            .eq("id", account.id);
          continue;
        }
        const allInsights = insightsRes.data;
        console.log(`Total ${allInsights.length} insight rows for account ${account.name}`);

        // 4.1 Hidratar ads/adsets/campaigns ausentes (necessário para o join do dashboard)
        const insightAdIds = [...new Set(allInsights.map((i: any) => i.ad_id).filter(Boolean))];
        if (insightAdIds.length > 0) {
          const { data: existingAds } = await supabaseAdmin
            .from("ads").select("id").in("id", insightAdIds);
          const existingSet = new Set((existingAds || []).map((r: any) => String(r.id)));
          const missingAdIds = insightAdIds.filter((id: string) => !existingSet.has(String(id)));
          if (missingAdIds.length > 0) {
            console.log(`Hydrating ${missingAdIds.length} missing ads from insights`);
            const newCampaigns = new Map<string, any>();
            const newAdsets = new Map<string, any>();
            const newAds = new Map<string, any>();
            for (const adId of missingAdIds) {
              try {
                const detail = await fetchMeta(
                  `${graphBase}/${adId}?fields=id,name,effective_status,creative{id,thumbnail_url,image_url},adset{id,name,campaign_id,effective_status,daily_budget},campaign{id,name,objective,effective_status}&access_token=${accessToken}`
                );
                if (detail.error || !detail.id) continue;
                const camp = detail.campaign;
                const aset = detail.adset;
                if (camp?.id) {
                  newCampaigns.set(camp.id, {
                    id: camp.id, name: camp.name, ad_account_id: account.id,
                    objective: camp.objective || null, status: camp.effective_status || null,
                  });
                }
                if (aset?.id) {
                  newAdsets.set(aset.id, {
                    id: aset.id, name: aset.name, campaign_id: aset.campaign_id || camp?.id,
                    daily_budget: aset.daily_budget ? Number(aset.daily_budget) / 100 : null,
                    status: aset.effective_status || null,
                  });
                }
                newAds.set(detail.id, {
                  id: detail.id, name: detail.name, adset_id: aset?.id,
                  creative_id: detail.creative?.id || null,
                  thumbnail_url: detail.creative?.thumbnail_url || detail.creative?.image_url || null,
                  status: detail.effective_status || null,
                });
              } catch (e) {
                console.warn(`Hydration failed for ad ${adId}: ${(e as Error).message}`);
              }
            }
            if (newCampaigns.size > 0)
              await supabaseAdmin.from("campaigns").upsert([...newCampaigns.values()], { onConflict: "id" });
            if (newAdsets.size > 0)
              await supabaseAdmin.from("adsets").upsert([...newAdsets.values()], { onConflict: "id" });
            if (newAds.size > 0)
              await supabaseAdmin.from("ads").upsert([...newAds.values()], { onConflict: "id" });
          }
        }

        // 4.2 Carregar evento de Landing Page configurado para esta conta (manual).
        // Formulário Instantâneo é SEMPRE `onsite_conversion.lead_grouped` (única fonte
        // que bate com o painel do Meta — `lead` é inflado, pixel é off-site).
        let lpAction: string | null = null;
        try {
          const { data: lpCfg } = await supabaseAdmin
            .from("account_lp_config")
            .select("action_type")
            .eq("ad_account_id", account.id)
            .maybeSingle();
          if (lpCfg?.action_type) lpAction = lpCfg.action_type;
        } catch (_) { /* ignore */ }

        // 4.3 Persistir TODOS os action_types em insight_actions
        const actionRows: any[] = [];
        for (const insight of allInsights) {
          const actions = insight.actions || [];
          const values = insight.action_values || [];
          const valueMap = new Map<string, number>();
          for (const v of values) valueMap.set(String(v.action_type), Number(v.value || 0));
          for (const a of actions) {
            actionRows.push({
              ad_id: insight.ad_id,
              date: insight.date_start,
              action_type: String(a.action_type),
              value: Number(a.value || 0),
              value_amount: valueMap.get(String(a.action_type)) || 0,
            });
          }
        }
        for (let i = 0; i < actionRows.length; i += 500) {
          const chunk = actionRows.slice(i, i + 500);
          const { error: aErr } = await supabaseAdmin
            .from("insight_actions")
            .upsert(chunk, { onConflict: "ad_id,date,action_type", ignoreDuplicates: false });
          if (aErr) console.error("insight_actions upsert error:", aErr.message);
        }
        if (actionRows.length > 0) console.log(`insight_actions: ${actionRows.length} rows`);

        // Batch upsert insights (chunks of 100)
        const insightRows = allInsights.map((insight: any) => {
          const spend = Number(insight.spend || 0);
          const impressions = Number(insight.impressions || 0);
          const clicks = Number(insight.clicks || 0);
          const inlineLinkClicks = Number(insight.inline_link_clicks || 0);
          const uniqueInlineLinkClicks = Number(insight.unique_inline_link_clicks || 0);
          const reach = Number(insight.reach || 0);
          const ctr = Number(insight.ctr || 0);
          const cpm = Number(insight.cpm || 0);
          const frequency = Number(insight.frequency || 0);

          const actions = insight.actions || [];
          const findVal = (type: string): number => {
            const a = actions.find((x: any) => x.action_type === type);
            return a ? Number(a.value || 0) : 0;
          };
          // Leads = Formulário Instantâneo (lead_grouped) + LP configurado da conta.
          // NUNCA somar `lead` (inflado) ou `fb_pixel_lead` automaticamente.
          const nativeLeads = findVal("onsite_conversion.lead_grouped");
          const lpLeads = lpAction ? findVal(lpAction) : 0;
          const leads = nativeLeads + lpLeads;
          const cpl = leads > 0 ? spend / leads : 0;
          const conversionRate = clicks > 0 ? (leads / clicks) * 100 : 0;
          const efficiencyRate = impressions > 0 ? (leads / impressions) * 100 : 0;
          const rawScore = (ctr * 2) + (conversionRate * 3) - (cpl * 0.02);
          const healthScore = Math.max(0, Math.min(100, rawScore));

          return {
            ad_id: insight.ad_id,
            date: insight.date_start,
            spend, impressions, reach, clicks,
            inline_link_clicks: inlineLinkClicks,
            unique_inline_link_clicks: uniqueInlineLinkClicks,
            ctr, cpm, frequency,
            leads, cpl, conversion_rate: conversionRate,
            efficiency_rate: efficiencyRate, health_score: healthScore,
          };
        });

        // Upsert in chunks
        for (let i = 0; i < insightRows.length; i += 100) {
          const chunk = insightRows.slice(i, i + 100);
          const { error: upsertError } = await supabaseAdmin
            .from("insights")
            .upsert(chunk, { onConflict: "ad_id,date", ignoreDuplicates: false });
          if (!upsertError) totalSynced += chunk.length;
          else console.error("Upsert error:", upsertError.message);
        }

        // 5. Buscar breakdowns somente quando explicitamente solicitado. Eles
        // multiplicam o consumo da Graph API e não devem rodar em todo refresh.
        if (includeBreakdowns) try {
          const breakdownTypes = ["age", "gender", "publisher_platform", "platform_position", "region"];
          for (const bt of breakdownTypes) {
            const bRes = await fetchMetaPaginated(
              `${graphBase}/${metaAccountId}/insights?fields=campaign_id,spend,impressions,clicks,actions&level=campaign&breakdowns=${bt}&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}&action_attribution_windows=${encodeURIComponent('["7d_click","1d_view"]')}&use_unified_attribution_setting=true&access_token=${accessToken}&limit=500`
            );
            if (bRes.error) {
              console.warn(`Breakdown ${bt} error: ${bRes.error}`);
              continue;
            }
            const bRows = (bRes.data || [])
              .filter((r: any) => r.campaign_id && r[bt])
              .map((r: any) => {
                const actions = r.actions || [];
                const findVal = (type: string): number => {
                  const a = actions.find((x: any) => x.action_type === type);
                  return a ? Number(a.value || 0) : 0;
                };
                // Mesma regra do sync principal: lead_grouped + LP configurada.
                const nLeads = findVal("onsite_conversion.lead_grouped");
                const lLeads = lpAction ? findVal(lpAction) : 0;
                return {
                  campaign_id: r.campaign_id,
                  date: r.date_start,
                  breakdown_type: bt,
                  segment_key: String(r[bt]),
                  spend: Number(r.spend || 0),
                  impressions: Number(r.impressions || 0),
                  clicks: Number(r.clicks || 0),
                  leads: nLeads + lLeads,
                };
              });
            for (let i = 0; i < bRows.length; i += 200) {
              const chunk = bRows.slice(i, i + 200);
              const { error: bErr } = await supabaseAdmin
                .from("insights_breakdowns")
                .upsert(chunk, { onConflict: "campaign_id,date,breakdown_type,segment_key", ignoreDuplicates: false });
              if (bErr) console.error(`Breakdown ${bt} upsert error:`, bErr.message);
            }
            console.log(`Breakdown ${bt}: ${bRows.length} rows`);
          }
        } catch (bErr) {
          console.warn(`Breakdowns failed for ${account.name}: ${(bErr as Error).message}`);
        }

        // Mark account as connected after a successful sync
        await supabaseAdmin
          .from("ad_accounts")
          .update({
            connection_status: "connected",
            last_sync_error: null,
            last_sync_error_code: null,
            last_sync_attempt_at: attemptedAt,
            last_sync_success_at: attemptedAt,
          })
          .eq("id", account.id);
      } catch (e) {
        failedAccounts++;
        const msg = (e as Error).message;
        errors.push(`Conta ${account.name}: ${msg}`);
        await supabaseAdmin
          .from("ad_accounts")
          .update({
            connection_status: "unknown",
            last_sync_error: msg,
            last_sync_attempt_at: attemptedAt,
          })
          .eq("id", account.id);
      }
    }

    console.log(`Sync complete: ${totalSynced} rows synced`);

    return new Response(
      JSON.stringify({
        success: failedAccounts < accounts.length, synced: totalSynced,
        accounts: accounts.length,
        errors: errors.length > 0 ? errors : undefined,
        error: failedAccounts >= accounts.length ? errors[0] : undefined,
        needs_reauth: needsReauth || undefined,
        graph_version: graphVersion,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 32, 613, 80004]);

type MetaFetchResult = Record<string, any> & {
  error?: { message: string; code?: number; error_subcode?: number; is_transient?: boolean };
  __httpStatus?: number;
  __retryable?: boolean;
};

async function fetchMeta(url: string, maxAttempts = 4): Promise<MetaFetchResult> {
  let lastMessage = "Falha ao consultar a Graph API";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      const raw = await response.text();
      let payload: MetaFetchResult = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }

      if (response.ok && !payload.error) return payload;

      const metaError = payload.error || { message: `Meta retornou HTTP ${response.status}` };
      const code = Number(metaError.code);
      const retryable = response.status === 429 || response.status >= 500 || metaError.is_transient === true || RETRYABLE_META_CODES.has(code);
      lastMessage = metaError.message || `Meta retornou HTTP ${response.status}`;

      if (retryable && attempt + 1 < maxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
        const exponential = 750 * (2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(Math.min(15_000, Math.max(retryAfter, exponential)));
        continue;
      }

      return { ...payload, error: { ...metaError, message: lastMessage }, __httpStatus: response.status, __retryable: retryable };
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Falha de rede ao consultar a Meta";
      if (attempt + 1 < maxAttempts) {
        await sleep(750 * (2 ** attempt));
        continue;
      }
    }
  }
  return { error: { message: lastMessage, is_transient: true }, __retryable: true };
}

// Segue paging.next até o fim (ou hard-cap), retornando erro estruturado sem expor token.
async function fetchMetaPaginated(url: string, maxPages = 50): Promise<{
  data: any[];
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
  httpStatus?: number;
  retryable?: boolean;
}> {
  const all: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  while (next && pages < maxPages) {
    const res = await fetchMeta(next);
    if (res.error) {
      return {
        data: all,
        error: res.error.message || String(res.error),
        errorCode: typeof res.error.code === "number" ? res.error.code : undefined,
        errorSubcode: typeof res.error.error_subcode === "number" ? res.error.error_subcode : undefined,
        httpStatus: res.__httpStatus,
        retryable: res.__retryable,
      };
    }
    if (Array.isArray(res.data)) all.push(...res.data);
    next = res.paging?.next;
    pages++;
  }
  if (next) console.warn(`fetchMetaPaginated hit maxPages=${maxPages}`);
  return { data: all };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
