import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, Link2, Plus, RefreshCw, RotateCcw, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

type Brand = { id: string; name: string };
type Expert = { id: string; nome: string; nicho: "estetica" | "moda"; ativo: boolean };
type QuestionType = "texto" | "multipla_escolha" | "selecao_unica" | "numero" | "data";
type Question = { id: string; titulo: string; tipo: QuestionType; opcoes?: string[]; obrigatoria: boolean };
type Template = { id: string; titulo: string; perguntas: Question[] };
type LinkRow = { id: string; token: string | null; status: "pendente" | "respondido" | "vencido" | "revogado"; expira_em: string; expert_id: string; experts: { nome: string } | null };

const DEFAULT_QUESTIONS: Question[] = [
  { id: "procedimento", titulo: "Qual procedimento ou oferta é prioridade?", tipo: "texto", obrigatoria: true },
  { id: "publico", titulo: "Quem é o público que queremos atrair?", tipo: "texto", obrigatoria: true },
  { id: "objetivo", titulo: "Qual é o objetivo comercial deste período?", tipo: "texto", obrigatoria: true },
  { id: "disponibilidade", titulo: "Como está a disponibilidade para atendimento?", tipo: "selecao_unica", opcoes: ["Imediata", "Nesta semana", "Limitada"], obrigatoria: true },
  { id: "observacoes", titulo: "Existe alguma observação importante?", tipo: "texto", obrigatoria: false },
];
const typeLabels: Record<QuestionType, string> = { texto: "Texto", multipla_escolha: "Múltipla escolha", selecao_unica: "Seleção única", numero: "Número", data: "Data" };
const statusLabels: Record<LinkRow["status"], string> = { pendente: "Pendente", respondido: "Respondido", vencido: "Vencido", revogado: "Revogado" };

function makeQuestion(): Question { return { id: `pergunta_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`, titulo: "", tipo: "texto", obrigatoria: true }; }
function normalizeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return DEFAULT_QUESTIONS;
  const questions = value.flatMap((item): Question[] => {
    if (!item || typeof item !== "object") return [];
    const q = item as Partial<Question>;
    if (!q.id || !q.titulo || !q.tipo || !(q.tipo in typeLabels)) return [];
    return [{ id: q.id, titulo: q.titulo, tipo: q.tipo, opcoes: Array.isArray(q.opcoes) ? q.opcoes.filter((option): option is string => typeof option === "string") : undefined, obrigatoria: q.obrigatoria !== false }];
  });
  return questions.length ? questions : DEFAULT_QUESTIONS;
}

export function ExpertQuestionnairePanel({ brand }: { brand: Brand }) {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [expertId, setExpertId] = useState("");
  const [title, setTitle] = useState(`Briefing de tráfego — ${brand.name}`);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const enabled = !!workspace?.id && !workspace.id.startsWith("legacy-") && !brand.id.startsWith("account-");
  const experts = useQuery({ queryKey: ["questionnaire-experts", workspace?.id], enabled, queryFn: async (): Promise<Expert[]> => { const { data, error } = await (supabase as any).from("experts").select("id,nome,nicho,ativo").eq("workspace_id", workspace!.id).eq("ativo", true).order("nome"); if (error) throw error; return data || []; } });
  const template = useQuery({ queryKey: ["expert-questionnaire-template", workspace?.id, brand.id], enabled, queryFn: async (): Promise<Template | null> => { const { data, error } = await (supabase as any).from("questionario_modelos").select("id,titulo,perguntas").eq("workspace_id", workspace!.id).eq("marca_id", brand.id).maybeSingle(); if (error) throw error; return data; } });
  const links = useQuery({ queryKey: ["expert-questionnaire-links", workspace?.id, brand.id], enabled, queryFn: async (): Promise<LinkRow[]> => { const { data, error } = await (supabase as any).from("expert_links").select("id,token,status,expira_em,expert_id,experts(nome),questionarios!inner(marca_id)").eq("workspace_id", workspace!.id).eq("questionarios.marca_id", brand.id).order("criado_em", { ascending: false }); if (error) throw error; return data || []; } });
  const aestheticExperts = useMemo(() => (experts.data || []).filter((expert) => expert.nicho === "estetica"), [experts.data]);
  useEffect(() => { if (template.data) { setTitle(template.data.titulo); setQuestions(normalizeQuestions(template.data.perguntas)); } }, [template.data]);

  function validateTemplate() {
    if (!title.trim() || title.trim().length > 200) throw new Error("Informe um título de até 200 caracteres.");
    if (!questions.length) throw new Error("Adicione ao menos uma pergunta.");
    const ids = new Set<string>();
    questions.forEach((question) => {
      if (!question.titulo.trim() || question.titulo.trim().length > 500 || ids.has(question.id)) throw new Error("Revise os títulos das perguntas.");
      ids.add(question.id);
      if (["multipla_escolha", "selecao_unica"].includes(question.tipo) && !(question.opcoes || []).length) throw new Error(`Inclua opções para “${question.titulo}”.`);
    });
  }
  async function persistTemplate() {
    validateTemplate();
    const { data, error } = await (supabase as any).from("questionario_modelos").upsert({ ...(template.data?.id ? { id: template.data.id } : {}), workspace_id: workspace!.id, marca_id: brand.id, titulo: title.trim(), perguntas: questions, atualizado_por: user!.id, atualizado_em: new Date().toISOString() }, { onConflict: "workspace_id,marca_id" }).select("id,titulo,perguntas").single();
    if (error) throw error;
    return data as Template;
  }
  const seed = useMutation({ mutationFn: async () => { const { error } = await (supabase as any).rpc("seed_growdash_questionnaire_experts", { p_workspace_id: workspace!.id }); if (error) throw error; }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["questionnaire-experts"] }); toast.success("Experts padrão configurados. Giana ficou fora deste fluxo."); }, onError: (error: Error) => toast.error(error.message) });
  const saveTemplate = useMutation({ mutationFn: persistTemplate, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["expert-questionnaire-template"] }); toast.success("Perguntas salvas para esta marca."); }, onError: (error: Error) => toast.error(error.message) });
  const create = useMutation({ mutationFn: async (targetExpertId: string) => { if (!targetExpertId || !workspace?.id || !user) throw new Error("Selecione um expert para gerar o link."); const saved = await persistTemplate(); const { data: questionnaire, error: questionnaireError } = await (supabase as any).from("questionarios").insert({ workspace_id: workspace.id, marca_id: brand.id, titulo: saved.titulo, perguntas: saved.perguntas, criado_por: user.id }).select("id").single(); if (questionnaireError) throw questionnaireError; const { data: link, error: linkError } = await (supabase as any).from("expert_links").insert({ workspace_id: workspace.id, questionario_id: questionnaire.id, expert_id: targetExpertId, criado_por: user.id }).select("token").single(); if (linkError) throw linkError; return link.token as string; }, onSuccess: async (token) => { await queryClient.invalidateQueries({ queryKey: ["expert-questionnaire-links"] }); await queryClient.invalidateQueries({ queryKey: ["expert-questionnaire-template"] }); await copyLink(token); toast.success("Link copiado. Ele expira em 24 horas."); }, onError: (error: Error) => toast.error(error.message || "Não foi possível gerar o link.") });
  async function copyLink(token: string) { const url = `${window.location.origin}/questionario-expert/${token}`; try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link do questionário", url); } }
  const update = (id: string, patch: Partial<Question>) => setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));

  if (!enabled) return <section className="gd-panel p-5"><h2 className="font-black">Questionário por expert</h2><p className="mt-2 text-sm text-muted-foreground">Sincronize esta marca para habilitar questionários separados por expert.</p></section>;
  return <section className="gd-panel overflow-hidden"><header className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center"><div className="min-w-0 grow"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-primary"><UserRound className="h-3.5 w-3.5" />Growdash Intelligence System</span><h2 className="mt-2 text-lg font-black">Questionário de tráfego por expert</h2><p className="mt-1 text-xs text-muted-foreground">O modelo é editável por marca; cada link recebe uma cópia imutável. Giana não participa deste fluxo.</p></div>{!aestheticExperts.length && <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>{seed.isPending ? "Configurando…" : "Configurar experts"}</Button>}</header><div className="space-y-4 p-5"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><div className="space-y-2"><Label htmlFor="questionnaire-title">Título do questionário</Label><Input id="questionnaire-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></div><div className="flex items-end"><Button variant="outline" onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>{saveTemplate.isPending ? "Salvando…" : "Salvar perguntas"}</Button></div></div><div className="space-y-3">{questions.map((question, index) => <article key={question.id} className="rounded-xl border border-border bg-background/35 p-4"><div className="flex items-start gap-3"><span className="mt-2 text-xs font-black text-muted-foreground">{index + 1}</span><div className="min-w-0 grow space-y-3"><Input value={question.titulo} maxLength={500} onChange={(event) => update(question.id, { titulo: event.target.value })} aria-label={`Pergunta ${index + 1}`} /><div className="flex flex-wrap items-center gap-3"><Select value={question.tipo} onValueChange={(value) => update(question.id, { tipo: value as QuestionType, opcoes: ["multipla_escolha", "selecao_unica"].includes(value) ? question.opcoes || ["Opção 1"] : undefined })}><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><div className="flex items-center gap-2"><Switch checked={question.obrigatoria} onCheckedChange={(checked) => update(question.id, { obrigatoria: checked })} id={`required-${question.id}`} /><Label htmlFor={`required-${question.id}`} className="text-xs">Obrigatória</Label></div></div>{["multipla_escolha", "selecao_unica"].includes(question.tipo) && <Input value={(question.opcoes || []).join(", ")} onChange={(event) => update(question.id, { opcoes: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} placeholder="Opções separadas por vírgula" aria-label={`Opções da pergunta ${index + 1}`} />}</div><Button size="icon" variant="ghost" className="text-destructive" disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))} aria-label="Remover pergunta"><Trash2 className="h-4 w-4" /></Button></div></article>)}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, makeQuestion()])}><Plus className="mr-2 h-4 w-4" />Adicionar pergunta</Button><Button type="button" variant="ghost" onClick={() => { setQuestions(DEFAULT_QUESTIONS); setTitle(`Briefing de tráfego — ${brand.name}`); }}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button></div><div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[.04] p-4 sm:flex-row sm:items-end"><div className="min-w-0 grow space-y-2"><Label>Expert de estética</Label><Select value={expertId} onValueChange={setExpertId}><SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Selecione o expert" /></SelectTrigger><SelectContent>{aestheticExperts.map((expert) => <SelectItem key={expert.id} value={expert.id}>{expert.nome}</SelectItem>)}</SelectContent></Select></div><Button onClick={() => create.mutate(expertId)} disabled={!expertId || create.isPending || !aestheticExperts.length}><Link2 className="mr-2 h-4 w-4" />{create.isPending ? "Gerando…" : "Gerar e copiar link"}</Button></div></div><div className="border-t border-border"><h3 className="px-5 pt-5 text-sm font-black">Links enviados</h3><div className="mt-3 divide-y divide-border">{links.isLoading ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Carregando links…</div> : links.data?.length ? links.data.map((link) => <div key={link.id} className="flex flex-wrap items-center gap-3 p-4 text-sm"><div className="min-w-0 grow"><b>{link.experts?.nome || "Expert"}</b><p className="mt-1 text-xs text-muted-foreground">{statusLabels[link.status]} · {link.status === "pendente" ? `expira em ${new Date(link.expira_em).toLocaleString("pt-BR")}` : "token removido"}</p></div>{link.token ? <Button size="sm" variant="outline" onClick={() => copyLink(link.token!)}><ClipboardCopy className="mr-2 h-3.5 w-3.5" />Copiar link</Button> : <Button size="sm" variant="outline" onClick={() => create.mutate(link.expert_id)} disabled={create.isPending}><Link2 className="mr-2 h-3.5 w-3.5" />Reenviar</Button>}</div>) : <p className="p-5 text-sm text-muted-foreground">Nenhum questionário gerado para esta marca.</p>}</div></div></section>;
}
