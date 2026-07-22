import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, CheckCircle2, ExternalLink, Eye, Heart, ImageOff, Instagram, RefreshCw, Sparkles, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { PageHeading } from "./shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInstagramOAuth } from "@/hooks/useInstagramOAuth";
import { useToast } from "@/hooks/use-toast";
import { metricDescription } from "@/lib/metricPresentation";

type SocialAccount = {
  id: string;
  provider: string;
  username: string | null;
  display_name: string;
  profile_picture_url: string | null;
  followers_count: number;
  media_count: number;
  connection_status: string;
  last_sync_at: string | null;
  last_error: string | null;
};
type SocialMedia = {
  id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  interactions: number;
  engagement_rate: number;
};
type DailyInsight = { insight_date: string; followers: number; follower_delta: number; reach: number; impressions: number; interactions: number };

const number = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function MediaPreview({ media }: { media: SocialMedia }) {
  const [failed, setFailed] = useState(false);
  const source = media.thumbnail_url || media.media_url;
  if (!source || failed) return <div className="grid aspect-square place-items-center bg-gradient-to-br from-muted to-background text-muted-foreground"><ImageOff className="h-7 w-7" /><span className="sr-only">Prévia indisponível</span></div>;
  return <img src={source} alt={media.caption?.slice(0, 80) || "Conteúdo do Instagram"} className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" onError={() => setFailed(true)} />;
}

export default function SocialMediaPage() {
  const { startDate, endDate } = useGlobalFilters();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const connectInstagram = useInstagramOAuth();
  const [accountId, setAccountId] = useState("");

  const accountsQuery = useQuery({
    queryKey: ["social_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialAccount[];
    },
  });
  const accounts = accountsQuery.data ?? [];
  const selectedId = accountId || accounts[0]?.id || "";
  const selected = accounts.find((account) => account.id === selectedId);

  const mediaQuery = useQuery({
    queryKey: ["social_media", selectedId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_media").select("*").eq("social_account_id", selectedId).gte("published_at", startDate.toISOString()).lte("published_at", endDate.toISOString()).order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialMedia[];
    },
  });
  const dailyQuery = useQuery({
    queryKey: ["social_insights_daily", selectedId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_insights_daily").select("*").eq("social_account_id", selectedId).gte("insight_date", format(startDate, "yyyy-MM-dd")).lte("insight_date", format(endDate, "yyyy-MM-dd")).order("insight_date");
      if (error) throw error;
      return (data ?? []) as DailyInsight[];
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Selecione uma conta.");
      const { data, error } = await supabase.functions.invoke("social-sync-instagram", { body: { social_account_id: selectedId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Mídia social atualizada", description: data?.message });
      queryClient.invalidateQueries({ queryKey: ["social_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["social_media"] });
      queryClient.invalidateQueries({ queryKey: ["social_insights_daily"] });
    },
    onError: (error: Error) => toast({ title: "Falha na sincronização", description: error.message, variant: "destructive" }),
  });

  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const daily = dailyQuery.data ?? [];
  const totals = useMemo(() => media.reduce((sum, item) => ({ reach: sum.reach + Number(item.reach), interactions: sum.interactions + Number(item.interactions), likes: sum.likes + Number(item.likes), comments: sum.comments + Number(item.comments), saves: sum.saves + Number(item.saves), shares: sum.shares + Number(item.shares) }), { reach: 0, interactions: 0, likes: 0, comments: 0, saves: 0, shares: 0 }), [media]);
  const engagement = totals.reach > 0 ? (totals.interactions / totals.reach) * 100 : 0;
  const best = [...media].sort((a, b) => b.interactions - a.interactions)[0];
  const chart = daily.map((row) => ({ ...row, label: format(new Date(`${row.insight_date}T12:00:00`), "dd/MM") }));

  const schemaMissing = accountsQuery.error && /social_accounts|schema cache|relation/i.test((accountsQuery.error as Error).message);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeading eyebrow="Inteligência de conteúdo" title="Análise de Mídia Social" description="Métricas orgânicas oficiais por perfil e por conteúdo, sem misturar resultados pagos do Meta Ads." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Conectando…" : "Conectar Instagram"}</Button><Button onClick={() => sync.mutate()} disabled={!selectedId || sync.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />Atualizar dados</Button></div>} />

      {schemaMissing && <section className="gd-panel border-amber-500/30 p-5"><b className="text-sm text-amber-500">Atualização de banco pendente</b><p className="mt-1 text-xs text-muted-foreground">Aplique a migration 20260715120000 para liberar contas, conteúdos e insights sociais.</p></section>}

      {!accountsQuery.isLoading && !accounts.length && !schemaMissing ? (
        <section className="gd-panel grid min-h-[420px] place-items-center overflow-hidden p-8 text-center">
          <div className="max-w-lg"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#f3c74a] to-[#9b6810] text-[#211706] shadow-[0_18px_60px_-25px_rgba(226,176,44,.9)]"><Instagram className="h-8 w-8" /></span><h2 className="mt-6 text-2xl font-black">Conecte um perfil profissional</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Use o login oficial do Instagram para importar perfil, publicações, Reels e métricas de alcance, salvamentos, compartilhamentos e engajamento. Senhas nunca passam pela Growdash.</p><Button className="mt-6" onClick={() => connectInstagram.mutate()}><Instagram className="mr-2 h-4 w-4" />Continuar com Instagram</Button></div>
        </section>
      ) : accounts.length > 0 ? (
        <>
          <section className="gd-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">{selected?.profile_picture_url ? <img src={selected.profile_picture_url} className="h-11 w-11 rounded-xl object-cover" alt="" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Instagram className="h-5 w-5" /></span>}<div className="min-w-0"><b className="block truncate text-sm">{selected?.display_name}</b><span className="text-xs text-muted-foreground">@{selected?.username || "perfil"} · {selected?.connection_status === "connected" ? "conectado" : selected?.connection_status}</span></div></div>
            <Select value={selectedId} onValueChange={setAccountId}><SelectTrigger className="sm:ml-auto sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>@{account.username || account.display_name}</SelectItem>)}</SelectContent></Select>
            <span className="text-[10px] text-muted-foreground">Último sync: {selected?.last_sync_at ? format(new Date(selected.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}</span>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={<Users />} label="Seguidores" value={number.format(selected?.followers_count ?? 0)} />
            <Kpi icon={<Eye />} label="Alcance no período" value={number.format(totals.reach)} />
            <Kpi icon={<Heart />} label="Interações" value={number.format(totals.interactions)} />
            <Kpi icon={<TrendingUp />} label="Engajamento" value={`${engagement.toFixed(2).replace(".", ",")}%`} />
            <Kpi icon={<BarChart3 />} label="Conteúdos analisados" value={String(media.length)} />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="h-auto w-full justify-start overflow-x-auto p-1"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="content">Conteúdos</TabsTrigger><TabsTrigger value="audience">Audiência</TabsTrigger><TabsTrigger value="recommendations">Recomendações</TabsTrigger></TabsList>
            <TabsContent value="overview" className="grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
              <section className="gd-panel p-5"><h3 className="font-black">Evolução do perfil</h3><p className="text-xs text-muted-foreground">Seguidores, alcance e interações dentro do período global.</p><div className="mt-5 h-72">{chart.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} /><ChartTooltip contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 12 }} /><Line type="monotone" dataKey="followers" stroke="#e0ad2d" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="reach" stroke="#3da46d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <Empty text="Sincronize a conta para formar a série histórica diária." />}</div></section>
              <section className="gd-panel p-5"><Sparkles className="h-5 w-5 text-primary" /><h3 className="mt-3 font-black">Melhor conteúdo</h3>{best ? <><p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{best.caption || "Conteúdo sem legenda"}</p><div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Interações" value={number.format(best.interactions)} /><Mini label="Alcance" value={number.format(best.reach)} /><Mini label="Salvos" value={number.format(best.saves)} /><Mini label="Compart." value={number.format(best.shares)} /></div>{best.permalink && <Button asChild variant="outline" className="mt-4 w-full"><a href={best.permalink} target="_blank" rel="noreferrer">Abrir publicação <ExternalLink className="ml-2 h-3 w-3" /></a></Button>}</> : <Empty text="Nenhum conteúdo no período." />}</section>
            </TabsContent>
            <TabsContent value="content"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{media.map((item) => <article key={item.id} className="gd-panel group overflow-hidden"><MediaPreview media={item} /><div className="p-4"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-primary"><span>{item.media_type}</span><span>{item.published_at ? format(new Date(item.published_at), "dd/MM/yyyy") : "—"}</span></div><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{item.caption || "Sem legenda"}</p><div className="mt-4 grid grid-cols-3 gap-2"><Mini label="Alcance" value={number.format(item.reach)} /><Mini label="Interações" value={number.format(item.interactions)} /><Mini label="Engaj." value={`${Number(item.engagement_rate).toFixed(1)}%`} /></div></div></article>)}{!media.length && <Empty text="Nenhum conteúdo publicado no período selecionado." />}</div></TabsContent>
            <TabsContent value="audience"><section className="gd-panel p-6"><h3 className="font-black">Crescimento da audiência</h3><p className="mt-1 text-xs text-muted-foreground">A API oficial disponibiliza demografia apenas quando a conta e a métrica atendem aos critérios mínimos da Meta. A Growdash não estima idade, gênero ou localização ausentes.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Seguidores atuais" value={number.format(selected?.followers_count ?? 0)} /><Mini label="Variação registrada" value={number.format(daily.reduce((sum, row) => sum + Number(row.follower_delta), 0))} /><Mini label="Publicações" value={number.format(selected?.media_count ?? 0)} /></div></section></TabsContent>
            <TabsContent value="recommendations"><section className="grid gap-3 md:grid-cols-2"><Recommendation title="Repita o que gera intenção" text={best ? `O conteúdo líder concentra ${number.format(best.saves + best.shares)} salvamentos e compartilhamentos. Use o mesmo tema em novos formatos.` : "Sincronize conteúdos para identificar temas com maior intenção."} /><Recommendation title="Proteção contra mídia expirada" text="URLs temporárias são atualizadas em cada sincronização e a interface exibe fallback quando a CDN da Meta expira uma prévia." /><Recommendation title="Orgânico ≠ pago" text="Alcance e interação deste módulo nunca são somados às métricas de campanha do Meta Ads." /><Recommendation title="Decisão com contexto" text="Compare pelo menos sete dias e volume suficiente antes de concluir que um formato ou horário venceu." /></section></TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="gd-panel gd-metric-card group cursor-default p-4 transition hover:-translate-y-0.5 hover:border-primary/30" title={metricDescription(label)}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-muted-foreground">{label}</p><strong className="mt-3 block text-2xl font-black tabular-nums">{value}</strong></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div></article>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-muted/20 p-3"><span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><b className="mt-1 block text-sm tabular-nums">{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{text}</div>; }
function Recommendation({ title, text }: { title: string; text: string }) { return <article className="gd-panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><b className="text-sm">{title}</b></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></article>; }
