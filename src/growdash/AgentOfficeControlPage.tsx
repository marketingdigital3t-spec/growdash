import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/growdash/shared";

type AgentRow = { id: string; role: string; name: string; status: string; permissions: Record<string, unknown> };
type RunRow = { id: string; status: string; trigger: string; started_at: string; finished_at: string | null; summary: string | null };
type FindingRow = { id: string; severity: string; category: string; description: string; status: string; created_at: string };

const roleLabels: Record<string, string> = { ceo: "CEO Orquestrador", backend_security: "Dev Backend Segurança", backend_meta_rd: "Dev Backend Meta/RD", frontend: "Dev Frontend", designer: "Designer" };

export default function AgentOfficeControlPage() {
  const { data: workspace, isLoading: loadingWorkspace, error: workspaceError } = useWorkspace();
  const { toast } = useToast();
  const owner = workspace?.role === "owner";
  const query = useQuery({
    queryKey: ["agent-office-control", workspace?.id],
    enabled: Boolean(workspace?.id && owner),
    refetchInterval: 30_000,
    queryFn: async () => {
      // The governance tables are additive and are regenerated into Database
      // types during the linked Supabase migration step.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const agents = await db.from("agent_office_agents").select("id,role,name,status,permissions").eq("workspace_id", workspace!.id).order("role");
      const runs = await db.from("agent_office_runs").select("id,status,trigger,started_at,finished_at,summary").eq("workspace_id", workspace!.id).order("started_at", { ascending: false }).limit(10);
      const findings = await db.from("agent_office_findings").select("id,severity,category,description,status,created_at").eq("workspace_id", workspace!.id).order("created_at", { ascending: false }).limit(25);
      const proposals = await db.from("agent_office_proposals").select("id,change_area,status,diff_summary,created_at").eq("workspace_id", workspace!.id).in("status", ["awaiting_approval", "tests_passed", "patch_ready"]).order("created_at", { ascending: false }).limit(10);
      const failed = [agents, runs, findings, proposals].find((result) => result.error);
      if (failed) throw failed.error;
      return { agents: (agents.data || []) as AgentRow[], runs: (runs.data || []) as RunRow[], findings: (findings.data || []) as FindingRow[], proposals: proposals.data || [] };
    },
  });

  const runNow = async () => {
    const { data, error } = await supabase.functions.invoke("agent-office-orchestrator", { body: { trigger: "manual" } });
    if (error || data?.status === "failed") {
      toast({ title: "Falha ao executar ciclo", description: error?.message || "O Agent Office registrou uma falha interna.", variant: "destructive" });
      return;
    }
    toast({ title: "Ciclo executado", description: data?.status === "partial" ? "O ciclo terminou com achados ou falhas parciais." : "As verificações determinísticas foram concluídas." });
    await query.refetch();
  };

  if (loadingWorkspace) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Carregando governança…</div>;
  if (workspaceError || !workspace) return <State icon={<AlertTriangle />} title="Workspace indisponível" text="A governança não pode ser carregada enquanto a sessão ou o workspace não forem resolvidos." />;
  if (!owner) return <State icon={<LockKeyhole />} title="Acesso restrito ao proprietário" text="Achados, logs, propostas e decisões dos agentes não são visíveis para membros comuns." />;

  const latest = query.data?.runs[0];
  return <div className="mx-auto max-w-[1500px]">
    <PageHeading eyebrow="Governança segura" title="Agent Office" description="Auditoria contínua de backend, Meta, RD e segurança. Nenhum agente publica alterações automaticamente." actions={<button className="gd-button" onClick={runNow} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Executar ciclo agora</button>} />
    {query.error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-300/40 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4" /> Falha ao consultar o histórico. Nenhum dado demonstrativo foi exibido.<button className="ml-auto underline" onClick={() => query.refetch()}>Tentar novamente</button></div>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary icon={<Clock3 />} label="Último ciclo" value={latest ? new Date(latest.started_at).toLocaleString("pt-BR") : "Ainda não executado"} /><Summary icon={<ShieldCheck />} label="Estado" value={latest?.status || "aguardando ciclo"} /><Summary icon={<AlertTriangle />} label="Achados abertos" value={String(query.data?.findings.filter((item) => item.status !== "deployed").length || 0)} /></div>
    <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{(query.data?.agents || []).map((agent) => <article key={agent.id} className="gd-panel p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span><div><b className="text-sm">{roleLabels[agent.role] || agent.name}</b><span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{agent.status} · sem deploy</span></div></div></article>)}</section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="gd-panel overflow-hidden"><header className="border-b border-border/60 p-4"><h2 className="font-black">Achados recentes</h2><p className="text-xs text-muted-foreground">Falhas são classificadas e persistidas por workspace; tokens não são exibidos.</p></header>{query.data?.findings.length ? <div className="divide-y divide-border/50">{query.data.findings.map((finding) => <div key={finding.id} className="flex gap-3 p-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${finding.severity === "critical" || finding.severity === "high" ? "bg-red-500" : finding.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"}`} /><div><b className="text-sm">{finding.category} · {finding.severity}</b><p className="mt-1 text-xs text-muted-foreground">{finding.description}</p></div></div>)}</div> : <Empty text="Nenhum achado registrado pelo último ciclo." />}</section><section className="gd-panel overflow-hidden"><header className="border-b border-border/60 p-4"><h2 className="font-black">Ciclos e propostas</h2></header><div className="divide-y divide-border/50">{(query.data?.runs || []).slice(0, 5).map((run) => <div key={run.id} className="flex items-start gap-3 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /><div><b className="text-sm">{run.status}</b><p className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString("pt-BR")} · {run.trigger}</p><p className="mt-1 text-xs">{run.summary || "Sem resumo"}</p></div></div>)}{!query.data?.runs.length && <Empty text="Nenhum ciclo executado ainda." />}</div><div className="border-t border-border/60 p-4 text-xs text-muted-foreground">{query.data?.proposals.length || 0} proposta(s) aguardando revisão. Aprovação e deploy exigem ação explícita do proprietário.</div></section></div>
  </div>;
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="gd-panel p-4"><div className="flex items-center gap-2 text-primary">{icon}<span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span></div><b className="mt-2 block text-sm">{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="p-5 text-sm text-muted-foreground">{text}</div>; }
function State({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span><h1 className="mt-4 text-xl font-black">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
