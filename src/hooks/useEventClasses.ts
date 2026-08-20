import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EventClassStatus = "open" | "sold_out" | "upcoming" | "cancelled" | "finished";
export type MemberType = "student" | "model_patient";

export interface EventClassSource {
  id?: string;
  event_class_id?: string;
  ad_account_id: string | null;
  rd_funnel_id: string;
  member_type: MemberType;
  allowed_stage_ids: string[];
  label?: string | null;
  funnel_name?: string;
  ad_account_name?: string;
}

export interface EventClass {
  id: string;
  user_id: string;
  ad_account_id: string | null;
  rd_funnel_id: string | null;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  max_students: number;
  max_people: number;
  max_model_patients: number;
  /** Occupancy registered outside RD Station (walk-ins, spreadsheets, etc.). */
  manual_student_count: number;
  manual_model_patient_count: number;
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
  /** People linked to RD deals only. */
  linkedStudentCount: number;
  /** Model patients linked to RD deals only. */
  linkedModelPatientCount: number;
  /** Total occupied slots: RD links plus the manual occupancy. */
  studentCount: number;
  modelPatientCount: number;
  rd_funnel_name?: string;
  rd_model_patient_funnel_name?: string;
  sources: EventClassSource[];
}

export interface RannielyClassSales {
  studentSP: number;
  studentTO: number;
  modelPatientSP: number;
  modelPatientTO: number;
}

const emptyRannielyClassSales: RannielyClassSales = {
  studentSP: 0, studentTO: 0, modelPatientSP: 0, modelPatientTO: 0,
};

function normalizeClassRegion(value: string | null) {
  const normalized = (value || "").trim().toLocaleLowerCase("pt-BR");
  if (["sp", "são paulo", "sao paulo"].includes(normalized)) return "SP";
  if (["to", "tocantins"].includes(normalized)) return "TO";
  return null;
}

/** Confirmed Ranniely sales, split exactly as the class operation needs them. */
export function useRannielyClassSales() {
  return useQuery({
    queryKey: ["ranniely-class-sales"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<RannielyClassSales> => {
      const { data: funnels, error: funnelError } = await supabase
        .from("rd_funnels")
        .select("id, name")
        .ilike("name", "%Ranniely%");
      if (funnelError) throw funnelError;

      const studentFunnels = (funnels || []).filter((f: any) => /aluna/i.test(f.name)).map((f: any) => f.id);
      const modelFunnels = (funnels || []).filter((f: any) => /paciente\s*modelo/i.test(f.name)).map((f: any) => f.id);
      const funnelIds = [...studentFunnels, ...modelFunnels];
      if (funnelIds.length === 0) return emptyRannielyClassSales;

      const { data: deals, error: dealError } = await supabase
        .from("rd_deals")
        .select("rd_funnel_id, lead_state")
        .eq("win", true)
        .in("rd_funnel_id", funnelIds);
      if (dealError) throw dealError;

      return (deals || []).reduce<RannielyClassSales>((total, deal: any) => {
        const region = normalizeClassRegion(deal.lead_state);
        if (!region) return total;
        const isStudent = studentFunnels.includes(deal.rd_funnel_id);
        if (isStudent && region === "SP") total.studentSP += 1;
        if (isStudent && region === "TO") total.studentTO += 1;
        if (!isStudent && modelFunnels.includes(deal.rd_funnel_id) && region === "SP") total.modelPatientSP += 1;
        if (!isStudent && modelFunnels.includes(deal.rd_funnel_id) && region === "TO") total.modelPatientTO += 1;
        return total;
      }, { ...emptyRannielyClassSales });
    },
  });
}

export function useEventClasses() {
  return useQuery({
    queryKey: ["event_classes"],
    refetchInterval: 30_000,
    queryFn: async () => {
      // Adds only confirmed, region-compatible RD deals and never changes a
      // manually linked member. This keeps occupancy current after every sync.
      await (supabase as any).rpc("sync_event_class_members_from_rd");
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

      const { data: sourceRows, error: sourceError } = await (supabase as any)
        .from("event_class_sources")
        .select("id, event_class_id, ad_account_id, rd_funnel_id, member_type, allowed_stage_ids, label")
        .in("event_class_id", ids);
      if (sourceError) throw sourceError;

      const sourcesByClass = new Map<string, EventClassSource[]>();
      (sourceRows || []).forEach((source: EventClassSource) => {
        const current = sourcesByClass.get(source.event_class_id!) || [];
        current.push(source);
        sourcesByClass.set(source.event_class_id!, current);
      });
      // Fallback for an existing deployment that has not yet received the migration.
      list.forEach((eventClass) => {
        if (sourcesByClass.has(eventClass.id)) return;
        const legacy = [
          eventClass.rd_funnel_id && { ad_account_id: eventClass.ad_account_id, rd_funnel_id: eventClass.rd_funnel_id, member_type: "student" as const, allowed_stage_ids: eventClass.allowed_student_stage_ids },
          eventClass.has_model_patients && eventClass.rd_model_patient_funnel_id && { ad_account_id: eventClass.ad_account_id, rd_funnel_id: eventClass.rd_model_patient_funnel_id, member_type: "model_patient" as const, allowed_stage_ids: eventClass.allowed_model_patient_stage_ids },
        ].filter(Boolean) as EventClassSource[];
        sourcesByClass.set(eventClass.id, legacy);
      });
      const funnelIds = Array.from(new Set(
        [...sourcesByClass.values()].flat().map((source) => source.rd_funnel_id).filter(Boolean),
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

      return list.map((c) => {
        const sources = (sourcesByClass.get(c.id) || []).map((source) => ({ ...source, funnel_name: funnelMap.get(source.rd_funnel_id) }));
        return ({
        ...c,
        linkedStudentCount: countMap.get(c.id)?.s ?? 0,
        linkedModelPatientCount: countMap.get(c.id)?.p ?? 0,
        studentCount: (countMap.get(c.id)?.s ?? 0) + Number(c.manual_student_count || 0),
        modelPatientCount: (countMap.get(c.id)?.p ?? 0) + Number(c.manual_model_patient_count || 0),
        rd_funnel_name: funnelMap.get(c.rd_funnel_id) as string | undefined,
        rd_model_patient_funnel_name: c.rd_model_patient_funnel_id
          ? (funnelMap.get(c.rd_model_patient_funnel_id) as string | undefined)
          : undefined,
        sources,
      });
      }) as EventClassWithCounts[];
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
    mutationFn: async (input: Omit<EventClass, "id" | "user_id" | "created_at" | "updated_at"> & { sources?: EventClassSource[] }) => {
      const { sources = [], ...eventClassInput } = input;
      const { data, error } = await (supabase as any)
        .from("event_classes")
        .insert({ ...eventClassInput, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      if (sources.length > 0) {
        const { error: sourcesError } = await (supabase as any).from("event_class_sources").insert(
          sources.map((source) => ({ ...source, id: undefined, event_class_id: data.id })),
        );
        if (sourcesError) throw sourcesError;
      }
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
    mutationFn: async ({ id, sources, ...input }: Partial<EventClass> & { id: string; sources?: EventClassSource[] }) => {
      const { data, error } = await (supabase as any)
        .from("event_classes").update(input).eq("id", id).select().single();
      if (error) throw error;
      if (sources) {
        const { error: deleteError } = await (supabase as any).from("event_class_sources").delete().eq("event_class_id", id);
        if (deleteError) throw deleteError;
        if (sources.length > 0) {
          const { error: sourcesError } = await (supabase as any).from("event_class_sources").insert(
            sources.map((source) => ({ ...source, id: undefined, event_class_id: id })),
          );
          if (sourcesError) throw sourcesError;
        }
      }
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
