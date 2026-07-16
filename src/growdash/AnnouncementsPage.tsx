/* platform_announcements receives new fields through an additive migration. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Eye, ImagePlus, Megaphone, Power, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DestructiveConfirmationDialog } from "@/components/DestructiveConfirmationDialog";
import { PageHeading } from "./shared";
import type { PlatformAnnouncement } from "@/lib/platformAnnouncements";

const PAGE_TARGETS = [
  ["/", "Dashboard"], ["/campanhas", "Campanhas"], ["/crm", "CRM"], ["/comercial", "Comercial"],
  ["/analise-de-funis", "Análise de Funis"], ["/growdash-flow", "Growdash Flow"], ["/midia-social", "Mídia Social"],
  ["/agenda-turmas", "Agenda & Turmas"], ["/financeiro", "Financeiro"], ["/armazenamento", "Armazenamento"],
  ["/integracoes", "Integrações"], ["/usuarios", "Usuários"], ["/configuracoes", "Configurações"],
] as const;

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function schemaPending(error: any) {
  return error?.code === "42703" || /target_paths|starts_at|ends_at|priority|schema cache/i.test(error?.message || "");
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [imageData, setImageData] = useState("");
  const [targetPaths, setTargetPaths] = useState<string[]>(["*"]);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86_400_000)));
  const [linkUrl, setLinkUrl] = useState("");
  const [priority, setPriority] = useState(0);
  const [dismissible, setDismissible] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PlatformAnnouncement | null>(null);

  const { data: announcements = [], isLoading, error } = useQuery({
    queryKey: ["platform-announcements-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("platform_announcements").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlatformAnnouncement[];
    },
  });

  const activeNow = useMemo(() => announcements.filter((item) => item.active && (!item.ends_at || new Date(item.ends_at) > new Date())).length, [announcements]);

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      if (!imageData) throw new Error("Selecione uma imagem para o anúncio.");
      if (!title.trim()) throw new Error("Informe um título interno.");
      if (!targetPaths.length) throw new Error("Selecione ao menos uma tela.");
      if (endsAt && new Date(endsAt) <= new Date(startsAt)) throw new Error("O término deve ser posterior ao início.");
      const payload = {
        title: title.trim(), image_data_url: imageData, alt: alt.trim() || title.trim(), active: true,
        target_paths: targetPaths, starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        dismissible, link_url: linkUrl.trim() || null, priority, created_by: user.id,
      };
      const { error } = await (supabase as any).from("platform_announcements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["platform-announcements-admin"] });
      setTitle(""); setAlt(""); setImageData(""); setLinkUrl(""); setPriority(0);
      toast({ title: "Anúncio publicado", description: "A exibição seguirá as telas e o período configurados." });
    },
    onError: (currentError: any) => toast({ title: schemaPending(currentError) ? "Migration necessária" : "Não foi possível publicar", description: schemaPending(currentError) ? "Aplique a migration 20260716113000_expand_platform_announcements.sql no Supabase." : currentError.message, variant: "destructive" }),
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("platform_announcements").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-announcements"] }); queryClient.invalidateQueries({ queryKey: ["platform-announcements-admin"] }); },
    onError: (currentError: Error) => toast({ title: "Status não alterado", description: currentError.message, variant: "destructive" }),
  });

  const removeAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("platform_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setDeleteTarget(null); queryClient.invalidateQueries({ queryKey: ["platform-announcements"] }); queryClient.invalidateQueries({ queryKey: ["platform-announcements-admin"] }); toast({ title: "Anúncio excluído" }); },
    onError: (currentError: Error) => toast({ title: "Anúncio não excluído", description: currentError.message, variant: "destructive" }),
  });

  function selectImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Arquivo inválido", description: "Envie uma imagem PNG, JPG, WEBP ou GIF.", variant: "destructive" }); return; }
    if (file.size > 4 * 1024 * 1024) { toast({ title: "Imagem muito grande", description: "O limite por anúncio é 4 MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function toggleTarget(path: string, checked: boolean) {
    if (path === "*") { setTargetPaths(checked ? ["*"] : []); return; }
    setTargetPaths((current) => checked ? [...current.filter((item) => item !== "*"), path] : current.filter((item) => item !== path));
  }

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <PageHeading eyebrow="Comunicação global" title="Anúncios da plataforma" description="Publique banners no topo das telas escolhidas, com período, prioridade e controle de descarte." />

    <div className="gd-auto-grid gap-3">
      <Kpi label="Cadastrados" value={String(announcements.length)} icon={<Megaphone />} />
      <Kpi label="Ativos/agendados" value={String(activeNow)} icon={<CalendarClock />} />
      <Kpi label="Telas disponíveis" value={String(PAGE_TARGETS.length)} icon={<Eye />} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <section className="gd-panel space-y-5 p-5">
        <div><h2 className="font-black">Novo anúncio</h2><p className="text-xs text-muted-foreground">A imagem é exibida responsivamente sem ultrapassar a área de conteúdo.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Título interno"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Campanha de lançamento" /></Field><Field label="Texto alternativo"><Input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Descrição acessível da imagem" /></Field></div>
        <div><Label>Imagem do banner</Label><input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => { selectImage(event.target.files?.[0]); event.target.value = ""; }} /><button type="button" onClick={() => fileInput.current?.click()} className="mt-2 grid min-h-40 w-full place-items-center overflow-hidden rounded-xl border border-dashed border-primary/35 bg-primary/[.025] text-sm text-muted-foreground transition hover:bg-primary/5">{imageData ? <img src={imageData} alt={alt || title || "Pré-visualização"} className="max-h-56 w-full object-contain" /> : <span className="flex flex-col items-center gap-2"><ImagePlus className="h-7 w-7 text-primary" />Selecionar imagem (até 4 MB)</span>}</button></div>
        <div><Label>Telas de exibição</Label><div className="mt-2 grid gap-2 sm:grid-cols-2"><TargetOption label="Todas as telas" checked={targetPaths.includes("*")} onChange={(checked) => toggleTarget("*", checked)} />{PAGE_TARGETS.map(([path, label]) => <TargetOption key={path} label={label} checked={targetPaths.includes(path)} disabled={targetPaths.includes("*")} onChange={(checked) => toggleTarget(path, checked)} />)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Início"><Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field><Field label="Término"><Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]"><Field label="Link opcional"><Input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." /></Field><Field label="Prioridade"><Input type="number" min={0} max={100} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></Field></div>
        <TargetOption label="Permitir que o usuário feche este anúncio" checked={dismissible} onChange={setDismissible} />
        <Button className="w-full" onClick={() => createAnnouncement.mutate()} disabled={createAnnouncement.isPending}>{createAnnouncement.isPending ? "Publicando…" : "Publicar anúncio"}</Button>
      </section>

      <section className="gd-panel overflow-hidden">
        <div className="border-b border-border p-5"><h2 className="font-black">Anúncios cadastrados</h2><p className="text-xs text-muted-foreground">Mais prioridade vence quando dois anúncios atendem à mesma tela e período.</p></div>
        {error && <div className="m-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-xs text-destructive">{schemaPending(error) ? "Aplique a migration de anúncios para ativar o novo módulo." : (error as Error).message}</div>}
        <div className="divide-y divide-border">{announcements.map((item) => <article key={item.id} className="grid gap-4 p-4 sm:grid-cols-[180px_1fr_auto]"><img src={item.image_data_url} alt={item.alt || item.title || "Anúncio"} className="h-24 w-full rounded-lg border border-border bg-muted object-cover" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate">{item.title || item.alt || "Anúncio"}</b><Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Ativo" : "Pausado"}</Badge><Badge variant="outline">prioridade {item.priority || 0}</Badge></div><p className="mt-2 text-[10px] text-muted-foreground">{(item.target_paths?.length ? item.target_paths : ["*"]).map((path) => path === "*" ? "Todas as telas" : PAGE_TARGETS.find(([value]) => value === path)?.[1] || path).join(" · ")}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.starts_at ? new Date(item.starts_at).toLocaleString("pt-BR") : "imediato"} → {item.ends_at ? new Date(item.ends_at).toLocaleString("pt-BR") : "sem término"}</p></div><div className="flex items-start gap-1"><Button variant="ghost" size="icon" title={item.active ? "Pausar" : "Ativar"} onClick={() => updateAnnouncement.mutate({ id: item.id, active: !item.active })}><Power className={item.active ? "text-emerald-500" : "text-muted-foreground"} /></Button><Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleteTarget(item)}><Trash2 className="text-destructive" /></Button></div></article>)}{!announcements.length && !isLoading && !error && <div className="p-12 text-center text-xs text-muted-foreground">Nenhum anúncio cadastrado.</div>}{isLoading && <div className="space-y-3 p-4">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>}</div>
      </section>
    </div>

    <DestructiveConfirmationDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Excluir anúncio?" description="O banner deixará de aparecer imediatamente e esta ação não poderá ser desfeita." confirmation={deleteTarget?.title || "EXCLUIR"} pending={removeAnnouncement.isPending} onConfirm={() => deleteTarget && removeAnnouncement.mutate(deleteTarget.id)} />
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function TargetOption({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) { return <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs"><Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} /><span>{label}</span></label>; }
function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="gd-panel p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span><span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span></div><p className="mt-4 text-2xl font-black">{value}</p></div>; }

