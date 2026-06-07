import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Layers, RefreshCw, Eraser } from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformRules, useUpsertPlatformRule, useDeletePlatformRule, type PlatformRule } from "@/hooks/usePlatformRules";
import { inferPlatform, subOriginLabel } from "@/lib/platformInference";
import { useToast } from "@/hooks/use-toast";
import { HowToSyncSteps } from "./HowToSyncSteps";

const FIELDS = [
  { v: "utm_source", l: "utm_source" },
  { v: "utm_medium", l: "utm_medium" },
  { v: "utm_campaign", l: "utm_campaign" },
  { v: "utm_content", l: "utm_content" },
  { v: "utm_term", l: "utm_term" },
  { v: "rd_campaign", l: "Nome da campanha (RD)" },
];

const MODES = [
  { v: "contains", l: "contém" },
  { v: "equals", l: "é igual a" },
  { v: "regex", l: "regex" },
];

function RuleRow({ rule }: { rule: PlatformRule }) {
  const upsert = useUpsertPlatformRule();
  const del = useDeletePlatformRule();
  const [draft, setDraft] = useState(rule);

  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);

  return (
    <div className="grid grid-cols-12 gap-2 items-center text-xs">
      <Select value={draft.match_field} onValueChange={(v) => setDraft({ ...draft, match_field: v })}>
        <SelectTrigger className="col-span-3 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>{FIELDS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={draft.match_mode} onValueChange={(v) => setDraft({ ...draft, match_mode: v as any })}>
        <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
      </Select>
      <Input className="col-span-3 h-8" value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} placeholder="padrão" />
      <Input className="col-span-1 h-8" type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} title="Prioridade (menor = primeiro)" />
      <div className="col-span-1 flex justify-center" title="Ativa">
        <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
      </div>
      <div className="col-span-1 flex justify-center" title="Fallback: só roda se nenhuma regra principal casar">
        <Switch checked={draft.is_fallback === true} onCheckedChange={(v) => setDraft({ ...draft, is_fallback: v })} />
      </div>
      <div className="col-span-1 flex gap-1 justify-end">
        {dirty && <Button size="sm" className="h-7 px-2" onClick={() => upsert.mutate(draft)}>Salvar</Button>}
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del.mutate(rule.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NewRuleForm({ platform, parent }: { platform: string; parent: string | null }) {
  const upsert = useUpsertPlatformRule();
  const [field, setField] = useState("utm_source");
  const [mode, setMode] = useState<"contains" | "equals" | "regex">("contains");
  const [pattern, setPattern] = useState("");

  const add = () => {
    if (!pattern.trim()) return;
    upsert.mutate({
      platform,
      parent_platform: parent,
      match_field: field,
      match_mode: mode,
      pattern: pattern.trim(),
      priority: 100,
      is_active: true,
      is_fallback: false,
    });
    setPattern("");
  };

  return (
    <div className="flex gap-2 items-center pt-2 border-t">
      <Select value={field} onValueChange={setField}>
        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{FIELDS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={mode} onValueChange={(v) => setMode(v as any)}>
        <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
      </Select>
      <Input className="h-8 text-xs" placeholder="ex: meta|fb|ig" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      <Button size="sm" className="h-8" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Regra</Button>
    </div>
  );
}

function PlatformPanel({ platform, parent }: { platform: string; parent: string | null }) {
  const { data: rules = [] } = usePlatformRules();
  const list = useMemo(
    () => rules.filter((r) => r.platform === platform && (r.parent_platform ?? null) === parent),
    [rules, platform, parent]
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-muted-foreground font-medium px-1">
        <div className="col-span-3">Campo</div>
        <div className="col-span-2">Modo</div>
        <div className="col-span-3">Padrão</div>
        <div className="col-span-1">Prio</div>
        <div className="col-span-1 text-center">Ativa</div>
        <div className="col-span-1 text-center" title="Fallback: só roda se nenhuma regra principal casar">Fallback</div>
        <div className="col-span-1" />
      </div>
      {list.length === 0 && <p className="text-xs text-muted-foreground py-3">Nenhuma regra. Adicione abaixo.</p>}
      {list.map((r) => <RuleRow key={r.id} rule={r} />)}
      <NewRuleForm platform={platform} parent={parent} />
    </div>
  );
}

export function PlatformRulesSection() {
  const { data: rules = [] } = usePlatformRules();
  const { toast } = useToast();
  const upsert = useUpsertPlatformRule();
  const [newSub, setNewSub] = useState("");

  const subOrigins = useMemo(() => {
    const set = new Set(rules.filter((r) => r.parent_platform === "organic").map((r) => r.platform));
    if (set.size === 0) ["link_bio", "stories", "dm", "comentario"].forEach((s) => set.add(s));
    return Array.from(set);
  }, [rules]);

  const addSubOrigin = () => {
    const slug = newSub.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!slug) return;
    if (subOrigins.includes(slug)) {
      toast({ title: "Sub-origem já existe", variant: "destructive" });
      return;
    }
    upsert.mutate({
      platform: slug,
      parent_platform: "organic",
      match_field: "utm_source",
      match_mode: "contains",
      pattern: slug,
      priority: 100,
      is_active: true,
      is_fallback: false,
    });
    setNewSub("");
  };

  // Re-attribution actions
  const qc = useQueryClient();
  const { user } = useAuth();

  const reattribute = () => {
    qc.invalidateQueries({ queryKey: ["platform_rules"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["rd_deals_period"] });
    toast({ title: "Atribuição atualizada", description: "Vendas e leads foram reclassificados com as regras atuais." });
  };

  const clearOverrides = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const { error, count } = await supabase
        .from("sales")
        .update({ manual_platform: null }, { count: "exact" })
        .eq("user_id", user.id)
        .not("manual_platform", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Overrides limpos", description: `${n} venda(s) voltaram a usar a inferência automática.` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleClearOverrides = () => {
    if (confirm("Isso vai apagar a plataforma manual de todas as suas vendas e recalcular pelas regras. Continuar?")) {
      clearOverrides.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Plataformas e Origens</CardTitle>
            <CardDescription>
              Defina como classificar a origem de cada venda/lead. Regras principais rodam primeiro; regras marcadas como Fallback só rodam quando nenhuma principal casa (resgatam o "Não encontrado").
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleClearOverrides} disabled={clearOverrides.isPending}>
              <Eraser className="h-3.5 w-3.5 mr-1.5" /> Limpar overrides manuais
            </Button>
            <Button size="sm" onClick={reattribute}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-atribuir agora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <HowToSyncSteps
          steps={[
            { title: "Escolha a aba da plataforma (Meta, Google, Orgânico, Fallback)", detail: "Cada plataforma tem suas próprias regras de classificação." },
            { title: "Crie regras pelo campo + modo (regex / contém / igual)", detail: "Exemplo: utm_source contém 'facebook' → classifica como Meta." },
            { title: "Use 'Prio' para ordenar regras concorrentes", detail: "Quanto maior o número, maior a prioridade. Regras Fallback só rodam quando nenhuma principal casa." },
            { title: "Clique em 'Re-atribuir agora' depois de mudar regras", detail: "Reprocessa todas as vendas/leads aplicando as novas regras — pode levar alguns minutos." },
            { title: "'Limpar overrides manuais' apaga reclassificações feitas à mão", detail: "Use quando quiser que tudo volte a respeitar apenas as regras automáticas." },
          ]}
        />

        <Tabs defaultValue="meta">
          <TabsList>
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="organic">Orgânico</TabsTrigger>
            <TabsTrigger value="fallback">Fallback (Não encontrado)</TabsTrigger>
          </TabsList>
          <TabsContent value="meta" className="pt-4">
            <PlatformPanel platform="meta" parent={null} />
          </TabsContent>
          <TabsContent value="google" className="pt-4">
            <PlatformPanel platform="google" parent={null} />
          </TabsContent>
          <TabsContent value="organic" className="pt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Vendas sem nenhuma regra Meta/Google que case caem em Orgânico. Abaixo, classifique de qual sub-origem vem.
            </p>
            <Tabs defaultValue={subOrigins[0]}>
              <TabsList className="flex-wrap h-auto">
                {subOrigins.map((s) => (
                  <TabsTrigger key={s} value={s}>{subOriginLabel(s)}</TabsTrigger>
                ))}
              </TabsList>
              {subOrigins.map((s) => (
                <TabsContent key={s} value={s} className="pt-4">
                  <PlatformPanel platform={s} parent="organic" />
                </TabsContent>
              ))}
            </Tabs>
            <div className="flex gap-2 items-center pt-3 border-t">
              <Input className="h-8 text-xs max-w-[240px]" placeholder="Nova sub-origem (ex: WhatsApp)" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
              <Button size="sm" className="h-8" onClick={addSubOrigin}><Plus className="h-3.5 w-3.5 mr-1" /> Sub-origem</Button>
            </div>
          </TabsContent>
          <TabsContent value="fallback" className="pt-4">
            <FallbackPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FallbackPanel() {
  const { data: rules = [] } = usePlatformRules();
  const upsert = useUpsertPlatformRule();
  const del = useDeletePlatformRule();
  const list = useMemo(() => rules.filter((r) => r.is_fallback === true), [rules]);

  const [platform, setPlatform] = useState<"meta" | "google" | "organic">("organic");
  const [field, setField] = useState("utm_content");
  const [mode, setMode] = useState<"contains" | "equals" | "regex">("contains");
  const [pattern, setPattern] = useState("");

  const add = () => {
    if (!pattern.trim()) return;
    upsert.mutate({
      platform,
      parent_platform: null,
      match_field: field,
      match_mode: mode,
      pattern: pattern.trim(),
      priority: 1000,
      is_active: true,
      is_fallback: true,
    });
    setPattern("");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Use quando o lead/venda cai em "Não encontrado": ex. <code>utm_content</code> contém <code>gads_</code> → Google, ou <code>rd_campaign</code> contém <code>fluxo entrada</code> → Meta. Estas regras só rodam após as principais falharem.
      </p>

      <UnknownDiagnostics
        rules={rules}
        onPickPattern={(f, p) => { setField(f); setPattern(p); }}
      />


      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-muted-foreground font-medium px-1">
          <div className="col-span-2">Plataforma</div>
          <div className="col-span-3">Campo</div>
          <div className="col-span-2">Modo</div>
          <div className="col-span-3">Padrão</div>
          <div className="col-span-1">Prio</div>
          <div className="col-span-1" />
        </div>
        {list.length === 0 && <p className="text-xs text-muted-foreground py-3">Nenhuma regra de fallback. Adicione abaixo.</p>}
        {list.map((r) => {
          const platLabel = r.platform === "meta" ? "Meta" : r.platform === "google" ? "Google" : r.platform === "organic" ? "Orgânico" : r.platform;
          return (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center text-xs">
              <div className="col-span-2 font-medium">{platLabel}</div>
              <div className="col-span-3 text-muted-foreground truncate">{r.match_field}</div>
              <div className="col-span-2 text-muted-foreground">{r.match_mode}</div>
              <div className="col-span-3 truncate" title={r.pattern}>{r.pattern}</div>
              <div className="col-span-1 tabular-nums">{r.priority}</div>
              <div className="col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-2 items-center pt-3 border-t">
        <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
          <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="meta">Meta</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="organic">Orgânico</SelectItem>
          </SelectContent>
        </Select>
        <Select value={field} onValueChange={setField}>
          <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FIELDS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => setMode(v as any)}>
          <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="col-span-4 h-8 text-xs" placeholder="ex: gads_" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <Button size="sm" className="col-span-1 h-8" onClick={add}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function UnknownDiagnostics({
  rules,
  onPickPattern,
}: {
  rules: PlatformRule[];
  onPickPattern: (field: string, pattern: string) => void;
}) {
  const { user } = useAuth();

  const salesQ = useQuery({
    queryKey: ["diag_unknown_sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from("sales")
        .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, rd_campaign_name, manual_platform")
        .eq("user_id", user!.id)
        .gte("sale_date", since.toISOString().split("T")[0])
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dealsQ = useQuery({
    queryKey: ["diag_unknown_deals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from("rd_deals")
        .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, last_touch_utm_campaign, first_touch_utm_campaign")
        .eq("user_id", user!.id)
        .gte("lead_created_at", since.toISOString())
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        rd_campaign_name: d.last_touch_utm_campaign ?? d.first_touch_utm_campaign ?? d.utm_campaign ?? null,
      }));
    },
  });

  const stats = useMemo(() => {
    const sales = salesQ.data ?? [];
    const deals = dealsQ.data ?? [];
    const unknownSales = sales.filter((s: any) => inferPlatform(s, rules).platform === "unknown");
    const unknownDeals = deals.filter((d: any) => inferPlatform(d, rules).platform === "unknown");

    const buckets = new Map<string, { count: number; field: string; value: string }>();
    const push = (field: string, value: string | null) => {
      const v = (value ?? "").toString().trim();
      if (!v) return;
      const key = `${field}::${v.toLowerCase()}`;
      const e = buckets.get(key);
      if (e) e.count++;
      else buckets.set(key, { count: 1, field, value: v });
    };
    for (const s of unknownSales) {
      push("utm_source", (s as any).utm_source);
      push("rd_campaign", (s as any).rd_campaign_name);
      push("utm_campaign", (s as any).utm_campaign);
    }
    for (const d of unknownDeals) {
      push("utm_source", (d as any).utm_source);
      push("rd_campaign", (d as any).rd_campaign_name);
      push("utm_campaign", (d as any).utm_campaign);
    }
    const top = Array.from(buckets.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    return {
      salesCount: unknownSales.length,
      dealsCount: unknownDeals.length,
      salesTotal: sales.length,
      dealsTotal: deals.length,
      top,
    };
  }, [salesQ.data, dealsQ.data, rules]);

  const loading = salesQ.isLoading || dealsQ.isLoading;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase text-muted-foreground">Diagnóstico · últimos 90 dias</div>
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-background p-3 border">
          <div className="text-2xl font-semibold tabular-nums">{stats.salesCount}</div>
          <div className="text-xs text-muted-foreground">vendas em "Não encontrado" <span className="opacity-60">de {stats.salesTotal}</span></div>
        </div>
        <div className="rounded-md bg-background p-3 border">
          <div className="text-2xl font-semibold tabular-nums">{stats.dealsCount}</div>
          <div className="text-xs text-muted-foreground">leads em "Não encontrado" <span className="opacity-60">de {stats.dealsTotal}</span></div>
        </div>
      </div>

      {stats.top.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase text-muted-foreground font-medium px-1">Padrões mais frequentes — clique para criar regra</div>
          {stats.top.map((t) => (
            <button
              key={`${t.field}::${t.value}`}
              type="button"
              onClick={() => onPickPattern(t.field, t.value)}
              className="w-full grid grid-cols-12 gap-2 items-center text-xs rounded-md px-2 py-1.5 hover:bg-background border border-transparent hover:border-border transition-colors"
            >
              <span className="col-span-3 text-muted-foreground text-left">{t.field}</span>
              <span className="col-span-7 truncate font-mono text-left" title={t.value}>{t.value}</span>
              <span className="col-span-2 text-right tabular-nums text-muted-foreground">{t.count}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

