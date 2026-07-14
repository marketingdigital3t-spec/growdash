import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateString } from "@/lib/dateRange";

export interface AuditLead {
  id: string;
  rd_deal_id: string | null;
  name: string;
  phone: string | null;
  uf: string | null;
  raw_state: string | null;
  source: string; // 'rd_contact' | 'ddd_phone' | 'rd_custom_field' | 'form_answer' | 'manual' | 'unknown'
  source_detail: string;
  created_at: string;
}

interface Params {
  adAccountId?: string;
  startDate: Date;
  endDate: Date;
}

const SOURCE_LABEL: Record<string, string> = {
  rd_contact: "Campo Estado do contato (RD)",
  ddd_phone: "Inferido pelo DDD do telefone",
  rd_custom_field: "Campo customizado do RD",
  form_answer: "Resposta do formulário Meta",
  manual: "Preenchido manualmente",
  unknown: "Sem origem identificada",
};

export function useLeadsAudit({ adAccountId, startDate, endDate }: Params) {
  const start = toLocalDateString(startDate);
  const end = toLocalDateString(endDate);
  const startISO = new Date(`${start}T00:00:00`).toISOString();
  const endISO = new Date(`${end}T23:59:59.999`).toISOString();

  return useQuery({
    queryKey: ["leads-audit", adAccountId ?? "all", start, end],
    queryFn: async (): Promise<AuditLead[]> => {
      let q = supabase
        .from("rd_deals")
        .select("id, rd_deal_id, contact_name, contact_email, lead_state, lead_state_source, lead_created_at, raw")
        .gte("lead_created_at", startISO)
        .lte("lead_created_at", endISO)
        .order("lead_created_at", { ascending: false });
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);

      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      return all.map((r: any) => {
        const raw = r.raw || {};
        const wa =
          raw?._contacts?.[0]?.phones?.[0]?.whatsapp_full_internacional ||
          raw?._contacts?.[0]?.phones?.[0]?.phone ||
          raw?.contact?.phones?.[0]?.phone ||
          raw?.contact?.phone ||
          null;
        const source = r.lead_state_source || "unknown";
        let detail = SOURCE_LABEL[source] || source;
        if (source === "ddd_phone" && wa) {
          const d = String(wa).replace(/\D/g, "");
          const ddd = d.startsWith("55") && d.length >= 12 ? d.slice(2, 4) : d.slice(0, 2);
          detail = `DDD ${ddd} → ${r.lead_state}`;
        }
        return {
          id: r.id,
          rd_deal_id: r.rd_deal_id,
          name: r.contact_name || r.contact_email || raw?._contacts?.[0]?.name || "(sem nome)",
          phone: wa,
          uf: r.lead_state,
          raw_state: raw?.contact?.state || raw?._contacts?.[0]?.state || null,
          source,
          source_detail: detail,
          created_at: r.lead_created_at,
        } as AuditLead;
      });
    },
  });
}
