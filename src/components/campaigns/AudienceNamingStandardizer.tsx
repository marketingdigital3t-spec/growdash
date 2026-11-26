import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Copy, Plus, Tag, UsersRound, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const GTM_TAG = "[GTM]";

type AudienceCategory = "engagement-ig" | "engagement-fb" | "video-ig" | "video-fb" | "site" | "event" | "form" | "instant";

type AudienceRow = { id: string; label: string; name: string };

const categories: Array<{ id: AudienceCategory; label: string; short: string }> = [
  { id: "engagement-ig", label: "Envolvimento Instagram", short: "IG" },
  { id: "engagement-fb", label: "Envolvimento Facebook", short: "FB" },
  { id: "video-ig", label: "Vídeo · Instagram", short: "IG" },
  { id: "video-fb", label: "Vídeo · Facebook", short: "FB" },
  { id: "site", label: "Tráfego do site", short: "Site" },
  { id: "event", label: "Evento", short: "Evento" },
  { id: "form", label: "Formulário", short: "Formulário" },
  { id: "instant", label: "Experiência instantânea", short: "E. I." },
];

const engagementWindows = [2, 7, 14, 30, 60, 90, 180, 365];
const videoPercentages = [25, 50, 75, 95];
const videoWindows = [30, 60, 90, 180, 365];
const standardWindows = [7, 15, 30, 60, 90, 180];

function withTag(name: string) {
  const trimmed = name.trim().replace(/^\[GTM\]\s*/i, "");
  return `${GTM_TAG} ${trimmed}`;
}

function makeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildRows(category: AudienceCategory, label: string, eventName: string, actionName: string): AudienceRow[] {
  const customLabel = label.trim() || "Rótulo";
  const event = eventName.trim() || "Tipo de ação";
  const action = actionName.trim() || "Tipo de ação";
  if (category === "engagement-ig" || category === "engagement-fb") {
    return engagementWindows.map((days) => ({ id: `${category}-${days}`, label: `${days}D`, name: withTag(`${category === "engagement-ig" ? "IG" : "FB"} - Envolvimento [${customLabel}] - ${days}D`) }));
  }
  if (category === "video-ig" || category === "video-fb") {
    const platform = category === "video-ig" ? "IG" : "FB";
    return videoPercentages.flatMap((percentage) => videoWindows.map((days) => ({ id: `${category}-${percentage}-${days}`, label: `${percentage}% · ${days}D`, name: withTag(`${platform} - Viu vídeo [${customLabel}] ${percentage}% ${days}D`) })));
  }
  if (category === "site") return standardWindows.map((days) => ({ id: `${category}-${days}`, label: `${days}D`, name: withTag(`View Site [${event}] ${days}D`) }));
  if (category === "event") return standardWindows.map((days) => ({ id: `${category}-${days}`, label: `${days}D`, name: withTag(`Evento [${event}] ${days}D`) }));
  if (category === "form") return standardWindows.map((days) => ({ id: `${category}-${days}`, label: `${days}D`, name: withTag(`Formulário [${event}] - [${action}] ${days}D`) }));
  return standardWindows.map((days) => ({ id: `${category}-${days}`, label: `${days}D`, name: withTag(`E. I. [${event}] - [${action}] ${days}D`) }));
}

export default function AudienceNamingStandardizer() {
  const [category, setCategory] = useState<AudienceCategory>("engagement-ig");
  const [label, setLabel] = useState("TODOS");
  const [eventName, setEventName] = useState("");
  const [actionName, setActionName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customParts, setCustomParts] = useState<string[]>(["Novo público"]);
  const selected = categories.find((item) => item.id === category) || categories[0];
  const rows = useMemo(() => buildRows(category, label, eventName, actionName), [actionName, category, eventName, label]);

  const copy = async (row: AudienceRow) => {
    await navigator.clipboard.writeText(row.name);
    setCopiedId(row.id);
    window.setTimeout(() => setCopiedId((current) => current === row.id ? null : current), 1600);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(rows.map((row) => row.name).join("\n"));
    setCopiedId("all");
    window.setTimeout(() => setCopiedId((current) => current === "all" ? null : current), 1600);
  };

  return (
    <section className="space-y-4">
      <header className="gd-panel flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-primary"><Tag className="h-4 w-4" />Padronização de públicos</div>
          <h2 className="mt-2 text-xl font-black">Organize os públicos da sua conta</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Gere nomes consistentes para públicos do Meta Ads e copie cada variação com a tag <strong className="text-foreground">{GTM_TAG}</strong> aplicada automaticamente.</p>
        </div>
        <Button type="button" onClick={copyAll} disabled={!rows.length} className="shrink-0"><ClipboardCopy className="mr-2 h-4 w-4" />{copiedId === "all" ? "Todos copiados" : "Copiar todos"}</Button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="gd-panel h-fit p-3">
          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Categorias</p>
          <div className="grid gap-1">
            {categories.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition", category === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-background/60 text-[9px] font-black">{item.short === "IG" || item.short === "FB" ? item.short : "•"}</span>{item.label}</button>)}
          </div>
        </aside>

        <div className="space-y-4">
          <section className="gd-panel space-y-4 p-5">
            <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /><h3 className="font-black">Configuração do padrão</h3></div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="audience-label">Rótulo do público</Label><Input id="audience-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Todos, Curso, Remarketing" /></div>
              {(category === "site" || category === "event" || category === "form" || category === "instant") && <div className="space-y-2"><Label htmlFor="audience-event">{category === "site" ? "Página" : category === "event" ? "Tipo de ação" : "Nome"}</Label><Input id="audience-event" value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder={category === "site" ? "Ex.: checkout" : "Ex.: Lead"} /></div>}
              {(category === "form" || category === "instant") && <div className="space-y-2"><Label htmlFor="audience-action">Tipo de ação</Label><Input id="audience-action" value={actionName} onChange={(event) => setActionName(event.target.value)} placeholder="Ex.: abriu, enviou" /></div>}
              {(category === "video-ig" || category === "video-fb") && <div className="flex items-end gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground"><Video className="h-4 w-4 shrink-0 text-primary" />25%, 50%, 75% e 95% com janelas de retenção.</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-primary px-2 py-1 font-black text-primary-foreground">{GTM_TAG}</span> será incluída no início de todos os nomes.</div>
          </section>

          <section className="gd-panel overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h3 className="font-black">{selected.label}</h3><p className="mt-1 text-[11px] text-muted-foreground">{rows.length} nomes prontos para copiar.</p></div><span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10px] font-black text-primary">{GTM_TAG} ativo</span></header>
            <div className="divide-y divide-border">
              {rows.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><span className="w-20 shrink-0 text-[10px] font-black text-muted-foreground">{row.label}</span><code className="min-w-0 grow break-words rounded-md bg-muted/60 px-3 py-2 text-xs">{row.name}</code><Button type="button" variant="outline" size="sm" onClick={() => copy(row)}><Copy className="mr-2 h-3.5 w-3.5" />{copiedId === row.id ? "Copiado" : "Copiar"}</Button></div>)}
              {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">Preencha os campos para gerar os nomes.</p>}
            </div>
          </section>

          <section className="gd-panel p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Público personalizado</h3><p className="mt-1 text-[11px] text-muted-foreground">Monte um nome livre sem perder o padrão da Growdash.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setCustomParts((parts) => [...parts, "Nova parte"])} disabled={customParts.length >= 8}><Plus className="mr-2 h-4 w-4" />Adicionar parte</Button></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{customParts.map((part, index) => <Input key={`${index}-${part}`} value={part} maxLength={60} aria-label={`Parte personalizada ${index + 1}`} onChange={(event) => setCustomParts((parts) => parts.map((current, partIndex) => partIndex === index ? event.target.value : current))} />)}</div>
            <div className="mt-3 flex flex-wrap items-center gap-3"><code className="min-w-0 grow rounded-md bg-muted/60 px-3 py-2 text-xs">{withTag(customParts.filter(Boolean).join(" - ") || "Novo público")}</code><Button type="button" variant="outline" size="sm" onClick={() => copy({ id: "custom", label: "Personalizado", name: withTag(customParts.filter(Boolean).join(" - ") || "Novo público") })}><Copy className="mr-2 h-3.5 w-3.5" />{copiedId === "custom" ? "Copiado" : "Copiar"}</Button></div>
          </section>
        </div>
      </div>
    </section>
  );
}
