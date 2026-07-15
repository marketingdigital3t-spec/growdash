/* New storage tables are queried before generated Supabase types are refreshed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Cloud, Download, ExternalLink, File, FileImage, HardDrive, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
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
    <PageHeading eyebrow="Gestão de dados" title="Armazenamento" description="Arquivos da plataforma centralizados por workspace, unidade, origem e plano." actions={<><input ref={fileInput} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} /><Button onClick={() => fileInput.current?.click()} disabled={upload.isPending || quota >= 100}><Upload className="mr-2 h-4 w-4" />{upload.isPending ? "Enviando…" : "Enviar arquivo"}</Button></>} />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StorageKpi icon={<HardDrive />} label="Espaço usado" value={formatBytes(used)} note={`${quota.toFixed(1)}% de ${formatBytes(limit)}`} />
      <StorageKpi icon={<Archive />} label="Arquivos gerenciados" value={String(managed.length)} note="no bucket privado" />
      <StorageKpi icon={<ExternalLink />} label="Referências externas" value={String(legacyRefs.length + files.filter((item) => item.external_url).length)} note="não ocupam a quota" />
      <StorageKpi icon={<ShieldCheck />} label="Plano" value={(currentPlan as any)?.name ?? "Starter"} note={subscription?.status === "configuring" ? "migration necessária" : subscription?.status ?? "ativo"} />
    </div>

    <section className="gd-panel p-5"><div className="flex items-center justify-between gap-3"><div><b>Quota do workspace</b><p className="text-xs text-muted-foreground">Alertas progressivos em 70%, 85% e 100%.</p></div><b className={quota >= 85 ? "text-rose-500" : quota >= 70 ? "text-amber-500" : "text-primary"}>{formatBytes(used)} / {formatBytes(limit)}</b></div><Progress value={quota} className="mt-4 h-2" /></section>

    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="files">Arquivos</TabsTrigger><TabsTrigger value="sources">Fontes</TabsTrigger><TabsTrigger value="limits">Limites</TabsTrigger></TabsList>
      <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="gd-panel p-5"><h2 className="font-black">Distribuição conhecida</h2><p className="text-xs text-muted-foreground">Somente bytes realmente armazenados entram na quota.</p><div className="mt-5 space-y-4">{allSources.map(([key, value]) => <div key={key}><div className="mb-1 flex justify-between text-xs"><b>{sourceLabel(key)}</b><span>{value.count} item(ns) · {formatBytes(value.bytes)}</span></div><Progress value={used ? value.bytes / used * 100 : 0} className="h-1.5" /></div>)}{!allSources.length && <EmptyStorage schemaReady={UUID.test(workspace?.id ?? "")} />}</div></section><section className="gd-panel p-5"><Cloud className="h-8 w-8 text-primary" /><h2 className="mt-4 font-black">Catálogo unificado</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Novos uploads são privados, catalogados e vinculados à unidade. Avatares e criativos existentes aparecem como referências até a migração assistida.</p><p className="mt-5 text-[10px] text-muted-foreground">Última leitura: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString("pt-BR") : "aguardando"}</p></section></TabsContent>
      <TabsContent value="files" className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arquivo" className="pl-9" /></div><select value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todas as fontes</option>{allSources.map(([key]) => <option key={key} value={key}>{sourceLabel(key)}</option>)}</select></div><section className="gd-panel overflow-hidden"><div className="divide-y divide-border">{filtered.map((item) => <div key={item.id} className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{item.mime_type?.startsWith("image/") ? <FileImage className="h-5 w-5" /> : <File className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.original_name}</b><p className="text-[10px] text-muted-foreground">{sourceLabel(item.source)} · {item.module} · {formatBytes(Number(item.size_bytes || 0))} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><Button variant="ghost" size="icon" onClick={() => downloadFile(item)} title="Baixar"><Download className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteFile(item)} title="Mover para lixeira"><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}{!filtered.length && <div className="p-10 text-center text-xs text-muted-foreground">{isLoading ? "Carregando…" : "Nenhum arquivo encontrado."}</div>}</div></section></TabsContent>
      <TabsContent value="sources"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{["upload","avatar","meta","finance","automation","crm","report","import"].map((key) => { const value = allSources.find(([sourceKey]) => sourceKey === key)?.[1] ?? { count: 0, bytes: 0 }; return <div className="gd-panel p-5" key={key}><b>{sourceLabel(key)}</b><p className="mt-4 text-2xl font-black">{value.count}</p><p className="text-xs text-muted-foreground">{formatBytes(value.bytes)} administrados</p></div>; })}</section></TabsContent>
      <TabsContent value="limits"><section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Limites por plano</h2><p className="text-xs text-muted-foreground">A quota é do workspace e novos uploads param em 100%.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">{plans.map((plan: any) => <div key={plan.code} className={`rounded-xl border p-4 ${plan.code === subscription?.plan_code ? "border-primary bg-primary/5" : "border-border"}`}><b>{plan.name}</b><p className="mt-3 text-xl font-black">{formatBytes(Number(plan.entitlements?.storage_bytes || DEFAULT_LIMIT))}</p><p className="text-[10px] text-muted-foreground">por workspace</p></div>)}</div></section></TabsContent>
    </Tabs>
  </div>;
}

function StorageKpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <div className="gd-panel p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span><span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span></div><p className="mt-4 text-2xl font-black">{value}</p><p className="text-[10px] text-muted-foreground">{note}</p></div>; }
function EmptyStorage({ schemaReady }: { schemaReady: boolean }) { return <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{schemaReady ? "Nenhum arquivo catalogado ainda." : "A migration de workspace/armazenamento precisa ser aplicada para ativar uploads."}</div>; }
function formatBytes(value: number) { if (!value) return "0 B"; const units = ["B","KB","MB","GB","TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toLocaleString("pt-BR", { maximumFractionDigits: index > 2 ? 1 : 2 })} ${units[index]}`; }
function sourceLabel(value: string) { return ({ upload: "Uploads", avatar: "Avatares", meta: "Criativos Meta", finance: "Financeiro", automation: "Automações", crm: "CRM", report: "Relatórios", import: "Importações", external: "Externo" } as Record<string,string>)[value] ?? value; }
