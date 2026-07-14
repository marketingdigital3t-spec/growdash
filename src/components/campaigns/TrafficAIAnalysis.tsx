import { useMemo, useRef, useState } from "react";
import { Bot, CalendarRange, Loader2, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { splitTrafficAIReport, type TrafficAISectionKey } from "@/lib/trafficAIReport";

const sectionTabs: { key: TrafficAISectionKey; label: string }[] = [
  { key: "summary", label: "Resumo" }, { key: "campaigns", label: "Campanhas" }, { key: "adsets", label: "Conjuntos" },
  { key: "ads", label: "Anúncios" }, { key: "actions", label: "Plano de ação" }, { key: "projections", label: "Projeções" },
];
const focusQuestions: Record<string, string> = {
  complete: "Gere a análise completa, priorizando decisões que tenham evidência suficiente.",
  cost: "Gere a análise completa, aprofundando CPL, CPM, gasto sem resultado e eficiência de orçamento.",
  creative: "Gere a análise completa, aprofundando criativos, anúncios vencedores, fadiga e oportunidades de teste A/B.",
  scale: "Gere a análise completa, aprofundando oportunidades seguras de escala, riscos e critérios de parada.",
};

export function TrafficAIAnalysis({ accountId, accountName, startDate, endDate, selectedCampaignIds }: { accountId: string; accountName?: string; startDate: Date; endDate: Date; selectedCampaignIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [focus, setFocus] = useState("complete");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sections = useMemo(() => splitTrafficAIReport(report), [report]);
  const singleAccount = !!accountId && accountId !== "all";

  async function generate() {
    if (!singleAccount || loading) return;
    setOpen(true); setLoading(true); setError(""); setReport("");
    abortRef.current = new AbortController();
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente para usar a IA.");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "traffic_analysis", account_id: accountId,
          start_date: format(startDate, "yyyy-MM-dd"), end_date: format(endDate, "yyyy-MM-dd"),
          selected_campaign_ids: selectedCampaignIds, question: focusQuestions[focus],
        }),
        signal: abortRef.current.signal,
      });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Erro ${response.status}`); }
      if (!response.body) throw new Error("A IA não retornou conteúdo.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; let accumulated = ""; let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, "");
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") { finished = true; break; }
            try { const delta = JSON.parse(raw).choices?.[0]?.delta?.content; if (delta) { accumulated += delta; setReport(accumulated); } } catch { /* aguarda o próximo fragmento */ }
          }
          newline = buffer.indexOf("\n");
        }
      }
      if (!accumulated.trim()) throw new Error("A resposta da IA veio vazia.");
      setGeneratedAt(new Date());
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError((caught as Error).message || "Não foi possível gerar a análise.");
    } finally { setLoading(false); }
  }

  return (
    <section className="border-b border-border bg-card">
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Bot className="h-5 w-5" /></span><div><h2 className="font-black">Analista de Tráfego IA</h2><p className="text-[11px] text-muted-foreground">Diagnóstico por conta e período, comparado ao intervalo anterior equivalente.</p></div></div>
        <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
          <Select value={focus} onValueChange={setFocus}><SelectTrigger className="h-9 w-full bg-background sm:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="complete">Análise completa</SelectItem><SelectItem value="cost">Custos e eficiência</SelectItem><SelectItem value="creative">Criativos e fadiga</SelectItem><SelectItem value="scale">Oportunidades de escala</SelectItem></SelectContent></Select>
          <Button onClick={generate} disabled={!singleAccount || loading} className="h-9"><Sparkles className={cn("mr-2 h-4 w-4", loading && "animate-pulse")} />{loading ? "Analisando…" : report ? "Gerar novamente" : "Análise por IA"}</Button>
          {(open || report) && <Button variant="ghost" size="icon" onClick={() => { abortRef.current?.abort(); setOpen(false); }} aria-label="Fechar análise"><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      {!singleAccount && <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 sm:mx-4"><TriangleAlert className="h-4 w-4" />Selecione uma conta Meta específica. A IA não mistura dados de contas diferentes.</div>}
      {open && <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Somente dados da conta selecionada</span><span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{accountName || "Conta Meta"} · {format(startDate, "dd/MM/yyyy")}–{format(endDate, "dd/MM/yyyy")}</span>{selectedCampaignIds.length > 0 && <span>{selectedCampaignIds.length} campanha(s) selecionada(s)</span>}{generatedAt && <span>Gerado às {format(generatedAt, "HH:mm")}</span>}</div>
        {error && <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><TriangleAlert className="h-4 w-4" />{error}<Button size="sm" variant="outline" className="ml-auto" onClick={generate}><RefreshCw className="mr-1 h-3.5 w-3.5" />Tentar novamente</Button></div>}
        {loading && !report && <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border bg-card"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-xs font-bold">Cruzando Meta, vendas e período anterior…</p><p className="mt-1 text-[10px] text-muted-foreground">Nenhuma alteração será feita nas campanhas.</p></div></div>}
        {report && <Tabs defaultValue="summary"><TabsList className="growdash-scrollbar h-auto w-full justify-start overflow-x-auto bg-muted/70 p-1">{sectionTabs.map((item) => <TabsTrigger key={item.key} value={item.key} disabled={!sections[item.key]?.trim()}>{item.label}</TabsTrigger>)}</TabsList>{sectionTabs.map((item) => <TabsContent key={item.key} value={item.key} className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-6"><Markdown>{sections[item.key] || "_Seção não retornada pela IA._"}</Markdown></TabsContent>)}</Tabs>}
      </div>}
    </section>
  );
}

function Markdown({ children }: { children: string }) { return <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-table:text-xs prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 prose-li:my-0.5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>; }
