import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiagSeverity = "critical" | "warning" | "observation" | "initial" | "healthy" | "inactive";

export interface CampaignDiagnostic {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  campaignStatus: string | null;
  isActive: boolean;
  lastActivatedAt: string | null;
  cycleStartDate: string | null; // YYYY-MM-DD
  hoursActive: number;
  daysActive: number;
  effectiveTargetCpl: number;
  minSpendThreshold: number;
  // Cycle metrics (only since last activation)
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  frequency: number;
  status: DiagSeverity;
  reasons: string[];
  summary: string;
  trend: "improving" | "worsening" | "oscillating" | "stable" | "unknown";
  worstAdset: { id: string; name: string; cpl: number; spend: number; leads: number } | null;
  worstAd: { id: string; name: string; cpl: number; spend: number; leads: number; thumbnail_url: string | null } | null;
}

const FALLBACK_TARGET_CPL = 50;

const STATUS_LABEL: Record<DiagSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  observation: "Observação",
  initial: "Estado inicial",
  healthy: "Saudável",
  inactive: "Inativa",
};

export function statusLabel(s: DiagSeverity) {
  return STATUS_LABEL[s];
}

export function useCampaignDiagnostics() {
  return useQuery({
    queryKey: ["campaign_diagnostics_v3"],
    queryFn: async (): Promise<CampaignDiagnostic[]> => {
      const [campRes, targetRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select(`
            id, name, ad_account_id, status, last_activated_at, created_at,
            ad_accounts!inner(id, name, target_cpl, min_spend_threshold),
            adsets(
              id, name, status,
              ads(
                id, name, thumbnail_url, status,
                insights(spend, leads, clicks, impressions, ctr, cpl, frequency, date)
              )
            )
          `),
        (supabase as any).from("campaign_targets").select("campaign_id, target_cpl"),
      ]);
      if (campRes.error) throw campRes.error;
      if (targetRes.error) throw targetRes.error;

      const targetMap = new Map<string, number>();
      (targetRes.data || []).forEach((t: any) => targetMap.set(t.campaign_id, Number(t.target_cpl)));

      const now = Date.now();
      const { toLocalDateString } = await import("@/lib/dateRange");
      const todayStr = toLocalDateString(new Date());


      return (campRes.data || []).map((c: any): CampaignDiagnostic => {
        const acc = c.ad_accounts;
        const accountTargetCpl = acc?.target_cpl != null ? Number(acc.target_cpl) : null;
        const campaignTargetCpl = targetMap.get(c.id) ?? null;
        const effectiveTargetCpl = campaignTargetCpl ?? accountTargetCpl ?? FALLBACK_TARGET_CPL;
        const minSpendThreshold = acc?.min_spend_threshold != null ? Number(acc.min_spend_threshold) : 50;

        const status: string | null = c.status ?? null;
        const isActive = (status || "").toUpperCase() === "ACTIVE";

        // Determine cycle start
        let cycleStart: number | null = c.last_activated_at ? new Date(c.last_activated_at).getTime() : null;

        // Fallback: if active but no last_activated_at recorded, use the most recent
        // contiguous run of insight days ending today (so a campaign that paused
        // and resumed shows only the recent active stretch).
        const allInsightDates: string[] = [];
        for (const adset of c.adsets || []) {
          for (const ad of adset.ads || []) {
            for (const i of ad.insights || []) if (i.date) allInsightDates.push(i.date);
          }
        }
        const uniqDates = Array.from(new Set(allInsightDates)).sort();

        if (cycleStart === null && isActive && uniqDates.length > 0) {
          // Walk back from today while gap <= 1 day
          let cursor = uniqDates[uniqDates.length - 1];
          let cycleStartStr = cursor;
          for (let i = uniqDates.length - 2; i >= 0; i--) {
            const a = new Date(uniqDates[i]).getTime();
            const b = new Date(cursor).getTime();
            const gapDays = Math.round((b - a) / 86400000);
            if (gapDays <= 1) {
              cycleStartStr = uniqDates[i];
              cursor = uniqDates[i];
            } else {
              break;
            }
          }
          cycleStart = new Date(cycleStartStr).getTime();
        }

        const cycleStartDate = cycleStart ? toLocalDateString(new Date(cycleStart)) : null;
        const hoursActive = cycleStart ? Math.max(0, (now - cycleStart) / 3600000) : 0;
        const daysActive = cycleStart ? Math.max(0, (now - cycleStart) / 86400000) : 0;

        // Aggregate ONLY insights in current cycle
        let spend = 0, leads = 0, clicks = 0, impressions = 0, ctrSum = 0, freqSum = 0, count = 0;
        const adsetAgg = new Map<string, { id: string; name: string; spend: number; leads: number }>();
        const adAgg = new Map<string, { id: string; name: string; thumbnail_url: string | null; spend: number; leads: number }>();
        const dailyAgg = new Map<string, { spend: number; leads: number }>();

        for (const adset of c.adsets || []) {
          let asSpend = 0, asLeads = 0;
          for (const ad of adset.ads || []) {
            let aSpend = 0, aLeads = 0;
            for (const i of ad.insights || []) {
              if (cycleStartDate && i.date && i.date < cycleStartDate) continue;
              spend += i.spend ?? 0;
              leads += i.leads ?? 0;
              clicks += i.clicks ?? 0;
              impressions += i.impressions ?? 0;
              ctrSum += i.ctr ?? 0;
              freqSum += i.frequency ?? 0;
              count++;
              aSpend += i.spend ?? 0;
              aLeads += i.leads ?? 0;
              const d = dailyAgg.get(i.date) || { spend: 0, leads: 0 };
              d.spend += i.spend ?? 0; d.leads += i.leads ?? 0;
              dailyAgg.set(i.date, d);
            }
            asSpend += aSpend; asLeads += aLeads;
            if (aSpend > 0 || aLeads > 0) {
              adAgg.set(ad.id, { id: ad.id, name: ad.name, thumbnail_url: ad.thumbnail_url, spend: aSpend, leads: aLeads });
            }
          }
          if (asSpend > 0 || asLeads > 0) {
            adsetAgg.set(adset.id, { id: adset.id, name: adset.name, spend: asSpend, leads: asLeads });
          }
        }

        const cpl = leads > 0 ? spend / leads : 0;
        const ctr = count > 0 ? ctrSum / count : 0;
        const frequency = count > 0 ? freqSum / count : 0;

        // Trend: last 3 days vs previous 3 days within cycle
        const dayKeys = Array.from(dailyAgg.keys()).sort();
        let trend: CampaignDiagnostic["trend"] = "unknown";
        if (dayKeys.length >= 4) {
          const recent = dayKeys.slice(-3);
          const prev = dayKeys.slice(-6, -3);
          const sumLeads = (ks: string[]) => ks.reduce((a, k) => a + (dailyAgg.get(k)?.leads ?? 0), 0);
          const sumSpend = (ks: string[]) => ks.reduce((a, k) => a + (dailyAgg.get(k)?.spend ?? 0), 0);
          const rL = sumLeads(recent), pL = sumLeads(prev);
          const rS = sumSpend(recent), pS = sumSpend(prev);
          const rCpl = rL > 0 ? rS / rL : 0;
          const pCpl = pL > 0 ? pS / pL : 0;
          if (pCpl > 0 && rCpl > 0) {
            const delta = (rCpl - pCpl) / pCpl;
            if (delta < -0.1) trend = "improving";
            else if (delta > 0.2) trend = "worsening";
            else trend = "stable";
          } else if (rL === 0 && pL > 0) trend = "worsening";
          else if (rL > 0 && pL === 0) trend = "improving";

          // Oscillation: large variance across daily CPL
          const dailyCpls = dayKeys.map(k => {
            const d = dailyAgg.get(k)!;
            return d.leads > 0 ? d.spend / d.leads : 0;
          }).filter(v => v > 0);
          if (dailyCpls.length >= 3) {
            const avg = dailyCpls.reduce((a, b) => a + b, 0) / dailyCpls.length;
            const max = Math.max(...dailyCpls), min = Math.min(...dailyCpls);
            if (avg > 0 && (max - min) / avg > 0.6) trend = "oscillating";
          }
        }

        // Worst contributors by spend with no leads, then by highest CPL
        const adsetList = Array.from(adsetAgg.values()).map(a => ({ ...a, cpl: a.leads > 0 ? a.spend / a.leads : Infinity }));
        const adList = Array.from(adAgg.values()).map(a => ({ ...a, cpl: a.leads > 0 ? a.spend / a.leads : Infinity }));
        // Prefer "spent meaningfully but no leads"
        const sortFn = (a: any, b: any) => {
          const aBad = a.leads === 0 && a.spend >= effectiveTargetCpl;
          const bBad = b.leads === 0 && b.spend >= effectiveTargetCpl;
          if (aBad && !bBad) return -1;
          if (!aBad && bBad) return 1;
          if (a.leads === 0 && b.leads === 0) return b.spend - a.spend;
          if (a.leads === 0) return -1;
          if (b.leads === 0) return 1;
          return b.cpl - a.cpl;
        };
        adsetList.sort(sortFn); adList.sort(sortFn);
        const worstAdset = adsetList[0] && (adsetList[0].leads === 0 && adsetList[0].spend >= effectiveTargetCpl)
          ? { id: adsetList[0].id, name: adsetList[0].name, cpl: adsetList[0].cpl, spend: adsetList[0].spend, leads: adsetList[0].leads }
          : adsetList[0] && adsetList[0].leads > 0 && adsetList[0].cpl > effectiveTargetCpl * 1.5
          ? { id: adsetList[0].id, name: adsetList[0].name, cpl: adsetList[0].cpl, spend: adsetList[0].spend, leads: adsetList[0].leads }
          : null;
        const worstAd = adList[0] && (adList[0].leads === 0 && adList[0].spend >= effectiveTargetCpl)
          ? { id: adList[0].id, name: adList[0].name, cpl: adList[0].cpl, spend: adList[0].spend, leads: adList[0].leads, thumbnail_url: adList[0].thumbnail_url }
          : adList[0] && adList[0].leads > 0 && adList[0].cpl > effectiveTargetCpl * 1.5
          ? { id: adList[0].id, name: adList[0].name, cpl: adList[0].cpl, spend: adList[0].spend, leads: adList[0].leads, thumbnail_url: adList[0].thumbnail_url }
          : null;

        // ===== SEVERITY =====
        const reasons: string[] = [];
        let sev: DiagSeverity = "healthy";

        if (!isActive) {
          sev = "inactive";
          reasons.push(`Campanha não está ativa no momento (status atual: ${status || "—"}).`);
        } else if (hoursActive < 24 || spend < minSpendThreshold) {
          sev = "initial";
          reasons.push(`Estado inicial — ativa há ${formatAge(hoursActive)} com R$ ${spend.toFixed(2)} investido.`);
          if (leads > 0) reasons.push(`Já gerou ${leads} lead(s) no início — bom sinal.`);
        } else {
          // Has at least 24h and meaningful spend
          // Critical: gastou sem lead há ≥ 2 dias
          if (leads === 0 && daysActive >= 2 && spend >= Math.max(minSpendThreshold, effectiveTargetCpl)) {
            sev = "critical";
            reasons.push(`${formatAge(hoursActive)} ativa, gastou R$ ${spend.toFixed(2)} e nenhum lead gerado.`);
          }
          // Critical: gastou ≥ 2x CPL alvo sem 1 lead sequer
          else if (leads === 0 && spend >= effectiveTargetCpl * 2) {
            sev = "critical";
            reasons.push(`Gastou R$ ${spend.toFixed(2)} (≥ 2× alvo R$ ${effectiveTargetCpl.toFixed(2)}) sem gerar leads.`);
          }
          // Has leads — evaluate CPL
          else if (leads > 0) {
            const ratio = cpl / effectiveTargetCpl;
            // Volume protector: campanha que gera muitos leads não vira crítica por CPL agregado
            const isHighVolume = leads >= 20;
            if (ratio >= 2.5 && !isHighVolume && daysActive >= 2) {
              sev = "critical";
              reasons.push(`CPL R$ ${cpl.toFixed(2)} é ${ratio.toFixed(1)}× o alvo (R$ ${effectiveTargetCpl.toFixed(2)}) com poucos leads.`);
            } else if (ratio >= 1.4) {
              sev = "warning";
              if (isHighVolume) {
                reasons.push(`Gera volume (${leads} leads) mas CPL R$ ${cpl.toFixed(2)} está ${Math.round((ratio - 1) * 100)}% acima do alvo R$ ${effectiveTargetCpl.toFixed(2)}.`);
              } else {
                reasons.push(`CPL R$ ${cpl.toFixed(2)} acima do alvo R$ ${effectiveTargetCpl.toFixed(2)} (${Math.round((ratio - 1) * 100)}% acima).`);
              }
            } else if (ratio >= 1.15) {
              sev = "observation";
              reasons.push(`CPL R$ ${cpl.toFixed(2)} levemente acima do alvo R$ ${effectiveTargetCpl.toFixed(2)}.`);
            } else {
              sev = "healthy";
              reasons.push(`CPL R$ ${cpl.toFixed(2)} dentro do alvo R$ ${effectiveTargetCpl.toFixed(2)} · ${leads} lead(s).`);
            }
          }

          // Trend modifiers
          if (trend === "oscillating" && sev !== "critical") {
            if (sev === "healthy") sev = "observation";
            reasons.push(`Resultados oscilando bastante entre os dias — monitorar.`);
          } else if (trend === "worsening" && sev === "healthy") {
            sev = "observation";
            reasons.push(`Tendência de piora nos últimos dias.`);
          } else if (trend === "improving" && (sev === "warning" || sev === "observation")) {
            reasons.push(`Tendência de melhora nos últimos dias.`);
          }

          // Saturation hint (does not escalate to critical alone)
          if (frequency > 3.5 && ctr < 1 && sev !== "critical") {
            if (sev === "healthy") sev = "observation";
            reasons.push(`Frequência ${frequency.toFixed(2)} com CTR ${ctr.toFixed(2)}% — possível saturação.`);
          }
        }

        // Build summary
        let summary = "";
        const ageStr = isActive ? `Ativa há ${formatAge(hoursActive)}` : "Inativa";
        if (sev === "critical") {
          const culprit = worstAd
            ? ` Anúncio "${worstAd.name}" (${worstAd.leads === 0 ? `gastou R$ ${worstAd.spend.toFixed(2)} sem leads` : `CPL R$ ${worstAd.cpl.toFixed(2)}`}) e conjunto "${worstAdset?.name ?? "—"}" puxando o resultado.`
            : "";
          summary = `🚨 Crítico — ${ageStr}. ${reasons[0]}${culprit} Alvo CPL: R$ ${effectiveTargetCpl.toFixed(2)}.`;
        } else if (sev === "warning") {
          summary = `⚠️ Atenção — ${ageStr}. ${reasons[0]}`;
        } else if (sev === "observation") {
          summary = `👀 Observação — ${ageStr}. ${reasons[0]}`;
        } else if (sev === "initial") {
          summary = `🌱 Estado inicial — ${ageStr}. Ainda em fase de aprendizado, sem alertas.`;
        } else if (sev === "inactive") {
          summary = `⏸️ Inativa — não gerando dados no momento.`;
        } else {
          summary = `✅ Saudável — ${ageStr}. ${reasons[0]}`;
        }

        return {
          id: c.id, name: c.name,
          accountId: acc?.id ?? "", accountName: acc?.name ?? "—",
          campaignStatus: status, isActive,
          lastActivatedAt: c.last_activated_at ?? null,
          cycleStartDate, hoursActive, daysActive,
          effectiveTargetCpl, minSpendThreshold,
          spend, leads, cpl, ctr, frequency,
          status: sev, reasons, summary, trend,
          worstAdset, worstAd,
        };
      });
    },
  });
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(1)} dias`;
  return `${Math.round(days)} dias`;
}
