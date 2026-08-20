/* New storage tables are queried before generated Supabase types are refreshed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronRight, Cloud, Database, Download, ExternalLink, File, FileImage, HardDrive, Image, Search, ShieldCheck, Trash2, Upload, UsersRound, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { usePlans, useWorkspace, useWorkspaceSubscription } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeading } from "./shared";

interface WorkspaceFile {
  id: string;
  bucket_id: string | null;
  object_path: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  module: string;
  source: string;
  external_url: string | null;
  status: string;
  created_at: string;
}
type DataInventory = { key: string; label: string; description: string; count: number; storage: "files" | "database"; icon: "crm" | "lead" | "traffic" | "creative" | "sales" | "social" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 5 * 1024 ** 3;

function pendingSchema(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /workspace_files|schema cache|does not exist/i.test(error.message ?? ""));
}

export default function StoragePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: workspace } = useWorkspace();
  const { data: plans = [] } = usePlans();
  const { data: subscription } = useWorkspaceSubscription(workspace?.id);
  const { businessUnitId } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");

  const { data: files = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["workspace-files", workspace?.id, businessUnitId],
    enabled: !!workspace?.id,
    queryFn: async (): Promise<WorkspaceFile[]> => {
      if (!UUID.test(workspace!.id)) return [];
      let request = (supabase as any).from("workspace_files").select("id,bucket_id,object_path,original_name,mime_type,size_bytes,module,source,external_url,status,created_at").eq("workspace_id", workspace!.id).neq("status", "deleted").order("created_at", { ascending: false }).limit(1000);
      if (businessUnitId && UUID.test(businessUnitId)) request = request.eq("business_unit_id", businessUnitId);
      const { data, error } = await request;
      if (error) {
        if (pendingSchema(error)) return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const { data: legacyRefs = [] } = useQuery({
    queryKey: ["storage-external-references", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const refs: Array<{ id: string; name: string; source: string; url: string }> = [];
      const [{ data: profile }, { data: ads }] = await Promise.all([
        (supabase as any).from("profiles").select("avatar_url").eq("user_id", user!.id).maybeSingle(),
        (supabase as any).from("ads").select("id,name,thumbnail_url").not("thumbnail_url", "is", null).limit(500),
      ]);
      if (profile?.avatar_url) refs.push({ id: "avatar", name: "Foto de perfil", source: "avatar", url: profile.avatar_url });
      for (const ad of ads ?? []) if (ad.thumbnail_url) refs.push({ id: `ad-${ad.id}`, name: ad.name || "Criativo Meta", source: "meta", url: ad.thumbnail_url });
      return refs;
    },
  });

  const { data: dataInventory = [], isLoading: loadingInventory, dataUpdatedAt: inventoryUpdatedAt, refetch: refetchInventory, isFetching: refreshingInventory } = useQuery({
    queryKey: ["storage-data-inventory", workspace?.id, businessUnitId, user?.id],
    enabled: !!workspace?.id && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<DataInventory[]> => {
      const workspaceScoped = UUID.test(workspace!.id);
      const unitScoped = businessUnitId && UUID.test(businessUnitId);
      const count = async (table: string, applyScope: (query: any) => any) => {
        let request = (supabase as any).from(table).select("id", { count: "exact", head: true });
        request = applyScope(request);
        const { count: total, error } = await request;
        if (error) {
          if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) return 0;
          throw error;
        }
        return total ?? 0;
      };
      const byAccount = (query: any) => user?.id ? query.eq("user_id", user.id) : query;
      const byWorkspace = (query: any) => workspaceScoped ? query.eq("workspace_id", workspace!.id) : byAccount(query);
      const scopedUnit = (query: any) => unitScoped ? query.eq("business_unit_id", businessUnitId) : byWorkspace(query);
      const [deals, leads, insights, campaigns, ads, sales, social] = [
        await count("rd_deals", byAccount),
        await count("meta_leads", byAccount),
        await count("insights", byAccount),
        await count("campaigns", byAccount),
        await count("ads", byAccount),
        await count("sales", scopedUnit),
        await count("social_media", byAccount),
      ];
      return [
        { key: "crm", label: "CRM e contatos", description: "Negociações sincronizadas do RD Station", count: deals, storage: "database", icon: "crm" },
        { key: "leads", label: "Leads", description: "Leads recebidos pelas integrações Meta", count: leads, storage: "database", icon: "lead" },
        { key: "traffic", label: "Tráfego pago", description: "Linhas de desempenho, campanhas e anúncios", count: insights + campaigns + ads, storage: "database", icon: "traffic" },
        { key: "campaigns", label: "Criativos de anúncios", description: "Anúncios com referências de criativos", count: ads, storage: "database", icon: "creative" },
        { key: "sales", label: "Vendas", description: "Vendas e receita canônica da unidade", count: sales, storage: "database", icon: "sales" },
        { key: "social", label: "Mídia social", description: "Posts e métricas sociais sincronizadas", count: social, storage: "database", icon: "social" },
      ];
    },
  });

  const currentPlan = plans.find((plan: any) => plan.code === subscription?.plan_code) ?? plans[0];
  const limit = Number((currentPlan as any)?.entitlements?.storage_bytes || DEFAULT_LIMIT);
  const managed = files.filter((item) => item.bucket_id && item.object_path && item.status === "active");
  const used = managed.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
  const quota = limit > 0 ? Math.min(100, used / limit * 100) : 0;
  const allSources = useMemo(() => {
    const values = new Map<string, { count: number; bytes: number }>();
    for (const item of files) {
      const current = values.get(item.source) ?? { count: 0, bytes: 0 };
      values.set(item.source, { count: current.count + 1, bytes: current.bytes + Number(item.size_bytes || 0) });
    }
    for (const item of legacyRefs) {
      const current = values.get(item.source) ?? { count: 0, bytes: 0 };
      values.set(item.source, { count: current.count + 1, bytes: current.bytes });
    }
    return Array.from(values.entries()).sort((a, b) => b[1].bytes - a[1].bytes || b[1].count - a[1].count);
  }, [files, legacyRefs]);
  const filtered = files.filter((item) => (source === "all" || item.source === source) && item.original_name.toLowerCase().includes(search.toLowerCase()));
  const databaseRecords = dataInventory.reduce((sum, item) => sum + item.count, 0);
  const mediaFiles = managed.filter((item) => item.mime_type?.startsWith("image/") || item.mime_type?.startsWith("video/") || item.mime_type?.startsWith("audio/") || item.source === "meta");
  const storageCategories = useMemo(() => {
    const categoryMap = new Map<string, { label: string; color: string; bytes: number; count: number }>([
      ["images", { label: "Fotos e imagens", color: "#0a84ff", bytes: 0, count: 0 }],
      ["videos", { label: "Vídeos", color: "#bf5af2", bytes: 0, count: 0 }],
      ["documents", { label: "Documentos", color: "#ff9f0a", bytes: 0, count: 0 }],
      ["reports", { label: "Relatórios", color: "#64d2ff", bytes: 0, count: 0 }],
      ["other", { label: "Outros", color: "#8e8e93", bytes: 0, count: 0 }],
    ]);
    for (const item of managed) {
      const kind = item.mime_type?.startsWith("image/") ? "images" : item.mime_type?.startsWith("video/") ? "videos" : item.source === "report" ? "reports" : /pdf|document|sheet|text|csv|zip/i.test(item.mime_type || item.original_name) ? "documents" : "other";
      const current = categoryMap.get(kind)!;
      current.bytes += Number(item.size_bytes || 0);
      current.count += 1;
    }
    return Array.from(categoryMap.entries()).map(([key, value]) => ({ key, ...value })).filter((item) => item.bytes > 0 || item.key === "other");
  }, [managed]);
  const available = Math.max(limit - used, 0);

  const upload = useMutation({
    mutationFn: async (file: globalThis.File) => {
      if (!workspace || !user || !UUID.test(workspace.id) || !businessUnitId || !UUID.test(businessUnitId)) throw new Error("Aplique as migrations do workspace antes de enviar arquivos.");
      if (used + file.size > limit) throw new Error("O upload ultrapassa o limite do plano.");
      const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
      const path = `${workspace.id}/${businessUnitId}/uploads/${crypto.randomUUID()}-${safe}`;
      const { error: storageError } = await supabase.storage.from("workspace-files").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (storageError) throw storageError;
      const { error: registryError } = await (supabase as any).from("workspace_files").insert({ workspace_id: workspace.id, business_unit_id: businessUnitId, owner_id: user.id, bucket_id: "workspace-files", object_path: path, original_name: file.name, mime_type: file.type || null, size_bytes: file.size, module: "uploads", source: "upload", status: "active" });
      if (registryError) {
        await supabase.storage.from("workspace-files").remove([path]);
        throw registryError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-files"] }); toast({ title: "Arquivo armazenado" }); },
    onError: (error: Error) => toast({ title: "Upload não concluído", description: error.message, variant: "destructive" }),
  });

  async function downloadFile(item: WorkspaceFile) {
    if (item.external_url) { window.open(item.external_url, "_blank", "noopener,noreferrer"); return; }
    if (!item.bucket_id || !item.object_path) return;
    const { data, error } = await supabase.storage.from(item.bucket_id).createSignedUrl(item.object_path, 60);
    if (error) toast({ title: "Download indisponível", description: error.message, variant: "destructive" });
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(item: WorkspaceFile) {
    if (!window.confirm(`Mover “${item.original_name}” para a lixeira?`)) return;
    if (item.bucket_id && item.object_path) {
      const { error } = await supabase.storage.from(item.bucket_id).remove([item.object_path]);
      if (error) { toast({ title: "Não foi possível remover", description: error.message, variant: "destructive" }); return; }
    }
    const { error } = await (supabase as any).from("workspace_files").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", item.id);
    if (error) toast({ title: "Registro não removido", description: error.message, variant: "destructive" });
    else { queryClient.invalidateQueries({ queryKey: ["workspace-files"] }); toast({ title: "Arquivo movido para a lixeira" }); }
  }

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <PageHeading eyebrow="Gestão de dados" title="Armazenamento" description="Visibilidade do Storage e do volume lógico do banco por workspace e unidade." actions={<><input ref={fileInput} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} /><Button variant="outline" onClick={() => void refetchInventory()} disabled={refreshingInventory}>Atualizar leitura</Button><Button onClick={() => fileInput.current?.click()} disabled={upload.isPending || quota >= 100}><Upload className="mr-2 h-4 w-4" />{upload.isPending ? "Enviando…" : "Enviar arquivo"}</Button></>} />

    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(10,132,255,.22),transparent_35%),linear-gradient(145deg,#25252a,#111114_55%,#08080a)] p-5 text-white shadow-[0_22px_60px_-32px_rgba(0,0,0,.9)] sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">Armazenamento Growdash</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{formatBytes(used)} de {formatBytes(limit)} usados</h2><p className="mt-2 text-sm text-white/55">{formatBytes(available)} disponíveis para arquivos, imagens, vídeos e relatórios.</p><div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/12 ring-1 ring-white/10" aria-label={`${quota.toFixed(1)}% do armazenamento utilizado`}>{storageCategories.map((item) => <span key={item.key} style={{ width: `${limit ? item.bytes / limit * 100 : 0}%`, background: item.color }} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-500" />)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{storageCategories.filter((item) => item.bytes > 0).map((item) => <span key={item.key} className="inline-flex items-center gap-2 text-xs text-white/70"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.label} <b className="text-white">{formatBytes(item.bytes)}</b></span>)}{!used && <span className="text-xs text-white/55">Nenhum arquivo catalogado ainda.</span>}</div></div><div className="rounded-3xl border border-white/10 bg-white/[.07] p-5 backdrop-blur-xl"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#64d2ff]"><HardDrive className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${quota >= 85 ? "bg-rose-400/15 text-rose-200" : quota >= 70 ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{quota >= 85 ? "Atenção" : quota >= 70 ? "Acompanhar" : "Em dia"}</span></div><p className="mt-5 text-sm font-bold">Plano {(currentPlan as any)?.name ?? "Starter"}</p><p className="mt-1 text-xs leading-5 text-white/55">Avisos preventivos são ativados em 70%, 85% e 100% da capacidade.</p><button type="button" onClick={() => void refetchInventory()} className="mt-5 flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-xs font-bold transition hover:bg-white/15">Atualizar leitura <ChevronRight className="h-4 w-4" /></button></div></div>
    </section>

    <div className="gd-auto-grid gap-3">
      <StorageKpi icon={<HardDrive />} label="Espaço usado" value={formatBytes(used)} note={`${quota.toFixed(1)}% de ${formatBytes(limit)}`} />
      <StorageKpi icon={<Archive />} label="Arquivos gerenciados" value={String(managed.length)} note="no bucket privado" />
      <StorageKpi icon={<Database />} label="Registros do banco" value={numberFormat(databaseRecords)} note="CRM, leads, tráfego e vendas" />
      <StorageKpi icon={<Image />} label="Mídia catalogada" value={formatBytes(mediaFiles.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0))} note={`${mediaFiles.length} imagem(ns), vídeo(s) ou áudio(s)`} />
      <StorageKpi icon={<ExternalLink />} label="Referências externas" value={String(legacyRefs.length + files.filter((item) => item.external_url).length)} note="não ocupam a quota" />
      <StorageKpi icon={<ShieldCheck />} label="Plano" value={(currentPlan as any)?.name ?? "Starter"} note={subscription?.status === "configuring" ? "migration necessária" : subscription?.status ?? "ativo"} />
    </div>

    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="platform">Dados da plataforma</TabsTrigger><TabsTrigger value="files">Arquivos</TabsTrigger><TabsTrigger value="sources">Fontes</TabsTrigger><TabsTrigger value="limits">Limites</TabsTrigger></TabsList>
      <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-black">Por categoria</h2><p className="mt-1 text-xs text-muted-foreground">Organizado como o armazenamento do iPhone, usando os bytes reais dos arquivos catalogados.</p></div><div className="divide-y divide-border">{storageCategories.map((item) => <div key={item.key} className="flex items-center gap-3 px-5 py-4"><i className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color }} /><div className="min-w-0 grow"><b className="text-sm">{item.label}</b><p className="mt-0.5 text-[10px] text-muted-foreground">{item.count} item(ns)</p></div><b className="text-sm">{formatBytes(item.bytes)}</b><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>)}{!allSources.length && <EmptyStorage schemaReady={UUID.test(workspace?.id ?? "")} />}</div></section><section className="gd-panel p-5"><Cloud className="h-8 w-8 text-primary" /><h2 className="mt-4 font-black">Controle de capacidade</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">A quota mede arquivos do Supabase Storage. Dados da plataforma contabiliza registros de CRM, leads, tráfego e vendas; não mistura registros com espaço físico.</p><p className="mt-5 text-[10px] text-muted-foreground">Arquivos: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString("pt-BR") : "aguardando"} · Dados: {inventoryUpdatedAt ? new Date(inventoryUpdatedAt).toLocaleString("pt-BR") : "aguardando"}</p></section></TabsContent>
      <TabsContent value="platform" className="space-y-4"><section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Inventário de dados da plataforma</h2><p className="mt-1 text-xs text-muted-foreground">Contagem atual de registros acessíveis pelo workspace. São dados reais de banco, não estimativa de bytes.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{dataInventory.map((item) => <DataInventoryCard key={item.key} item={item} />)}{loadingInventory && <p className="col-span-full py-8 text-center text-xs text-muted-foreground">Atualizando inventário…</p>}</div></section><section className="rounded-2xl border border-amber-500/25 bg-amber-500/[.06] p-4 text-xs leading-5 text-muted-foreground"><b className="text-amber-600">Importante:</b> o navegador consegue medir arquivos e contar os registros que este workspace acessa. Para o consumo físico total do banco, backups, banda e capacidade do projeto, acompanhe também <b>Supabase Dashboard → Usage</b>; essas métricas são administrativas e não devem ficar expostas para usuários comuns.</section></TabsContent>
      <TabsContent value="files" className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arquivo" className="pl-9" /></div><select value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todas as fontes</option>{allSources.map(([key]) => <option key={key} value={key}>{sourceLabel(key)}</option>)}</select></div><section className="gd-panel overflow-hidden"><div className="divide-y divide-border">{filtered.map((item) => <div key={item.id} className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{item.mime_type?.startsWith("image/") ? <FileImage className="h-5 w-5" /> : <File className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.original_name}</b><p className="text-[10px] text-muted-foreground">{sourceLabel(item.source)} · {item.module} · {formatBytes(Number(item.size_bytes || 0))} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><Button variant="ghost" size="icon" onClick={() => downloadFile(item)} title="Baixar"><Download className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteFile(item)} title="Mover para lixeira"><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}{!filtered.length && <div className="p-10 text-center text-xs text-muted-foreground">{isLoading ? "Carregando…" : "Nenhum arquivo encontrado."}</div>}</div></section></TabsContent>
      <TabsContent value="sources"><section className="gd-auto-grid gap-3">{["upload","avatar","meta","finance","automation","crm","report","import"].map((key) => { const value = allSources.find(([sourceKey]) => sourceKey === key)?.[1] ?? { count: 0, bytes: 0 }; return <div className="gd-panel p-5" key={key}><b>{sourceLabel(key)}</b><p className="mt-4 text-2xl font-black">{value.count}</p><p className="text-xs text-muted-foreground">{formatBytes(value.bytes)} administrados</p></div>; })}</section></TabsContent>
      <TabsContent value="limits"><section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Limites por plano</h2><p className="text-xs text-muted-foreground">A quota é do workspace e novos uploads param em 100%.</p></div><div className="gd-auto-grid gap-3 p-5">{plans.map((plan: any) => <div key={plan.code} className={`min-w-0 rounded-xl border p-4 ${plan.code === subscription?.plan_code ? "border-primary bg-primary/5" : "border-border"}`}><b>{plan.name}</b><p className="mt-3 truncate text-xl font-black" title={formatBytes(Number(plan.entitlements?.storage_bytes || DEFAULT_LIMIT))}>{formatBytes(Number(plan.entitlements?.storage_bytes || DEFAULT_LIMIT))}</p><p className="text-[10px] text-muted-foreground">por workspace</p></div>)}</div></section></TabsContent>
    </Tabs>
  </div>;
}

function StorageKpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <div className="gd-panel p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span><span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span></div><p className="mt-4 text-2xl font-black">{value}</p><p className="text-[10px] text-muted-foreground">{note}</p></div>; }
function DataInventoryCard({ item }: { item: DataInventory }) { const icons = { crm: <UsersRound />, lead: <UsersRound />, traffic: <Database />, creative: <Image />, sales: <Database />, social: <Video /> }; return <article className="rounded-2xl border border-border bg-background/35 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icons[item.icon]}</span><p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-black">{numberFormat(item.count)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></article>; }
function EmptyStorage({ schemaReady }: { schemaReady: boolean }) { return <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{schemaReady ? "Nenhum arquivo catalogado ainda." : "A migration de workspace/armazenamento precisa ser aplicada para ativar uploads."}</div>; }
function formatBytes(value: number) { if (!value) return "0 B"; const units = ["B","KB","MB","GB","TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toLocaleString("pt-BR", { maximumFractionDigits: index > 2 ? 1 : 2 })} ${units[index]}`; }
function numberFormat(value: number) { return new Intl.NumberFormat("pt-BR").format(value); }
function sourceLabel(value: string) { return ({ upload: "Uploads", avatar: "Avatares", meta: "Criativos Meta", finance: "Financeiro", automation: "Automações", crm: "CRM", report: "Relatórios", import: "Importações", external: "Externo" } as Record<string,string>)[value] ?? value; }
