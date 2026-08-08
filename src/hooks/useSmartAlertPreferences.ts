import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SMART_ALERT_PREFERENCES, normalizeSmartAlertPreferences, type SmartAlertPreferences } from "@/lib/smartAlerts";

export function useSmartAlertPreferences() {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const queryKey = ["smart-alert-preferences", user?.id, workspace?.id];
  const query = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("notification_preferences").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return normalizeSmartAlertPreferences(data?.notification_preferences);
    },
  });
  const mutation = useMutation({
    mutationFn: async (next: SmartAlertPreferences) => {
      if (!user) throw new Error("Sessão ausente.");
      const { error } = await supabase.from("profiles").update({ notification_preferences: next }).eq("user_id", user.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, normalizeSmartAlertPreferences(next));
    },
  });
  return {
    preferences: query.data || DEFAULT_SMART_ALERT_PREFERENCES,
    isLoading: query.isLoading,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: query.error || mutation.error,
  };
}

export async function requestSmartAlertBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

