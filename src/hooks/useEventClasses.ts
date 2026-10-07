import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveUniqueEventClassAccount } from "@/lib/eventClassAccountLinking";

export type EventClassStatus = "open" | "sold_out" | "upcoming" | "cancelled" | "finished";
export type MemberType = "student" | "model_patient";

export interface EventClass {
  id: string; user_id: string; expert_id?: string | null; expert_name: string | null; title: string; date_start: string; date_end: string | null; location: string | null;
  max_students: number; max_people: number; max_model_patients: number; status: EventClassStatus; notes: string | null; created_at: string; updated_at: string;
  ad_account_id?: string | null; ad_account_ids?: string[]; rd_funnel_id?: string | null; rd_model_patient_funnel_id?: string | null; has_model_patients?: boolean;
  allowed_student_stage_ids?: string[]; allowed_model_patient_stage_ids?: string[];
  archived_at?: string | null; archived_by?: string | null; archive_reason?: string | null;
}

export interface EventClassParticipant {
  id: string; event_class_id: string; participant_type: MemberType; name: string; investment_cents: number; notes: string | null; created_at: string; updated_at: string;
}

export interface EventClassWithCounts extends EventClass {
  studentCount: number; modelPatientCount: number; participants: EventClassParticipant[]; linkedStudentCount: 0; linkedModelPatientCount: 0;
  manual_student_count: number; manual_model_patient_count: number; has_model_patients: boolean; sources: [];
}

type ClassInput = Omit<EventClass, "id" | "user_id" | "created_at" | "updated_at" | "ad_account_ids"> & { ad_account_ids: string[] };

export function useEventClasses() {
  return useQuery({
    queryKey: ["event_classes", "manual"], refetchInterval: 5 * 60_000, refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data: classes, error } = await supabase.from("event_classes").select("*").order("date_start", { ascending: true });
      if (error) throw error;
      const list = (classes || []) as unknown as EventClass[];
      if (!list.length) return [] as EventClassWithCounts[];
      const ids = list.map((item) => item.id);
      const { data: accountLinks, error: accountLinkError } = await (supabase as any).from("event_class_accounts").select("event_class_id,ad_account_id").in("event_class_id", ids);
      if (accountLinkError) throw accountLinkError;
      const accountsByClass = new Map<string, string[]>();
      (accountLinks || []).forEach((link: any) => accountsByClass.set(link.event_class_id, [...(accountsByClass.get(link.event_class_id) || []), link.ad_account_id]));
      const { data: participants, error: participantError } = await supabase.from("event_class_participants").select("*").in("event_class_id", ids).order("created_at", { ascending: true });
      if (participantError) throw participantError;
      const byClass = new Map<string, EventClassParticipant[]>();
      ((participants || []) as unknown as EventClassParticipant[]).forEach((participant) => { const current = byClass.get(participant.event_class_id) || []; current.push(participant); byClass.set(participant.event_class_id, current); });
      return list.map((eventClass) => {
        const rows = byClass.get(eventClass.id) || [];
        return { ...eventClass, ad_account_ids: accountsByClass.get(eventClass.id) || (eventClass.ad_account_id ? [eventClass.ad_account_id] : []), participants: rows, studentCount: rows.filter((row) => row.participant_type === "student").length, modelPatientCount: rows.filter((row) => row.participant_type === "model_patient").length, linkedStudentCount: 0 as const, linkedModelPatientCount: 0 as const, manual_student_count: rows.filter((row) => row.participant_type === "student").length, manual_model_patient_count: rows.filter((row) => row.participant_type === "model_patient").length, has_model_patients: Number(eventClass.max_model_patients || 0) > 0, sources: [] as [] };
      }) as EventClassWithCounts[];
    },
  });
}


/** Associates legacy classes only when the expert has exactly one linked ad account. */
export function useBackfillEventClassAccounts(classes: EventClass[] | undefined) {
  const queryClient = useQueryClient();
  const processed = useRef<string>("");
  useEffect(() => {
    const legacy = (classes || []).filter((eventClass) => !eventClass.ad_account_id);
    if (!legacy.length) return;
    const key = legacy.map((eventClass) => eventClass.id).sort().join(",");
    if (processed.current === key) return;
    processed.current = key;
    let cancelled = false;
    void (async () => {
      const { data: links, error: linksError } = await (supabase as any)
        .from("expert_operation_sources")
        .select("expert_id,ad_account_id")
        .not("ad_account_id", "is", null);
      if (cancelled || linksError) return;
      const { data: experts, error: expertsError } = await (supabase as any)
        .from("experts")
        .select("id,nome");
      if (cancelled || expertsError) return;
      let changed = false;
      for (const eventClass of legacy) {
        const accountId = resolveUniqueEventClassAccount(eventClass, links || [], experts || []);
        if (!accountId) continue;
        const { error } = await (supabase as any).from("event_classes").update({ ad_account_id: accountId }).eq("id", eventClass.id).is("ad_account_id", null);
        if (!error) changed = true;
      }
      if (changed && !cancelled) void queryClient.invalidateQueries({ queryKey: ["event_classes"] });
    })();
    return () => { cancelled = true; };
  }, [classes, queryClient]);
}

async function replaceEventClassAccounts(eventClassId: string, accountIds: string[]) {
  const { error: deleteError } = await (supabase as any).from("event_class_accounts").delete().eq("event_class_id", eventClassId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await (supabase as any).from("event_class_accounts").insert(accountIds.map((ad_account_id) => ({ event_class_id: eventClassId, ad_account_id })));
  if (insertError) throw insertError;
}

export function useCreateEventClass() { const qc = useQueryClient(); const { user } = useAuth(); return useMutation({ mutationFn: async (input: ClassInput) => { const accountIds = Array.from(new Set(input.ad_account_ids)); const { ad_account_ids: _accountIds, ...eventClassInput } = input; const { data, error } = await supabase.from("event_classes").insert({ ...eventClassInput, ad_account_id: accountIds[0], user_id: user!.id }).select().single(); if (error) throw error; await replaceEventClassAccounts(data.id, accountIds); return data as unknown as EventClass; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }
export function useUpdateEventClass() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, ...input }: Partial<ClassInput> & { id: string }) => { const accountIds = Array.from(new Set(input.ad_account_ids || (input.ad_account_id ? [input.ad_account_id] : []))); const { ad_account_ids: _accountIds, ...eventClassInput } = input as any; if (accountIds.length) eventClassInput.ad_account_id = accountIds[0]; const { data, error } = await supabase.from("event_classes").update(eventClassInput).eq("id", id).select().single(); if (error) throw error; if (accountIds.length) await replaceEventClassAccounts(id, accountIds); return data as unknown as EventClass; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }
export function useDeleteEventClass() { const qc = useQueryClient(); return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("event_classes").delete().eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }

export function useArchiveEventClass() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) => {
      const { data, error } = await (supabase as any)
        .from("event_classes")
        .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null, archive_reason: reason?.trim() || null })
        .eq("id", id)
        .select("id,title,status,archived_at")
        .single();
      if (error) throw error;
      const { error: historyError } = await (supabase as any).from("event_class_history").insert({
        event_class_id: id,
        actor_id: user?.id ?? null,
        action: "archived",
        description: reason?.trim() || "Turma arquivada na Agenda & Turmas.",
        metadata: { archived_at: data.archived_at },
      });
      if (historyError) throw historyError;
      return data as EventClass;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["event_classes"] }); void qc.invalidateQueries({ queryKey: ["expert-operation-classes"] }); },
  });
}

export function useRestoreEventClass() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await (supabase as any).from("event_classes").update({ archived_at: null, archived_by: null, archive_reason: null }).eq("id", id).select("id,title,status").single();
      if (error) throw error;
      const { error: historyError } = await (supabase as any).from("event_class_history").insert({ event_class_id: id, actor_id: user?.id ?? null, action: "restored", description: "Turma restaurada na Agenda & Turmas.", metadata: { status: data.status } });
      if (historyError) throw historyError;
      return data as EventClass;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["event_classes"] }); void qc.invalidateQueries({ queryKey: ["expert-operation-classes"] }); },
  });
}

export function useEventClassParticipants(eventClassId: string | null, type: MemberType) { return useQuery({ queryKey: ["event_class_participants", eventClassId, type], enabled: !!eventClassId, queryFn: async () => { const { data, error } = await supabase.from("event_class_participants").select("*").eq("event_class_id", eventClassId!).eq("participant_type", type).order("created_at", { ascending: true }); if (error) throw error; return (data || []) as unknown as EventClassParticipant[]; } }); }
export function useCreateEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async (input: { event_class_id: string; participant_type: MemberType; name: string; investment_cents: number; notes?: string | null }) => { const name = input.name.trim(); if (!name) throw new Error("Informe o nome do participante."); const { data, error } = await supabase.from("event_class_participants").insert({ ...input, name }).select().single(); if (error) throw error; return data as unknown as EventClassParticipant; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.event_class_id] }); } }); }
export function useUpdateEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, event_class_id, name, investment_cents, notes }: { id: string; event_class_id: string; name: string; investment_cents: number; notes?: string | null }) => { const { data, error } = await supabase.from("event_class_participants").update({ name: name.trim(), investment_cents, notes: notes || null }).eq("id", id).select().single(); if (error) throw error; return data as unknown as EventClassParticipant; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.event_class_id] }); } }); }
export function useDeleteEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, eventClassId }: { id: string; eventClassId: string }) => { const { error } = await supabase.from("event_class_participants").delete().eq("id", id); if (error) throw error; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.eventClassId] }); } }); }
