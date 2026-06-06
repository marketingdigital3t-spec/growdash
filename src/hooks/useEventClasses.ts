import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EventClassStatus = "open" | "sold_out" | "upcoming" | "cancelled" | "finished";
export type MemberType = "student" | "model_patient";

export interface EventClass {
  id: string;
  user_id: string;
  ad_account_id: string;
  rd_funnel_id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  max_students: number;
  max_people: number;
  max_model_patients: number;
  has_model_patients: boolean;
  rd_model_patient_funnel_id: string | null;
  status: EventClassStatus;
  allowed_student_stage_ids: string[];
  allowed_model_patient_stage_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventClassMember {
  id: string;
  event_class_id: string;
  rd_deal_id: string;
  member_type: MemberType;
  linked_by: string | null;
  linked_at: string;
  last_synced_at: string | null;
}

export interface EventClassWithCounts extends EventClass {
  studentCount: number;
  modelPatientCount: number;
  rd_funnel_name?: string;
  rd_model_patient_funnel_name?: string;
}

export function useEventClasses() {
  return useQuery({
    queryKey: ["event_classes"],
    queryFn: async () => {
      const { data: classes, error } = await (supabase as any)
        .from("event_classes")
        .select("*")
        .order("date_start", { ascending: true });
      if (error) throw error;

      const list = (classes || []) as EventClass[];
      if (list.length === 0) return [] as EventClassWithCounts[];

      const ids = list.map((c) => c.id);
      const { data: members } = await (supabase as any)
        .from("event_class_members")
        .select("event_class_id, member_type")
        .in("event_class_id", ids);

      const funnelIds = Array.from(new Set(
        list.flatMap((c) => [c.rd_funnel_id, c.rd_model_patient_funnel_id]).filter(Boolean) as string[],
      ));
      const { data: funnels } = funnelIds.length > 0
        ? await supabase.from("rd_funnels").select("id, name").in("id", funnelIds)
        : { data: [] as any[] };
      const funnelMap = new Map((funnels || []).map((f: any) => [f.id, f.name]));

      const countMap = new Map<string, { s: number; p: number }>();
      (members || []).forEach((m: any) => {
        const cur = countMap.get(m.event_class_id) || { s: 0, p: 0 };
        if (m.member_type === "student") cur.s++;
        else cur.p++;
        countMap.set(m.event_class_id, cur);
      });

      return list.map((c) => ({
        ...c,
        studentCount: countMap.get(c.id)?.s ?? 0,
        modelPatientCount: countMap.get(c.id)?.p ?? 0,
        rd_funnel_name: funnelMap.get(c.rd_funnel_id) as string | undefined,
        rd_model_patient_funnel_name: c.rd_model_patient_funnel_id
          ? (funnelMap.get(c.rd_model_patient_funnel_id) as string | undefined)
          : undefined,
      })) as EventClassWithCounts[];
    },
  });
}

export function useEventClassMembers(eventClassId: string | null, type: MemberType) {
  return useQuery({
    queryKey: ["event_class_members", eventClassId, type],
    enabled: !!eventClassId,
    queryFn: async () => {
      const { data: members, error } = await (supabase as any)
        .from("event_class_members")
        .select("*")
        .eq("event_class_id", eventClassId!)
        .eq("member_type", type)
        .order("linked_at", { ascending: false });
      if (error) throw error;
      const list = (members || []) as EventClassMember[];
      if (list.length === 0) return [];

      const dealIds = list.map((m) => m.rd_deal_id);
      const { data: deals } = await supabase
        .from("rd_deals")
        .select("rd_deal_id, rd_stage_name, rd_stage_id, deal_owner_name, amount_total, lead_state, lead_city, utm_campaign, utm_source, stage_bucket, win, closed_at, lead_created_at")
        .in("rd_deal_id", dealIds);

      const { data: sales } = await supabase
        .from("sales")
        .select("rd_deal_id, contact_name, contact_email, contact_phone")
        .in("rd_deal_id", dealIds);

      const dealMap = new Map((deals || []).map((d: any) => [d.rd_deal_id, d]));
      const saleMap = new Map((sales || []).map((s: any) => [s.rd_deal_id, s]));

      return list.map((m) => ({
        ...m,
        deal: dealMap.get(m.rd_deal_id) || null,
        sale: saleMap.get(m.rd_deal_id) || null,
      }));
    },
  });
}

export function useCreateEventClass() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<EventClass, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("event_classes")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      await (supabase as any).from("event_class_history").insert({
        event_class_id: data.id, actor_id: user!.id, action: "created",
        description: `Turma "${input.title}" criada`,
      });
      return data as EventClass;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }),
  });
}

export function useUpdateEventClass() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<EventClass> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("event_classes").update(input).eq("id", id).select().single();
      if (error) throw error;
      await (supabase as any).from("event_class_history").insert({
        event_class_id: id, actor_id: user?.id, action: "updated",
        description: "Turma atualizada",
      });
      return data as EventClass;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }),
  });
}

export function useDeleteEventClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("event_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }),
  });
}

export function useAddEventClassMember() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ eventClassId, rdDealId, memberType, dealName }: {
      eventClassId: string; rdDealId: string; memberType: MemberType; dealName?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("event_class_members")
        .insert({
          event_class_id: eventClassId,
          rd_deal_id: rdDealId,
          member_type: memberType,
          linked_by: user?.id,
          last_synced_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      await (supabase as any).from("event_class_history").insert({
        event_class_id: eventClassId, actor_id: user?.id,
        action: memberType === "student" ? "student_added" : "model_patient_added",
        description: `${memberType === "student" ? "Pessoa" : "Paciente-modelo"} vinculad${memberType === "student" ? "a" : "o"}${dealName ? `: ${dealName}` : ""}`,
        metadata: { rd_deal_id: rdDealId },
      });
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event_classes"] });
      qc.invalidateQueries({ queryKey: ["event_class_members", vars.eventClassId, vars.memberType] });
    },
  });
}

export function useRemoveEventClassMember() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, eventClassId, memberType }: { id: string; eventClassId: string; memberType: MemberType }) => {
      const { error } = await (supabase as any).from("event_class_members").delete().eq("id", id);
      if (error) throw error;
      await (supabase as any).from("event_class_history").insert({
        event_class_id: eventClassId, actor_id: user?.id,
        action: memberType === "student" ? "student_removed" : "model_patient_removed",
        description: `${memberType === "student" ? "Pessoa" : "Paciente-modelo"} removid${memberType === "student" ? "a" : "o"} da turma`,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event_classes"] });
      qc.invalidateQueries({ queryKey: ["event_class_members", vars.eventClassId, vars.memberType] });
    },
  });
}

export interface RDPickerResult {
  rd_deal_id: string;
  rd_stage_id: string | null;
  rd_stage_name: string | null;
  deal_owner_name: string | null;
  amount_total: number | null;
  lead_state: string | null;
  lead_city: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  closed_at: string | null;
  lead_created_at: string | null;
  win: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export function useRDDealSearch(params: {
  funnelId: string | null;
  allowedStageIds: string[];
  excludeDealIds: string[];
  query: string;
  enabled?: boolean;
}) {
  const { funnelId, allowedStageIds, excludeDealIds, query, enabled = true } = params;
  return useQuery({
    queryKey: ["rd_deal_search", funnelId, allowedStageIds, excludeDealIds.length, query],
    enabled: enabled && !!funnelId,
    queryFn: async () => {
      let q = supabase
        .from("rd_deals")
        .select("rd_deal_id, rd_stage_id, rd_stage_name, deal_owner_name, amount_total, lead_state, lead_city, utm_campaign, utm_source, closed_at, lead_created_at, win")
        .eq("rd_funnel_id", funnelId!)
        .order("lead_created_at", { ascending: false })
        .limit(200);
      if (allowedStageIds.length > 0) q = q.in("rd_stage_id", allowedStageIds);
      const { data: deals, error } = await q;
      if (error) throw error;
      const list = (deals || []) as any[];
      const filteredByExclude = list.filter((d) => !excludeDealIds.includes(d.rd_deal_id));
      if (filteredByExclude.length === 0) return [] as RDPickerResult[];

      const dealIds = filteredByExclude.map((d) => d.rd_deal_id);
      const { data: sales } = await supabase
        .from("sales")
        .select("rd_deal_id, contact_name, contact_email, contact_phone")
        .in("rd_deal_id", dealIds);
      const saleMap = new Map((sales || []).map((s: any) => [s.rd_deal_id, s]));

      const enriched: RDPickerResult[] = filteredByExclude.map((d) => {
        const s = saleMap.get(d.rd_deal_id);
        return {
          ...d,
          contact_name: s?.contact_name ?? null,
          contact_email: s?.contact_email ?? null,
          contact_phone: s?.contact_phone ?? null,
        };
      });

      if (!query.trim()) return enriched;
      const ql = query.toLowerCase();
      return enriched.filter((r) =>
        (r.contact_name || "").toLowerCase().includes(ql) ||
        (r.contact_email || "").toLowerCase().includes(ql) ||
        (r.contact_phone || "").toLowerCase().includes(ql) ||
        (r.rd_stage_name || "").toLowerCase().includes(ql) ||
        (r.deal_owner_name || "").toLowerCase().includes(ql) ||
        (r.utm_campaign || "").toLowerCase().includes(ql) ||
        r.rd_deal_id.includes(ql),
      );
    },
  });
}

export function useEventClassHistory(eventClassId: string | null) {
  return useQuery({
    queryKey: ["event_class_history", eventClassId],
    enabled: !!eventClassId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_class_history")
        .select("*")
        .eq("event_class_id", eventClassId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}
