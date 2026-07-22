import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface PlatformRule {
  id: string;
  user_id: string;
  platform: string;
  parent_platform: string | null;
  match_field: string;
  match_mode: "contains" | "equals" | "regex";
  pattern: string;
  priority: number;
  is_active: boolean;
  is_fallback?: boolean;
  created_at: string;
  updated_at: string;
}

export type NewPlatformRule = Omit<PlatformRule, "id" | "user_id" | "created_at" | "updated_at">;

const DEFAULT_SEEDS: NewPlatformRule[] = [
  // Top-level
  { platform: "meta", parent_platform: null, match_field: "utm_source", match_mode: "regex", pattern: "meta|facebook|instagram|fb|ig", priority: 10, is_active: true, is_fallback: false },
  { platform: "google", parent_platform: null, match_field: "utm_source", match_mode: "regex", pattern: "google|gads|adwords", priority: 20, is_active: true, is_fallback: false },
  // Organic sub-origins
  { platform: "link_bio", parent_platform: "organic", match_field: "utm_source", match_mode: "contains", pattern: "bio", priority: 10, is_active: true, is_fallback: false },
  { platform: "stories", parent_platform: "organic", match_field: "utm_source", match_mode: "regex", pattern: "story|stories", priority: 20, is_active: true, is_fallback: false },
  { platform: "dm", parent_platform: "organic", match_field: "utm_source", match_mode: "regex", pattern: "dm|direct", priority: 30, is_active: true, is_fallback: false },
  { platform: "comentario", parent_platform: "organic", match_field: "utm_source", match_mode: "contains", pattern: "coment", priority: 40, is_active: true, is_fallback: false },
];

export function usePlatformRules() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["platform_rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as PlatformRule[];
    },
  });

  // Auto-seed once
  useEffect(() => {
    if (!user || query.isLoading || !query.data) return;
    if (query.data.length > 0) return;
    (async () => {
      const rows = DEFAULT_SEEDS.map((r) => ({ ...r, user_id: user.id }));
      const { error } = await (supabase as any).from("platform_rules").insert(rows);
      if (!error) qc.invalidateQueries({ queryKey: ["platform_rules"] });
    })();
  }, [user, query.data, query.isLoading, qc]);

  return query;
}

export function useUpsertPlatformRule() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<PlatformRule> & NewPlatformRule) => {
      if (!user) throw new Error("Not authenticated");
      if (rule.id) {
        const { error } = await (supabase as any).from("platform_rules").update(rule).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("platform_rules").insert({ is_fallback: false, ...rule, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_rules"] }),
  });
}

export function useDeletePlatformRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("platform_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_rules"] }),
  });
}
