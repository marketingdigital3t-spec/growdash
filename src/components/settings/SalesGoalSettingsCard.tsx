/* Generated Supabase types are refreshed only after the additive migration is applied. */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarRange, Save, Target } from "lucide-react";
import { useSalesGoals } from "@/hooks/useSalesGoals";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseCurrency(value: string) {
  const clean = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!clean) return 0;
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  if (/\.\d{1,2}$/.test(clean)) return Number(clean);
  return Number(clean.replace(/\./g, ""));
}

export function SalesGoalSettingsCard() {
  const [monthValue, setMonthValue] = useState(format(new Date(), "yyyy-MM"));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const monthDate = parseISO(`${monthValue}-01`);
  const { data: goalData, isLoading } = useSalesGoals(monthDate);
  const { data: accounts = [] } = useAdAccounts();
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const { businessUnitId, segment } = useGlobalFilters();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const visibleAccounts = useMemo(() => businessUnitId
    ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : accounts, [accounts, businessUnitId, segment]);

  useEffect(() => {
    const byAccount = new Map((goalData?.rows ?? []).map((goal) => [goal.ad_account_id, Number(goal.target_revenue)]));
    setDrafts(Object.fromEntries(visibleAccounts.map((account) => [account.id, byAccount.get(account.id) ? String(byAccount.get(account.id)) : ""])));
  }, [goalData?.rows, visibleAccounts]);

  const saveGoals = useMutation({
    mutationFn: async () => {
      if (!goalData?.schemaReady || !workspace?.id || !businessUnitId || !user?.id || workspace.id.startsWith("legacy-") || businessUnitId.startsWith("legacy-")) throw new Error("Aplique a migration de metas antes de salvar.");
      const positive = visibleAccounts.flatMap((account) => {
        const target = parseCurrency(drafts[account.id] || "");
        if (!Number.isFinite(target) || target <= 0) return [];
        return [{ workspace_id: workspace.id, business_unit_id: businessUnitId, ad_account_id: account.id, goal_month: `${monthValue}-01`, target_revenue: target, created_by: user.id, updated_at: new Date().toISOString() }];
      });
      if (positive.length) {
        const { error } = await (supabase as any).from("sales_goals").upsert(positive, { onConflict: "workspace_id,business_unit_id,ad_account_id,goal_month" });
        if (error) throw error;
      }
      const zeroIds = visibleAccounts.filter((account) => !positive.some((row) => row.ad_account_id === account.id)).map((account) => account.id);
      if (zeroIds.length) {
        const { error } = await (supabase as any).from("sales_goals").delete().eq("workspace_id", workspace.id).eq("business_unit_id", businessUnitId).eq("goal_month", `${monthValue}-01`).in("ad_account_id", zeroIds);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sales-goals"] }); toast({ title: "Metas mensais atualizadas", description: "O Dashboard já pode recalcular o progresso por marca." }); },
    onError: (error: Error) => toast({ title: "Não foi possível salvar as metas", description: error.message, variant: "destructive" }),
  });

  const total = visibleAccounts.reduce((sum, account) => {
    const value = parseCurrency(drafts[account.id] || "");
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return <section id="sales-goals" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Target className="h-5 w-5" /></span><div className="min-w-0"><h2 className="font-black">Metas mensais por marca</h2><p className="text-xs text-muted-foreground">A barra do Dashboard usa vendas atribuídas a cada conta, sem misturar {segment === "saas" ? "SaaS" : "Infoproduto"}.</p></div></div><label className="relative lg:ml-auto"><CalendarRange className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-primary" /><Input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} className="min-h-11 w-full pl-9 sm:w-48" /></label><Button className="min-h-11" disabled={saveGoals.isPending || isLoading || !visibleAccounts.length || !goalData?.schemaReady} onClick={() => saveGoals.mutate()}><Save className="mr-2 h-4 w-4" />{saveGoals.isPending ? "Salvando…" : "Salvar metas"}</Button></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleAccounts.map((account) => <label key={account.id} className="min-w-0 rounded-xl border border-border bg-background/60 p-4"><span className="block truncate text-xs font-black" title={account.name}>{account.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">Meta de faturamento líquido</span><div className="mt-3 flex min-w-0 items-center gap-2"><span className="shrink-0 text-sm font-black text-primary">R$</span><Input inputMode="decimal" value={drafts[account.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: event.target.value }))} placeholder="0,00" className="min-w-0" /></div></label>)}</div>
    {!visibleAccounts.length && <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Conecte e vincule contas de anúncio a esta unidade para definir metas por marca.</div>}
    <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Total planejado para {monthValue.split("-").reverse().join("/")}</span><b className="text-base text-primary">{brl.format(total)}</b></div>
    {goalData && !goalData.schemaReady && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">Aplique a migration <code>20260715020000_sales_goals_dashboard.sql</code> para habilitar a persistência.</p>}
  </section>;
}
