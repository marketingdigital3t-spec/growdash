/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Compass, Lightbulb, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeading } from "./shared";

type ContentPillar = { id: string; title: string; purpose: string; formats: string };
type StrategyIdea = { id: string; title: string; note: string; status: "idea" | "testing" | "ready" };
type StrategyPlan = {
  id: string;
  workspace_id: string;
  ad_account_id: string | null;
  brand_name: string;
  positioning: string;
  direction: string;
  audience: string;
  content_pillars: ContentPillar[];
  ideas: StrategyIdea[];
  updated_at: string;
};

const EMPTY_PLAN = {
  positioning: "",
  direction: "",
  audience: "",
  content_pillars: [] as ContentPillar[],
  ideas: [] as StrategyIdea[],
};

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isSchemaPending = (error: any) => error?.code === "42P01" || error?.code === "PGRST202" || /strategy_plans|schema cache|does not exist/i.test(error?.message ?? "");

export default function StrategyPage() {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const { data: accounts = [] } = useAdAccounts();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("workspace");
  const [draft, setDraft] = useState(EMPTY_PLAN);
  const workspaceReady = !!workspace?.id && !workspace.id.startsWith("legacy-");
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accountId, accounts]);
  const brandName = selectedAccount?.name || workspace?.name || "Estratégia do workspace";
  const localKey = `growdash:strategy:${workspace?.id ?? "local"}:${accountId}`;

  const planQuery = useQuery({
    queryKey: ["strategy-plan", workspace?.id, accountId],
    enabled: !!workspace?.id,
    queryFn: async (): Promise<StrategyPlan | null> => {
      if (!workspaceReady) return null;
      let query = (supabase as any).from("strategy_plans").select("*").eq("workspace_id", workspace!.id);
      query = accountId === "workspace" ? query.is("ad_account_id", null) : query.eq("ad_account_id", accountId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        if (isSchemaPending(error)) return null;
        throw error;
      }
      return data as StrategyPlan | null;
    },
  });

  useEffect(() => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem(localKey) || "null"); } catch { return null; } })();
    const plan = planQuery.data;
    setDraft({
      positioning: plan?.positioning ?? stored?.positioning ?? "",
      direction: plan?.direction ?? stored?.direction ?? "",
      audience: plan?.audience ?? stored?.audience ?? "",
      content_pillars: Array.isArray(plan?.content_pillars) ? plan.content_pillars : Array.isArray(stored?.content_pillars) ? stored.content_pillars : [],
      ideas: Array.isArray(plan?.ideas) ? plan.ideas : Array.isArray(stored?.ideas) ? stored.ideas : [],
    });
  }, [localKey, planQuery.data]);

  useEffect(() => {
    try { localStorage.setItem(localKey, JSON.stringify(draft)); } catch { /* edição continua sem storage local */ }
  }, [draft, localKey]);

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!workspaceReady || !user) throw new Error("O workspace ainda não está disponível para salvar.");
      const payload = {
        workspace_id: workspace!.id,
        user_id: user.id,
        ad_account_id: accountId === "workspace" ? null : accountId,
        brand_name: brandName,
        ...draft,
      };
      const { error } = await (supabase as any).from("strategy_plans").upsert(payload, { onConflict: "workspace_id,ad_account_id" });
      if (error) {
        if (isSchemaPending(error)) throw new Error("A estrutura de Estratégia ainda está sendo aplicada no Supabase. Suas alterações foram mantidas neste navegador.");
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["strategy-plan"] });
      toast.success("Estratégia salva para esta marca.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a estratégia."),
  });

  const addPillar = () => setDraft((current) => ({ ...current, content_pillars: [...current.content_pillars, { id: newId(), title: "Novo pilar", purpose: "Qual mudança este conteúdo deve gerar?", formats: "Reels, carrossel, stories" }] }));
  const addIdea = () => setDraft((current) => ({ ...current, ideas: [{ id: newId(), title: "Nova ideia", note: "Contexto, gancho e próximo passo", status: "idea" }, ...current.ideas] }));

  return <div className="mx-auto max-w-[1700px]">
    <PageHeading eyebrow="Planejamento por marca" title="Estratégia" description="Transforme visão em direção: posicionamento, conteúdo e ideias acionáveis para cada marca." actions={<div className="flex flex-wrap gap-2"><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="gd-button h-10 max-w-[260px]"><option value="workspace">Estratégia geral do workspace</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending}><Check className="mr-2 h-4 w-4" />{savePlan.isPending ? "Salvando…" : "Salvar estratégia"}</Button></div>} />

    <section className="gd-panel mb-4 overflow-hidden p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary"><Compass className="h-3.5 w-3.5" /> Central de decisão</span><h2 className="mt-4 text-2xl font-black tracking-tight">{brandName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Defina a mensagem antes de produzir. Cada escolha abaixo vira referência para campanhas, social e time comercial.</p></div>
        <div className="grid grid-cols-3 gap-2"><StrategyStat label="Pilares" value={draft.content_pillars.length} /><StrategyStat label="Ideias" value={draft.ideas.length} /><StrategyStat label="Direção" value={draft.direction.trim() ? "OK" : "—"} /></div>
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
      <section className="space-y-4">
        <StrategyField icon={<Target />} label="Posicionamento" hint="Como a marca deve ser lembrada?" value={draft.positioning} onChange={(positioning) => setDraft((current) => ({ ...current, positioning }))} placeholder="Ex.: A escolha mais segura e desejada para…" />
        <StrategyField icon={<ArrowRight />} label="Direção estratégica" hint="Objetivo, prioridade e decisão para os próximos 90 dias." value={draft.direction} onChange={(direction) => setDraft((current) => ({ ...current, direction }))} placeholder="Ex.: Aumentar percepção de valor antes de escalar aquisição…" />
        <StrategyField icon={<Sparkles />} label="Público e tensão central" hint="Para quem falamos e qual problema real essa marca resolve?" value={draft.audience} onChange={(audience) => setDraft((current) => ({ ...current, audience }))} placeholder="Ex.: Especialistas que…" />
      </section>

      <section className="gd-panel p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /><h2 className="font-black">Banco de ideias</h2></div><p className="mt-1 text-xs text-muted-foreground">Capture antes de esquecer e escolha o que vai para produção.</p></div><Button size="sm" variant="outline" onClick={addIdea}><Plus className="mr-1 h-4 w-4" /> Ideia</Button></div><div className="mt-4 space-y-2">{draft.ideas.map((idea) => <IdeaRow key={idea.id} idea={idea} onChange={(next) => setDraft((current) => ({ ...current, ideas: current.ideas.map((item) => item.id === next.id ? next : item) }))} onRemove={() => setDraft((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== idea.id) }))} />)}{!draft.ideas.length && <EmptyCopy text="Comece com uma hipótese, uma campanha ou um conteúdo que vale testar." action="Adicionar primeira ideia" onAction={addIdea} />}</div></section>
    </div>

    <section className="gd-panel mt-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">Pilares de conteúdo</h2><p className="mt-1 text-xs text-muted-foreground">O sistema editorial que mantém a marca coerente em todos os canais.</p></div><Button size="sm" variant="outline" onClick={addPillar}><Plus className="mr-1 h-4 w-4" /> Novo pilar</Button></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{draft.content_pillars.map((pillar) => <PillarCard key={pillar.id} pillar={pillar} onChange={(next) => setDraft((current) => ({ ...current, content_pillars: current.content_pillars.map((item) => item.id === next.id ? next : item) }))} onRemove={() => setDraft((current) => ({ ...current, content_pillars: current.content_pillars.filter((item) => item.id !== pillar.id) }))} />)}{!draft.content_pillars.length && <EmptyCopy text="Ex.: autoridade, prova, bastidores, desejo e conversão." action="Criar pilar" onAction={addPillar} />}</div></section>
  </div>;
}

function StrategyField({ icon, label, hint, value, onChange, placeholder }: { icon: ReactNode; label: string; hint: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <section className="gd-panel p-5"><div className="flex items-center gap-2 text-primary">{icon}<h2 className="text-sm font-black text-foreground">{label}</h2></div><p className="mt-1 text-xs text-muted-foreground">{hint}</p><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-4 min-h-28 resize-y bg-background/50 leading-6" /></section>; }
function StrategyStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-background/45 p-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function EmptyCopy({ text, action, onAction }: { text: string; action: string; onAction: () => void }) { return <div className="rounded-xl border border-dashed border-border bg-background/30 p-5 text-center text-xs text-muted-foreground"><p>{text}</p><button type="button" onClick={onAction} className="mt-3 font-black text-primary">{action}</button></div>; }
function IdeaRow({ idea, onChange, onRemove }: { idea: StrategyIdea; onChange: (idea: StrategyIdea) => void; onRemove: () => void }) { return <article className="rounded-xl border border-border bg-background/35 p-3"><div className="flex gap-2"><Input value={idea.title} onChange={(event) => onChange({ ...idea, title: event.target.value })} className="h-9 border-0 bg-transparent px-0 font-bold focus-visible:ring-0" /><select value={idea.status} onChange={(event) => onChange({ ...idea, status: event.target.value as StrategyIdea["status"] })} className="rounded-lg border border-border bg-background px-2 text-[10px] font-bold"><option value="idea">Ideia</option><option value="testing">Em teste</option><option value="ready">Pronta</option></select><button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remover ideia"><Trash2 className="h-4 w-4" /></button></div><Input value={idea.note} onChange={(event) => onChange({ ...idea, note: event.target.value })} className="mt-1 h-8 border-0 bg-transparent px-0 text-xs text-muted-foreground focus-visible:ring-0" /></article>; }
function PillarCard({ pillar, onChange, onRemove }: { pillar: ContentPillar; onChange: (pillar: ContentPillar) => void; onRemove: () => void }) { return <article className="rounded-2xl border border-border bg-background/35 p-4"><div className="flex items-center gap-2"><Input value={pillar.title} onChange={(event) => onChange({ ...pillar, title: event.target.value })} className="h-8 border-0 bg-transparent px-0 text-sm font-black focus-visible:ring-0" /><button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remover pilar"><Trash2 className="h-4 w-4" /></button></div><Textarea value={pillar.purpose} onChange={(event) => onChange({ ...pillar, purpose: event.target.value })} className="mt-3 min-h-20 resize-y text-xs" /><Input value={pillar.formats} onChange={(event) => onChange({ ...pillar, formats: event.target.value })} className="mt-3 h-9 text-xs" placeholder="Formatos" /></article>; }
