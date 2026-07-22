import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDateString } from "@/lib/dateRange";


export interface Sale {
  id: string;
  user_id: string;
  product_id: string | null;
  ad_account_id: string | null;
  campaign_ids: string[];
  sale_date: string;
  gross_revenue: number;
  net_revenue: number;
  tax_amount: number;
  refund_amount: number;
  chargeback_amount: number;
  payment_method: string;
  payment_method_source?: string | null;
  custom_fields?: Record<string, string> | null;
  status: string;
  quantity: number;
  notes: string | null;
  lead_state: string | null;
  lead_formation: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  lead_city: string | null;
  lead_entry_date: string | null;
  adset_id: string | null;
  ad_id: string | null;
  rd_deal_id: string | null;
  rd_campaign_name: string | null;
  rd_product_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  manual_platform: string | null;
  created_at: string;
  updated_at: string;
}

interface UseSalesParams {
  startDate?: Date;
  endDate?: Date;
  productId?: string;
  adAccountId?: string;
}

export function useSales(params?: UseSalesParams) {
  return useQuery({
    queryKey: ["sales", params?.startDate?.toISOString(), params?.endDate?.toISOString(), params?.productId, params?.adAccountId],
    queryFn: async () => {
      let query = (supabase as any).from("sales").select("*").order("sale_date", { ascending: false });

      if (params?.startDate) {
        query = query.gte("sale_date", toLocalDateString(params.startDate));
      }
      if (params?.endDate) {
        query = query.lte("sale_date", toLocalDateString(params.endDate));
      }

      if (params?.productId && params.productId !== "all") {
        query = query.eq("product_id", params.productId);
      }
      if (params?.adAccountId && params.adAccountId !== "all") {
        query = query.eq("ad_account_id", params.adAccountId);
      }

      // Paginar para evitar o corte de 1000 linhas do Supabase.
      const PAGE = 1000;
      const MAX_PAGES = 10;
      let all: Sale[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await query.range(from, to);
        if (error) throw error;
        const batch = (data || []) as Sale[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
        if (page === MAX_PAGES - 1) {
          console.warn(`[useSales] hit MAX_PAGES (${MAX_PAGES}) — possible truncation`);
        }
      }
      return all;
    },
  });
}

export interface CreateSaleInput {
  product_id?: string | null;
  ad_account_id?: string | null;
  campaign_ids?: string[];
  sale_date: string;
  gross_revenue: number;
  net_revenue: number;
  tax_amount: number;
  refund_amount?: number;
  chargeback_amount?: number;
  payment_method: string;
  status: string;
  quantity: number;
  notes?: string;
  lead_state?: string | null;
  lead_formation?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  lead_city?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  manual_platform?: string | null;
}

export function useCreateSale() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data, error } = await (supabase as any)
        .from("sales")
        .insert({ ...input, user_id: session!.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateSaleInput> & { id: string }) => {
      const payload: Record<string, any> = { ...input };
      if (Object.prototype.hasOwnProperty.call(input, "payment_method")) {
        payload.payment_method_source = "manual";
      }
      const { data, error } = await (supabase as any)
        .from("sales")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function aggregateSales(sales: Sale[]) {
  const confirmed = sales.filter((s) => s.status === "confirmed" || s.status === "pending");
  const totalGross = confirmed.reduce((sum, s) => sum + s.gross_revenue, 0);
  const totalNet = confirmed.reduce((sum, s) => sum + s.net_revenue, 0);
  const totalTax = confirmed.reduce((sum, s) => sum + s.tax_amount, 0);
  const totalRefund = sales.reduce((sum, s) => sum + s.refund_amount, 0);
  const totalChargeback = sales.reduce((sum, s) => sum + s.chargeback_amount, 0);
  const totalQuantity = confirmed.reduce((sum, s) => sum + s.quantity, 0);

  const pendingRevenue = sales
    .filter((s) => s.status === "pending" || (s.payment_method === "boleto" && s.status !== "confirmed"))
    .reduce((sum, s) => sum + s.net_revenue, 0);

  const byPayment = {
    pix: sales.filter((s) => s.payment_method === "pix" && s.status === "confirmed").reduce((sum, s) => sum + s.net_revenue, 0),
    cartao: sales.filter((s) => s.payment_method === "cartao" && s.status === "confirmed").reduce((sum, s) => sum + s.net_revenue, 0),
    boleto: sales.filter((s) => s.payment_method === "boleto" && s.status === "confirmed").reduce((sum, s) => sum + s.net_revenue, 0),
    outros: sales.filter((s) => s.payment_method === "outros" && s.status === "confirmed").reduce((sum, s) => sum + s.net_revenue, 0),
  };

  const receivables = sales
    .filter((s) => s.payment_method === "boleto" && s.status === "pending")
    .reduce((sum, s) => sum + s.net_revenue, 0);

  const refundRate = totalGross > 0 ? (totalRefund / totalGross) * 100 : 0;
  const chargebackRate = totalGross > 0 ? (totalChargeback / totalGross) * 100 : 0;
  const arpu = totalQuantity > 0 ? totalNet / totalQuantity : 0;

  return {
    totalGross, totalNet, totalTax, totalRefund, totalChargeback,
    totalQuantity, pendingRevenue, byPayment, receivables,
    refundRate, chargebackRate, arpu,
  };
}
