import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PermLevel } from "@/lib/permissions";

export function usePermissions() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [perms, setPerms] = useState<Record<string, PermLevel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerms({});
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("module, level")
        .eq("user_id", user.id);
      const map: Record<string, PermLevel> = {};
      data?.forEach((r) => (map[r.module] = r.level as PermLevel));
      setPerms(map);
      setLoading(false);
    })();
  }, [user]);

  const can = (module: string, need: PermLevel = "view") => {
    if (isAdmin) return true;
    const lvl = perms[module];
    if (!lvl) return false;
    if (need === "view") return true;
    return lvl === "edit";
  };

  return { perms, isAdmin, can, loading };
}
