/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCopy, ExternalLink, FileQuestion, Link2, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export type StrategyDiagnostic = {
  vision: string;
  mission: string;
  idealCustomer: string;
  positioning: string;
  differentiators: string;
  offer: string;
  products: string;
  salesFunnel: string;
  objectives: string;
  contentPillars: string;
  objections: string;
  competitors: string;
  notes: string;
};

type Brand = { id: string; name: string; metadata: Record<string, any> };
type DiagnosticForm = { id: string; share_token: string; status: "pending" | "submitted" | "revoked"; answers: Partial<StrategyDiagnostic>; submitted_at: string | null; created_at: string };

const EMPTY_DIAGNOSTIC: StrategyDiagnostic = {
  vision: "", mission: "", idealCustomer: "", positioning: "", differentiators: "", offer: "", products: "", salesFunnel: "", objectives: "", contentPillars: "", objections: "", competitors: "", notes: "",
};

const FIELDS: Array<{ key: keyof StrategyDiagnostic; label: string; hint: string; group: string }> = [
  { key: "vision", label: "Visão de futuro", hint: "Onde a marca quer chegar nos próximos anos?", group: "Essência" },
  { key: "mission", label: "Propósito / missão", hint: "Que transformação a marca entrega?", group: "Essência" },
  { key: "idealCustomer", label: "Cliente ideal", hint: "Perfil, dores, desejos e momento de compra.", group: "Público e posicionamento" },
  { key: "positioning", label: "Posicionamento", hint: "Como a marca quer ser lembrada e comparada?", group: "Público e posicionamento" },
  { key: "differentiators", label: "Diferenciais", hint: "Por que escolher esta marca e não outra?", group: "Público e posicionamento" },
  { key: "offer", label: "Oferta principal", hint: "Promessa, mecanismo, condição e chamada para ação.", group: "Oferta e produtos" },
  { key: "products", label: "Produtos e serviços", hint: "Liste ofertas, faixas de preço, margens e prioridades.", group: "Oferta e produtos" },
  { key: "salesFunnel", label: "Funil de vendas", hint: "Aquisição → qualificação → proposta → venda → pós-venda.", group: "Funil e crescimento" },
  { key: "objectives", label: "Objetivos de negócio", hint: "Metas de receita, volume, expansão ou retenção.", group: "Funil e crescimento" },
  { key: "contentPillars", label: "Pilares de conteúdo", hint: "Temas, formatos e mensagens que sustentam a estratégia.", group: "Conteúdo e mercado" },
  { key: "objections", label: "Objeções de compra", hint: "Dúvidas e barreiras que a comunicação precisa resolver.", group: "Conteúdo e mercado" },
  { key: "competitors", label: "Concorrentes e referências", hint: "Quem disputa atenção com a marca?", group: "Conteúdo e mercado" },
  { key: "notes", label: "Direção estratégica", hint: "Decisões, hipóteses, aprendizados e próximos testes.", group: "Direção" },
];

function parseDiagnostic(value: unknown): StrategyDiagnostic {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_DIAGNOSTIC;
  return Object.fromEntries(Object.keys(EMPTY_DIAGNOSTIC).map((key) => [key, typeof (value as any)[key] === "string" ? (value as any)[key] : ""])) as StrategyDiagnostic;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="gd-panel overflow-hidden"><div className="border-b border-border px-5 py-4"><h3 className="text-sm font-black">{title}</h3></div><div className="grid gap-4 p-5 md:grid-cols-2">{children}</div></section>;
}

export function BrandStrategyDiagnostic({ brand }: { brand: Brand }) {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<StrategyDiagnostic>(() => parseDiagnostic(brand.metadata?.strategy_diagnostic));
  const [editing, setEditing] = useState(!Object.values(parseDiagnostic(brand.metadata?.strategy_diagnostic)).some(Boolean));
  const localBrand = !brand.id.startsWith("account-");
  const formsQuery = useQuery({
    queryKey: ["brand-diagnostic-forms", workspace?.id, brand.id],
    enabled: !!workspace?.id && localBrand,
    queryFn: async (): Promise<DiagnosticForm[]> => {
      const { data, error } = await (supabase as any).from("brand_diagnostic_forms").select("id, share_token, status, answers, submitted_at, created_at").eq("workspace_id", workspace!.id).eq("company_id", brand.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DiagnosticForm[];
    },
  });

  useEffect(() => { setDraft(parseDiagnostic(brand.metadata?.strategy_diagnostic)); }, [brand.id, brand.metadata]);

  const submitted = useMemo(() => (formsQuery.data ?? []).find((form) => form.status === "submitted") ?? null, [formsQuery.data]);
  const pending = useMemo(() => (formsQuery.data ?? []).find((form) => form.status === "pending") ?? null, [formsQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!workspace?.id || !localBrand) throw new Error("Sincronize esta marca antes de salvar a estratégia.");
      const { error } = await (supabase as any).from("companies").update({ metadata: { ...brand.metadata, strategy_diagnostic: draft }, updated_at: new Date().toISOString() }).eq("id", brand.id).eq("workspace_id", workspace.id);
      if (error) throw error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["company-diagnostic"] }); setEditing(false); toast.success("Estratégia da marca salva."); },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a estratégia."),
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!workspace?.id || !user || !localBrand) throw new Error("Sincronize esta marca antes de criar o link para o cliente.");
      if (pending) return pending;
      const { data, error } = await (supabase as any).from("brand_diagnostic_forms").insert({ workspace_id: workspace.id, company_id: brand.id, created_by: user.id }).select("id, share_token, status, answers, submitted_at, created_at").single();
      if (error) throw error;
      return data as DiagnosticForm;
    },
    onSuccess: async (form) => { await queryClient.invalidateQueries({ queryKey: ["brand-diagnostic-forms"] }); await copyLink(form.share_token); toast.success("Link do diagnóstico copiado."); },
    onError: (error: Error) => toast.error(error.message || "Não foi possível criar o link."),
  });

  const applyClientAnswers = () => {
    if (!submitted) return;
    setDraft((current) => ({ ...current, ...parseDiagnostic(submitted.answers) }));
    setEditing(true);
    toast.info("As respostas do cliente foram trazidas para edição. Salve para aplicá-las ao diagnóstico oficial.");
  };

  async function copyLink(token: string) {
    const url = `${window.location.origin}/diagnostico-marca/${token}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link do diagnóstico", url); }
  }

  const grouped = FIELDS.reduce<Record<string, typeof FIELDS>>((acc, field) => { (acc[field.group] ??= []).push(field); return acc; }, {});
  return <div className="space-y-5">
    <section className="gd-panel overflow-hidden p-5"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Plano de marca</div><h2 className="mt-2 text-xl font-black">Estratégia, oferta e direção de {brand.name}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Centralize o pensamento estratégico e colete o briefing do cliente em um formulário guiado, sem liberar acesso à Growdash.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing((value) => !value)}>{editing ? "Cancelar edição" : "Editar estratégia"}</Button><Button onClick={() => generate.mutate()} disabled={generate.isPending || !localBrand}><Link2 className="mr-2 h-4 w-4" />{generate.isPending ? "Criando…" : pending ? "Copiar link do cliente" : "Gerar link para cliente"}</Button></div></div>
      {!localBrand && <p className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">Esta marca ainda é uma conta temporária. Use “Sincronizar marcas” na lista de marcas para habilitar o diagnóstico estratégico e o link público.</p>}
      {pending && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 p-3 text-xs"><FileQuestion className="h-4 w-4 text-primary" /><span className="grow">Aguardando o preenchimento do cliente.</span><Button size="sm" variant="outline" onClick={() => copyLink(pending.share_token)}><ClipboardCopy className="mr-2 h-3.5 w-3.5" />Copiar link</Button><a href={`/diagnostico-marca/${pending.share_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary">Abrir <ExternalLink className="h-3.5 w-3.5" /></a></div>}
    </section>

    {submitted && <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5"><div className="flex flex-wrap items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><div className="grow"><h3 className="text-sm font-black">Respostas do cliente recebidas</h3><p className="mt-1 text-xs text-muted-foreground">Enviadas em {new Date(submitted.submitted_at || submitted.created_at).toLocaleString("pt-BR")}. Revise antes de aplicar ao diagnóstico oficial.</p></div><Button size="sm" variant="outline" onClick={applyClientAnswers}>Aplicar ao diagnóstico</Button></div></section>}

    {Object.entries(grouped).map(([group, fields]) => <Group title={group} key={group}>{fields.map((field) => <label key={field.key} className="grid min-w-0 gap-2"><span className="text-xs font-black">{field.label}</span><Textarea value={draft[field.key]} disabled={!editing} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.hint} className="min-h-28 resize-y bg-background/45 text-sm disabled:cursor-default disabled:opacity-100" /><span className="text-[10px] text-muted-foreground">{field.hint}</span></label>)}</Group>)}

    {editing && <div className="sticky bottom-4 z-10 flex justify-end"><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending || !localBrand} className="shadow-xl"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar diagnóstico estratégico"}</Button></div>}
  </div>;
}
