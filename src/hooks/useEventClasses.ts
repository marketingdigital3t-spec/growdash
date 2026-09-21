import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EventClassStatus = "open" | "sold_out" | "upcoming" | "cancelled" | "finished";
export type MemberType = "student" | "model_patient";

export interface EventClass {
  id: string; user_id: string; expert_name: string | null; title: string; date_start: string; date_end: string | null; location: string | null;
  max_students: number; max_people: number; max_model_patients: number; status: EventClassStatus; notes: string | null; created_at: string; updated_at: string;
  ad_account_id?: string | null; rd_funnel_id?: string | null; rd_model_patient_funnel_id?: string | null; has_model_patients?: boolean;
  allowed_student_stage_ids?: string[]; allowed_model_patient_stage_ids?: string[];
}

export interface EventClassParticipant {
  id: string; event_class_id: string; participant_type: MemberType; name: string; investment_cents: number; notes: string | null; created_at: string; updated_at: string;
}

export interface EventClassWithCounts extends EventClass {
  studentCount: number; modelPatientCount: number; participants: EventClassParticipant[]; linkedStudentCount: 0; linkedModelPatientCount: 0;
  manual_student_count: number; manual_model_patient_count: number; has_model_patients: boolean; sources: [];
}

type ClassInput = Omit<EventClass, "id" | "user_id" | "created_at" | "updated_at">;

export function useEventClasses() {
  return useQuery({
    queryKey: ["event_classes", "manual"], refetchInterval: 5 * 60_000, refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data: classes, error } = await supabase.from("event_classes").select("*").order("date_start", { ascending: true });
      if (error) throw error;
      const list = (classes || []) as unknown as EventClass[];
      if (!list.length) return [] as EventClassWithCounts[];
      const ids = list.map((item) => item.id);
      const { data: participants, error: participantError } = await supabase.from("event_class_participants").select("*").in("event_class_id", ids).order("created_at", { ascending: true });
      if (participantError) throw participantError;
      const byClass = new Map<string, EventClassParticipant[]>();
      ((participants || []) as unknown as EventClassParticipant[]).forEach((participant) => { const current = byClass.get(participant.event_class_id) || []; current.push(participant); byClass.set(participant.event_class_id, current); });
      return list.map((eventClass) => {
        const rows = byClass.get(eventClass.id) || [];
        return { ...eventClass, participants: rows, studentCount: rows.filter((row) => row.participant_type === "student").length, modelPatientCount: rows.filter((row) => row.participant_type === "model_patient").length, linkedStudentCount: 0 as const, linkedModelPatientCount: 0 as const, manual_student_count: rows.filter((row) => row.participant_type === "student").length, manual_model_patient_count: rows.filter((row) => row.participant_type === "model_patient").length, has_model_patients: Number(eventClass.max_model_patients || 0) > 0, sources: [] as [] };
      }) as EventClassWithCounts[];
    },
  });
}

export function useCreateEventClass() { const qc = useQueryClient(); const { user } = useAuth(); return useMutation({ mutationFn: async (input: ClassInput) => { const { data, error } = await supabase.from("event_classes").insert({ ...input, user_id: user!.id }).select().single(); if (error) throw error; return data as unknown as EventClass; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }
export function useUpdateEventClass() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, ...input }: Partial<ClassInput> & { id: string }) => { const { data, error } = await supabase.from("event_classes").update(input).eq("id", id).select().single(); if (error) throw error; return data as unknown as EventClass; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }
export function useDeleteEventClass() { const qc = useQueryClient(); return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("event_classes").delete().eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["event_classes"] }) }); }

export function useEventClassParticipants(eventClassId: string | null, type: MemberType) { return useQuery({ queryKey: ["event_class_participants", eventClassId, type], enabled: !!eventClassId, queryFn: async () => { const { data, error } = await supabase.from("event_class_participants").select("*").eq("event_class_id", eventClassId!).eq("participant_type", type).order("created_at", { ascending: true }); if (error) throw error; return (data || []) as unknown as EventClassParticipant[]; } }); }
export function useCreateEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async (input: { event_class_id: string; participant_type: MemberType; name: string; investment_cents: number; notes?: string | null }) => { const name = input.name.trim(); if (!name) throw new Error("Informe o nome do participante."); const { data, error } = await supabase.from("event_class_participants").insert({ ...input, name }).select().single(); if (error) throw error; return data as unknown as EventClassParticipant; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.event_class_id] }); } }); }
export function useUpdateEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, event_class_id, name, investment_cents, notes }: { id: string; event_class_id: string; name: string; investment_cents: number; notes?: string | null }) => { const { data, error } = await supabase.from("event_class_participants").update({ name: name.trim(), investment_cents, notes: notes || null }).eq("id", id).select().single(); if (error) throw error; return data as unknown as EventClassParticipant; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.event_class_id] }); } }); }
export function useDeleteEventClassParticipant() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, eventClassId }: { id: string; eventClassId: string }) => { const { error } = await supabase.from("event_class_participants").delete().eq("id", id); if (error) throw error; }, onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["event_classes"] }); qc.invalidateQueries({ queryKey: ["event_class_participants", vars.eventClassId] }); } }); }
