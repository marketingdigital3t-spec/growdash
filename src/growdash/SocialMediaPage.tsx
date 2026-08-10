import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, CheckCircle2, ExternalLink, Eye, Heart, ImageOff, Instagram, RefreshCw, Sparkles, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { PageHeading } from "./shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInstagramOAuth } from "@/hooks/useInstagramOAuth";
import { useToast } from "@/hooks/use-toast";
import { metricDescription } from "@/lib/metricPresentation";
import { useAuth } from "@/contexts/AuthContext";

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
  video_views?: number | null;
  average_watch_time?: number | null;
  video_retention_rate?: number | null;
};
type DailyInsight = { insight_date: string; followers: number; follower_delta: number; reach: number; impressions: number; interactions: number };

const number = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Preview-only data. It never reaches Supabase, never triggers a sync and is
// deliberately marked in the UI so it cannot be mistaken for a real account.
const DEMO_ACCOUNT: SocialAccount = {
  id: "growdash-demo-instagram",
  provider: "instagram",
  username: "studio.growdash_demo",
  display_name: "Studio Growdash · demonstração",
  profile_picture_url: null,
  followers_count: 12840,
  media_count: 86,
  connection_status: "demo",
  last_sync_at: null,
  last_error: null,
};

const DEMO_MEDIA: SocialMedia[] = [
  { id: "demo-reel-1", media_type: "REELS", caption: "3 ajustes que aumentaram a qualidade dos leads nesta semana.", permalink: null, media_url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80", thumbnail_url: null, published_at: "2026-08-08T15:00:00.000Z", reach: 18420, impressions: 22110, likes: 1286, comments: 74, saves: 318, shares: 142, interactions: 1820, engagement_rate: 9.88, video_views: 16200, average_watch_time: 13.8, video_retention_rate: 47.2 },
  { id: "demo-post-1", media_type: "CAROUSEL_ALBUM", caption: "Checklist para uma campanha começar bem antes da decolagem.", permalink: null, media_url: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80", thumbnail_url: null, published_at: "2026-08-05T14:00:00.000Z", reach: 9230, impressions: 10780, likes: 692, comments: 38, saves: 226, shares: 87, interactions: 1043, engagement_rate: 11.30, video_views: 0, average_watch_time: null, video_retention_rate: null },
  { id: "demo-reel-2", media_type: "VIDEO", caption: "Bastidores de uma reunião de performance com foco em decisões.", permalink: null, media_url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80", thumbnail_url: null, published_at: "2026-08-02T13:00:00.000Z", reach: 6750, impressions: 8010, likes: 413, comments: 21, saves: 96, shares: 44, interactions: 574, engagement_rate: 8.50, video_views: 5840, average_watch_time: 10.4, video_retention_rate: 39.6 },
];

const DEMO_DAILY: DailyInsight[] = Array.from({ length: 14 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 7, index + 1));
  const followerDelta = [18, 26, -4, 31, 24, 39, 12, -7, 42, 28, 36, 19, 47, 33][index];
  return {
    insight_date: format(day, "yyyy-MM-dd"),
    followers: 12496 + [18, 44, 40, 71, 95, 134, 146, 139, 181, 209, 245, 264, 311, 344][index],
    follower_delta: followerDelta,
    reach: 2400 + index * 260 + (index % 3) * 520,
    impressions: 3000 + index * 330 + (index % 3) * 610,
    interactions: 180 + index * 22 + (index % 4) * 36,
  };
});

function MediaPreview({ media }: { media: SocialMedia }) {
  const [failed, setFailed] = useState(false);
  const source = media.thumbnail_url || media.media_url;
  if (!source || failed) return <div className="grid aspect-square place-items-center bg-gradient-to-br from-muted to-background text-muted-foreground"><ImageOff className="h-7 w-7" /><span className="sr-only">Prévia indisponível</span></div>;
  return <img src={source} alt={media.caption?.slice(0, 80) || "Conteúdo do Instagram"} className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" onError={() => setFailed(true)} />;
}

export default function SocialMediaPage() {
  const { startDate, endDate } = useGlobalFilters();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const connectInstagram = useInstagramOAuth();
  const [accountId, setAccountId] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SocialMedia | null>(null);
  const [contentSort, setContentSort] = useState<"interactions" | "reach" | "engagement_rate" | "saves" | "shares" | "comments" | "video_views">("interactions");

  const accountsQuery = useQuery({
    queryKey: ["social_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("social_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialAccount[];
    },
  });
  const liveAccounts = accountsQuery.data ?? [];
  const accounts = demoMode ? [DEMO_ACCOUNT] : liveAccounts;
  const selectedId = demoMode ? DEMO_ACCOUNT.id : accountId || accounts[0]?.id || "";
  const selected = accounts.find((account) => account.id === selectedId);

  const mediaQuery = useQuery({
    queryKey: ["social_media", selectedId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!selectedId && !demoMode,
    queryFn: async () => {
      const { data, error } = await supabase.from("social_media").select("*").eq("social_account_id", selectedId).gte("published_at", startDate.toISOString()).lte("published_at", endOfDay(endDate).toISOString()).order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialMedia[];
    },
  });
  const dailyQuery = useQuery({
    queryKey: ["social_insights_daily", selectedId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!selectedId && !demoMode,
    queryFn: async () => {
      const { data, error } = await supabase.from("social_insights_daily").select("*").eq("social_account_id", selectedId).gte("insight_date", format(startDate, "yyyy-MM-dd")).lte("insight_date", format(endDate, "yyyy-MM-dd")).order("insight_date");
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

  const media = useMemo(() => demoMode ? DEMO_MEDIA : mediaQuery.data ?? [], [demoMode, mediaQuery.data]);
  const sortedMedia = useMemo(() => [...media].sort((a, b) => Number(b[contentSort] || 0) - Number(a[contentSort] || 0)), [contentSort, media]);
  const daily = demoMode ? DEMO_DAILY : dailyQuery.data ?? [];
  const totals = useMemo(() => media.reduce((sum, item) => ({ reach: sum.reach + Number(item.reach), interactions: sum.interactions + Number(item.interactions), likes: sum.likes + Number(item.likes), comments: sum.comments + Number(item.comments), saves: sum.saves + Number(item.saves), shares: sum.shares + Number(item.shares) }), { reach: 0, interactions: 0, likes: 0, comments: 0, saves: 0, shares: 0 }), [media]);
  const engagement = totals.reach > 0 ? (totals.interactions / totals.reach) * 100 : 0;
  const followersGained = daily.reduce((sum, row) => sum + Math.max(Number(row.follower_delta || 0), 0), 0);
  const followersLost = Math.abs(daily.reduce((sum, row) => sum + Math.min(Number(row.follower_delta || 0), 0), 0));
  const videoRows = media.filter((item) => ["VIDEO", "REELS"].includes(String(item.media_type).toUpperCase()));
  const videoViews = videoRows.reduce((sum, item) => sum + Number(item.video_views || 0), 0);
  const retentionSamples = videoRows.filter((item) => Number(item.video_retention_rate || 0) > 0);
  const videoRetention = retentionSamples.length ? retentionSamples.reduce((sum, item) => sum + Number(item.video_retention_rate || 0), 0) / retentionSamples.length : 0;
  const watchTimeSamples = videoRows.filter((item) => Number(item.average_watch_time || 0) > 0);
  const averageWatchTime = watchTimeSamples.length ? watchTimeSamples.reduce((sum, item) => sum + Number(item.average_watch_time || 0), 0) / watchTimeSamples.length : 0;
  const best = [...media].sort((a, b) => b.interactions - a.interactions)[0];
  const chart = daily.map((row) => ({ ...row, label: format(new Date(`${row.insight_date}T12:00:00`), "dd/MM") }));

  const schemaMissing = !demoMode && accountsQuery.error && /social_accounts|schema cache|relation/i.test((accountsQuery.error as Error).message);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeading eyebrow="Inteligência de conteúdo" title="Análise de Mídia Social" description="Métricas orgânicas oficiais por perfil e por conteúdo, sem misturar resultados pagos do Meta Ads." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDemoMode((current) => !current)}>{demoMode ? "Sair da demonstração" : "Ver demonstração"}</Button><Button variant="outline" onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Conectando…" : "Conectar Instagram"}</Button><Button onClick={() => sync.mutate()} disabled={demoMode || !selectedId || sync.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />Atualizar dados</Button></div>} />

      {schemaMissing && <section className="gd-panel border-amber-500/30 p-5"><b className="text-sm text-amber-500">Atualização de banco pendente</b><p className="mt-1 text-xs text-muted-foreground">Aplique a migration 20260715120000 para liberar contas, conteúdos e insights sociais.</p></section>}

      {accountsQuery.isLoading ? <section className="gd-panel grid min-h-[420px] place-items-center p-8 text-center" role="status" aria-live="polite"><p className="text-sm text-muted-foreground">Verificando perfis conectados…</p></section> : !accounts.length && !schemaMissing ? (
        <section className="gd-panel grid min-h-[420px] place-items-center overflow-hidden p-8 text-center">
          <div className="max-w-lg"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#f3c74a] to-[#9b6810] text-[#211706] shadow-[0_18px_60px_-25px_rgba(226,176,44,.9)]"><Instagram className="h-8 w-8" /></span><h2 className="mt-6 text-2xl font-black">Conecte um perfil profissional</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Use o login oficial do Instagram para importar perfil, publicações, Reels e métricas de alcance, salvamentos, compartilhamentos e engajamento. Senhas nunca passam pela Growdash.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={() => connectInstagram.mutate()}><Instagram className="mr-2 h-4 w-4" />Continuar com Instagram</Button><Button variant="outline" onClick={() => setDemoMode(true)}>Ver dados demonstrativos</Button></div></div>
        </section>
      ) : accounts.length > 0 ? (
        <>
          <section className="gd-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">{selected?.profile_picture_url ? <img src={selected.profile_picture_url} className="h-11 w-11 rounded-xl object-cover" alt="" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Instagram className="h-5 w-5" /></span>}<div className="min-w-0"><b className="block truncate text-sm">{selected?.display_name}</b><span className="text-xs text-muted-foreground">@{selected?.username || "perfil"} · {selected?.connection_status === "connected" ? "conectado" : selected?.connection_status}</span></div></div>
            <Select value={selectedId} onValueChange={setAccountId}><SelectTrigger aria-label="Selecionar perfil do Instagram" className="sm:ml-auto sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>@{account.username || account.display_name}</SelectItem>)}</SelectContent></Select>
            <span className={demoMode ? "rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-500" : "text-[10px] text-muted-foreground"}>{demoMode ? "Demonstração — dados não oficiais" : `Último sync: ${selected?.last_sync_at ? format(new Date(selected.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}`}</span>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Kpi icon={<Users />} label="Seguidores" value={number.format(selected?.followers_count ?? 0)} />
            <Kpi icon={<TrendingUp />} label="Ganhos" value={`+${number.format(followersGained)}`} />
            <Kpi icon={<TrendingUp />} label="Perdidos" value={`-${number.format(followersLost)}`} />
            <Kpi icon={<Eye />} label="Alcance no período" value={number.format(totals.reach)} />
            <Kpi icon={<Heart />} label="Interações" value={number.format(totals.interactions)} />
            <Kpi icon={<TrendingUp />} label="Engajamento" value={`${engagement.toFixed(2).replace(".", ",")}%`} />
            <Kpi icon={<BarChart3 />} label="Retenção de vídeo" value={videoRetention ? `${videoRetention.toFixed(1).replace(".", ",")}%` : averageWatchTime ? `${averageWatchTime.toFixed(1).replace(".", ",")} s médios` : videoViews ? "Sem métrica" : "—"} />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="h-auto w-full justify-start overflow-x-auto p-1"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="content">Conteúdos</TabsTrigger><TabsTrigger value="audience">Audiência</TabsTrigger><TabsTrigger value="recommendations">Recomendações</TabsTrigger></TabsList>
            <TabsContent value="overview" className="grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
              <section className="gd-panel p-5"><h3 className="font-black">Evolução do perfil</h3><p className="text-xs text-muted-foreground">Seguidores, alcance e interações dentro do período global.</p><div className="mt-5 h-72">{chart.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} /><ChartTooltip contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 12 }} /><Line type="monotone" dataKey="followers" stroke="#e0ad2d" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="reach" stroke="#3da46d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <Empty text="Sincronize a conta para formar a série histórica diária." />}</div></section>
              <section className="gd-panel p-5"><Sparkles className="h-5 w-5 text-primary" /><h3 className="mt-3 font-black">Melhor conteúdo</h3>{best ? <><p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{best.caption || "Conteúdo sem legenda"}</p><div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Interações" value={number.format(best.interactions)} /><Mini label="Alcance" value={number.format(best.reach)} /><Mini label="Salvos" value={number.format(best.saves)} /><Mini label="Compart." value={number.format(best.shares)} /></div>{best.permalink && <Button asChild variant="outline" className="mt-4 w-full"><a href={best.permalink} target="_blank" rel="noreferrer">Abrir publicação <ExternalLink className="ml-2 h-3 w-3" /></a></Button>}</> : <Empty text="Nenhum conteúdo no período." />}</section>
            </TabsContent>
            <TabsContent value="content"><div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">Posts, Reels e vídeos</b><p className="text-[10px] text-muted-foreground">Clique em uma publicação para abrir a análise detalhada.</p></div><Select value={contentSort} onValueChange={(value) => setContentSort(value as typeof contentSort)}><SelectTrigger className="sm:w-60" aria-label="Ordenar conteúdos do Instagram"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="interactions">Mais interações</SelectItem><SelectItem value="reach">Maior alcance</SelectItem><SelectItem value="engagement_rate">Maior engajamento</SelectItem><SelectItem value="saves">Mais salvamentos</SelectItem><SelectItem value="shares">Mais compartilhamentos</SelectItem><SelectItem value="comments">Mais comentários</SelectItem><SelectItem value="video_views">Mais visualizações</SelectItem></SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{sortedMedia.map((item) => <article key={item.id} role="button" tabIndex={0} aria-label={`Ver detalhes da publicação ${item.caption?.slice(0, 60) || item.media_type}`} onClick={() => setSelectedMedia(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMedia(item); } }} className="gd-panel group cursor-pointer overflow-hidden outline-none transition hover:-translate-y-0.5 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><MediaPreview media={item} /><div className="p-4"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-primary"><span>{item.media_type}</span><span>{item.published_at ? format(new Date(item.published_at), "dd/MM/yyyy") : "—"}</span></div><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{item.caption || "Sem legenda"}</p><div className="mt-4 grid grid-cols-3 gap-2"><Mini label="Alcance" value={number.format(item.reach)} /><Mini label="Impressões" value={number.format(item.impressions)} /><Mini label="Interações" value={number.format(item.interactions)} /><Mini label="Curtidas" value={number.format(item.likes)} /><Mini label="Comentários" value={number.format(item.comments)} /><Mini label="Salvos" value={number.format(item.saves)} /><Mini label="Compart." value={number.format(item.shares)} /><Mini label="Engaj." value={`${Number(item.engagement_rate).toFixed(1)}%`} /><Mini label="Views" value={number.format(Number(item.video_views || 0))} /></div>{item.video_retention_rate || item.average_watch_time ? <div className="mt-2 grid grid-cols-2 gap-2"><Mini label="Retenção" value={item.video_retention_rate ? `${Number(item.video_retention_rate).toFixed(1)}%` : "—"} /><Mini label="Tempo médio" value={item.average_watch_time ? `${Number(item.average_watch_time).toFixed(1)} s` : "—"} /></div> : null}{item.permalink && <Button asChild variant="outline" size="sm" className="mt-3 w-full"><a href={item.permalink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Abrir post <ExternalLink className="ml-2 h-3 w-3" /></a></Button>}</div></article>)}{!media.length && <Empty text="Nenhum conteúdo publicado no período selecionado." />}</div></TabsContent>
            <TabsContent value="audience"><section className="gd-panel p-6"><h3 className="font-black">Crescimento da audiência</h3><p className="mt-1 text-xs text-muted-foreground">Ganhos e perdas são somados a partir da série diária oficial. Demografia e retenção só aparecem quando a Meta entrega a métrica para a conta.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Mini label="Seguidores atuais" value={number.format(selected?.followers_count ?? 0)} /><Mini label="Ganhos no período" value={`+${number.format(followersGained)}`} /><Mini label="Perdas no período" value={`-${number.format(followersLost)}`} /><Mini label="Variação líquida" value={number.format(followersGained - followersLost)} /><Mini label="Publicações" value={number.format(selected?.media_count ?? 0)} /></div></section></TabsContent>
            <TabsContent value="recommendations"><section className="grid gap-3 md:grid-cols-2"><Recommendation title="Repita o que gera intenção" text={best ? `O conteúdo líder concentra ${number.format(best.saves + best.shares)} salvamentos e compartilhamentos. Use o mesmo tema em novos formatos.` : "Sincronize conteúdos para identificar temas com maior intenção."} /><Recommendation title="Proteção contra mídia expirada" text="URLs temporárias são atualizadas em cada sincronização e a interface exibe fallback quando a CDN da Meta expira uma prévia." /><Recommendation title="Orgânico ≠ pago" text="Alcance e interação deste módulo nunca são somados às métricas de campanha do Meta Ads." /><Recommendation title="Decisão com contexto" text="Compare pelo menos sete dias e volume suficiente antes de concluir que um formato ou horário venceu." /></section></TabsContent>
          </Tabs>
          <SocialMediaDetailSheet media={selectedMedia} onOpenChange={(open) => { if (!open) setSelectedMedia(null); }} demoMode={demoMode} />
        </>
      ) : null}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="gd-panel gd-metric-card group cursor-default p-4 transition hover:-translate-y-0.5 hover:border-primary/30" title={metricDescription(label)}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-muted-foreground">{label}</p><strong className="mt-3 block text-2xl font-black tabular-nums">{value}</strong></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div></article>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-muted/20 p-3"><span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><b className="mt-1 block text-sm tabular-nums">{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{text}</div>; }
function Recommendation({ title, text }: { title: string; text: string }) { return <article className="gd-panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><b className="text-sm">{title}</b></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></article>; }

function SocialMediaDetailSheet({ media, onOpenChange, demoMode }: { media: SocialMedia | null; onOpenChange: (open: boolean) => void; demoMode: boolean }) {
  if (!media) return null;

  const engagement = Number(media.engagement_rate || 0);
  const savesAndShares = Number(media.saves || 0) + Number(media.shares || 0);
  const diagnosis = engagement >= 8
    ? "Este conteúdo gerou engajamento acima de 8%. Avalie repetir o tema, formato e gancho em uma nova publicação."
    : savesAndShares > Number(media.comments || 0) * 3
      ? "Salvamentos e compartilhamentos são o principal sinal deste conteúdo. O tema parece útil para a audiência e pode render uma sequência."
      : "Use esta leitura junto ao período e ao volume de alcance antes de decidir por mudanças no conteúdo.";

  return <Sheet open={!!media} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto border-l border-primary/15 bg-background p-5 sm:max-w-xl">
      <SheetHeader className="pr-8">
        <SheetTitle className="text-xl font-black">Detalhes da publicação</SheetTitle>
        <SheetDescription>{demoMode ? "Demonstração — dados não oficiais" : "Métricas oficiais disponíveis para este conteúdo"}</SheetDescription>
      </SheetHeader>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-muted/20">
        <div className="aspect-video bg-muted"><MediaPreview media={media} /></div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-primary">
            <span className="rounded-full bg-primary/10 px-2 py-1">{media.media_type}</span>
            <span className="text-muted-foreground">{media.published_at ? format(new Date(media.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Data indisponível"}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{media.caption || "Esta publicação não possui legenda."}</p>
          {media.permalink && <Button asChild variant="outline" size="sm" className="mt-4"><a href={media.permalink} target="_blank" rel="noreferrer">Abrir publicação <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-baseline justify-between gap-3"><h3 className="font-black">Desempenho</h3><span className="text-xs text-muted-foreground">Por publicação</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Mini label="Alcance" value={number.format(Number(media.reach || 0))} />
          <Mini label="Impressões" value={number.format(Number(media.impressions || 0))} />
          <Mini label="Interações" value={number.format(Number(media.interactions || 0))} />
          <Mini label="Engajamento" value={`${engagement.toFixed(2).replace(".", ",")}%`} />
          <Mini label="Curtidas" value={number.format(Number(media.likes || 0))} />
          <Mini label="Comentários" value={number.format(Number(media.comments || 0))} />
          <Mini label="Salvamentos" value={number.format(Number(media.saves || 0))} />
          <Mini label="Compartilhamentos" value={number.format(Number(media.shares || 0))} />
          <Mini label="Visualizações" value={media.video_views == null ? "Não disponível" : number.format(Number(media.video_views))} />
        </div>
      </section>

      {media.video_views != null || media.average_watch_time != null || media.video_retention_rate != null ? <section className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
        <h3 className="font-black">Leitura do vídeo</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Mini label="Visualizações" value={number.format(Number(media.video_views || 0))} />
          <Mini label="Retenção" value={media.video_retention_rate == null ? "Não disponível" : `${Number(media.video_retention_rate).toFixed(1).replace(".", ",")}%`} />
          <Mini label="Tempo médio" value={media.average_watch_time == null ? "Não disponível" : `${Number(media.average_watch_time).toFixed(1).replace(".", ",")} s`} />
        </div>
      </section> : null}

      <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-black">Leitura Growdash</h3></div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{diagnosis}</p>
      </section>
    </SheetContent>
  </Sheet>;
}
