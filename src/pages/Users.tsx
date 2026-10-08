import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMaster } from "@/hooks/useIsMaster";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Users as UsersIcon, KeyRound, Mail, ShieldCheck, FilePenLine, Eye, Search, Copy, Clipboard } from "lucide-react";
import { Navigate } from "react-router-dom";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { DestructiveConfirmationDialog } from "@/components/DestructiveConfirmationDialog";

const PAGES = [
  { key: "can_expert_dashboard", label: "Painel do Expert (somente leitura)" },
  { key: "can_dashboard", label: "Dashboard" },
  { key: "can_crm", label: "CRM" },
  { key: "can_commercial", label: "Comercial" },
  { key: "can_campaigns", label: "Campanhas" },
  { key: "can_funnels", label: "Análise de Funis" },
  { key: "can_flow", label: "Growdash Flow" },
  { key: "can_social_media", label: "Análise de Mídia Social" },
  { key: "can_classes", label: "Datas & Turmas" },
  { key: "can_leads", label: "Leads incompletos" },
  { key: "can_kanban", label: "Kanban" },
  { key: "can_tickets", label: "Chamados" },
  { key: "can_alerts", label: "Alertas" },
  { key: "can_automations", label: "Automações" },
  { key: "can_finance", label: "Financeiro" },
  { key: "can_storage", label: "Armazenamento" },
  { key: "can_brands", label: "Marcas" },
  { key: "can_products", label: "Produtos" },
  { key: "can_integrations", label: "Integrações" },
  { key: "can_meta_connect", label: "Meta Connect" },
  { key: "can_announcements", label: "Anúncios internos" },
  { key: "can_users", label: "Gerenciar usuários" },
  { key: "can_agents", label: "Agentes" },
  { key: "can_settings", label: "Configurações" },
  { key: "can_data_health", label: "Saúde dos Dados" },
] as const;

type PermissionKey = typeof PAGES[number]["key"];
type PermissionState = Record<PermissionKey, boolean>;
type AccessRole = "admin" | "editor" | "viewer" | "financial" | "analyst";
type UserRow = PermissionState & {
  user_id: string;
  name: string;
  email: string;
  role: AccessRole;
  status: string;
  ad_account_ids: string[];
  rd_funnel_ids: string[];
};

const blankPermissions = () => Object.fromEntries(PAGES.map(({ key }) => [key, false])) as PermissionState;
const roleLabels: Record<AccessRole, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
  financial: "Financeiro",
  analyst: "Analista",
};
const roleDescriptions: Record<AccessRole, string> = {
  admin: "Acesso completo, inclusive gestão de usuários e integrações.",
  editor: "Pode consultar e editar os módulos e contas selecionados.",
  viewer: "Acesso de consulta aos módulos e contas selecionados.",
  financial: "Acesso inicial ao Financeiro, Comercial e indicadores definidos.",
  analyst: "Acesso inicial a métricas, tráfego, funis e relatórios.",
};

const ROLE_DEFAULTS: Record<AccessRole, Partial<PermissionState>> = {
  admin: Object.fromEntries(PAGES.map(({ key }) => [key, true])),
  editor: { can_dashboard: true, can_expert_dashboard: true, can_crm: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_flow: true, can_social_media: true, can_classes: true, can_leads: true, can_kanban: true, can_tickets: true, can_alerts: true, can_automations: true, can_finance: true, can_storage: true, can_brands: true, can_products: true, can_integrations: true, can_announcements: true },
  viewer: { can_dashboard: true, can_expert_dashboard: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_classes: true },
  financial: { can_dashboard: true, can_expert_dashboard: true, can_commercial: true, can_finance: true },
  analyst: { can_dashboard: true, can_expert_dashboard: true, can_crm: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_flow: true, can_social_media: true, can_alerts: true, can_data_health: true },
};

async function readableFunctionError(error: unknown) {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === "function") {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
    } catch {
      // The SDK message below is still more useful than hiding the failure.
    }
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export default function UsersPage() {
  const { data: isMaster, isLoading: loadingMaster } = useIsMaster();
  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: allRDFunnels = [] } = useRDFunnels();
  const rdFunnels = useMemo(() => allRDFunnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id), [allRDFunnels]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "viewer" as AccessRole,
    password: "",
    ...blankPermissions(),
    ad_account_ids: [] as string[],
    rd_funnel_ids: [] as string[],
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const hasAllowedPage = form.role === "admin" || PAGES.some(({ key }) => form[key]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managed_users", workspace?.id],
    enabled: !!workspace?.id && (!!isMaster || ["owner", "admin"].includes(workspace.role)),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "list", workspace_id: workspace!.id },
      });
      if (error) throw new Error(await readableFunctionError(error));
      if (data?.error) throw new Error(data.error);
      return (data?.users ?? []) as UserRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const action = editing ? "update" : "create";
      const body: Record<string, unknown> = {
        action,
        workspace_id: workspace!.id,
        ...Object.fromEntries(PAGES.map(({ key }) => [key, form[key]])),
        ad_account_ids: form.ad_account_ids,
        rd_funnel_ids: form.rd_funnel_ids,
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (editing) {
        body.target_user_id = editing.user_id;
        if (form.password) body.password = form.password;
      }
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body });
      if (error) throw new Error(await readableFunctionError(error));
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: editing ? "Usuário atualizado" : "Usuário criado", description: editing ? undefined : "Envie o e-mail e a senha manualmente para a pessoa." });
      setForm((current) => ({ ...current, password: "" }));
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["managed_users", workspace?.id] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (target_user_id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "delete", workspace_id: workspace!.id, target_user_id },
      });
      if (error) throw new Error(await readableFunctionError(error));
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { warning?: string } | null;
    },
    onSuccess: (data) => {
      toast({
        title: "Usuário removido",
        description: data?.warning || "O acesso deste e-mail foi removido do workspace.",
      });
      setUserToDelete(null);
      qc.invalidateQueries({ queryKey: ["managed_users", workspace?.id] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      role: "viewer",
      password: "",
      ...blankPermissions(),
      can_dashboard: true,
      ad_account_ids: [],
      rd_funnel_ids: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      password: "",
      ...(Object.fromEntries(PAGES.map(({ key }) => [key, u[key]])) as PermissionState),
      ad_account_ids: u.ad_account_ids,
      rd_funnel_ids: u.rd_funnel_ids,
    });
    setDialogOpen(true);
  };

  const duplicateUser = (u: UserRow) => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      role: u.role,
      password: "",
      ...(Object.fromEntries(PAGES.map(({ key }) => [key, u[key]])) as PermissionState),
      ad_account_ids: u.ad_account_ids,
      rd_funnel_ids: u.rd_funnel_ids,
    });
    setDialogOpen(true);
  };

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const selectRole = (role: AccessRole) => {
    setForm({ ...form, role, ...blankPermissions(), ...ROLE_DEFAULTS[role], ...(role === "admin" ? { ad_account_ids: adAccounts.map((account) => account.id), rd_funnel_ids: rdFunnels.map((funnel) => funnel.id) } : {}) } as typeof form);
  };

  const setAllPages = (selected: boolean) =>
    setForm({
      ...form,
      ...Object.fromEntries(PAGES.map(({ key }) => [key, selected])),
    } as typeof form);

  const setAllAdAccounts = (selected: boolean) =>
    setForm({
      ...form,
      ad_account_ids: selected ? adAccounts.map((account) => account.id) : [],
    });

  const setAllRDFunnels = (selected: boolean) =>
    setForm({
      ...form,
      rd_funnel_ids: selected ? rdFunnels.map((funnel) => funnel.id) : [],
    });

  const visibleUsers = useMemo(() => users.filter((u) => {
    const text = `${u.name} ${u.email}`.toLocaleLowerCase();
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase())) && (statusFilter === "all" || u.status === statusFilter);
  }), [query, statusFilter, users]);

  if (loadingMaster || loadingWorkspace) return null;
  if (!isMaster && !["owner", "admin"].includes(workspace?.role ?? "")) return <Navigate to="/" replace />;

  return (
    <MotionPage className="space-y-6 max-w-4xl">
      <MotionItem>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2"><UsersIcon className="h-6 w-6" /> Usuários</h1>
            <p className="text-sm text-muted-foreground mt-1">Crie usuários e defina o que cada um pode acessar</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo usuário</Button>
        </div>
      </MotionItem>

      <MotionItem>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && users.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário criado ainda.</p>
            )}
            <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" /></label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todos os status</option><option value="active">Ativos</option><option value="invited">Convites pendentes</option><option value="disabled">Bloqueados</option></select>
            </div>
            {!isLoading && users.length > 0 && visibleUsers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum usuário corresponde aos filtros.</p>}
            {visibleUsers.map((u) => (
              <div key={u.user_id} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div><p className="font-medium">{u.name || u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                    <Badge variant={u.role === "admin" ? "default" : "outline"}>{roleLabels[u.role]}</Badge>
                    <Badge variant={u.status === "active" ? "secondary" : u.status === "invited" ? "outline" : "destructive"}>{u.status === "active" ? "Ativo" : u.status === "invited" ? "Convite pendente" : "Bloqueado"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PAGES.filter((p) => (u as any)[p.key]).map((p) => (
                      <Badge key={p.key} variant="secondary">{p.label}</Badge>
                    ))}
                    {PAGES.every((p) => !(u as any)[p.key]) && (
                      <Badge variant="outline">Sem páginas</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.ad_account_ids.length} conta(s) · {u.rd_funnel_ids.length} funil(is)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title={`Editar ${u.email}`} aria-label={`Editar ${u.email}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicateUser(u)} title={`Duplicar permissões de ${u.email}`} aria-label={`Duplicar permissões de ${u.email}`}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setUserToDelete(u)} title={`Excluir ${u.email}`} aria-label={`Excluir ${u.email}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </MotionItem>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.email}` : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><UsersIcon className="h-3 w-3" /> Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da pessoa" autoComplete="name" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Mail className="h-3 w-3" /> E-mail de acesso</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value.trim().toLowerCase() })}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2"><KeyRound className="h-3 w-3" /> {editing ? "Nova senha (opcional)" : "Senha *"}</Label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? "Deixe vazio para manter" : "min. 6 caracteres"}
              />
              {!editing && <p className="mt-1 text-xs text-muted-foreground">O sistema não enviará e-mail. Copie os dados e envie manualmente.</p>}
              {!editing && <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!form.email} onClick={() => { void navigator.clipboard.writeText(form.email); toast({ title: "E-mail copiado" }); }}><Clipboard className="mr-1.5 h-3.5 w-3.5" />Copiar e-mail</Button>
                <Button type="button" variant="outline" size="sm" disabled={!form.password} onClick={() => { void navigator.clipboard.writeText(form.password); toast({ title: "Senha copiada" }); }}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar senha</Button>
              </div>}
            </div>

            <div>
              <Label className="mb-2 block">Nível de acesso</Label>
              <div className="grid gap-2">
                {([
                  ["viewer", Eye],
                  ["editor", FilePenLine],
                  ["admin", ShieldCheck], ["financial", FilePenLine], ["analyst", Search],
                ] as const).map(([role, Icon]) => (
                  <button
                    type="button"
                    key={role}
                    onClick={() => selectRole(role)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      form.role === role ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <b className="block text-sm">{roleLabels[role]}</b>
                      <span className="text-xs text-muted-foreground">{roleDescriptions[role]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Páginas permitidas ({PAGES.filter(({ key }) => form[key]).length}/{PAGES.length})</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin"} onClick={() => setAllPages(true)}>
                    Selecionar todas
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin"} onClick={() => setAllPages(false)}>
                    Desmarcar todas
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAGES.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form[p.key]}
                      disabled={form.role === "admin"}
                      onCheckedChange={(v) => setForm({ ...form, [p.key]: !!v })}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              {!hasAllowedPage && <p className="mt-2 text-xs font-medium text-destructive">Selecione ao menos uma aba para que o usuário tenha uma rota de acesso.</p>}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Contas de anúncio ({form.ad_account_ids.length}/{adAccounts.length})</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin" || adAccounts.length === 0} onClick={() => setAllAdAccounts(true)}>
                    Selecionar todas
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin" || adAccounts.length === 0} onClick={() => setAllAdAccounts(false)}>
                    Desmarcar todas
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {adAccounts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>}
                {adAccounts.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.ad_account_ids.includes(a.id)}
                      disabled={form.role === "admin"}
                      onCheckedChange={() => setForm({ ...form, ad_account_ids: toggle(form.ad_account_ids, a.id) })}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Funis RD ({form.rd_funnel_ids.length}/{rdFunnels.length})</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin" || rdFunnels.length === 0} onClick={() => setAllRDFunnels(true)}>
                    Selecionar todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={form.role === "admin" || rdFunnels.length === 0} onClick={() => setAllRDFunnels(false)}>
                    Desmarcar todos
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {rdFunnels.length === 0 && <p className="text-xs text-muted-foreground">Nenhum funil cadastrado</p>}
                {rdFunnels.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.rd_funnel_ids.includes(f.id)}
                      disabled={form.role === "admin"}
                      onCheckedChange={() => setForm({ ...form, rd_funnel_ids: toggle(form.rd_funnel_ids, f.id) })}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.email || (!editing && form.password.length < 6) || !hasAllowedPage}
            >
              {save.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmationDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Excluir usuário da equipe"
        description="O acesso será revogado, as atribuições serão removidas e o histórico de auditoria será preservado sem identificar o usuário excluído. Esta ação não pode ser desfeita."
        confirmation={userToDelete?.email ?? ""}
        pending={remove.isPending}
        onConfirm={() => userToDelete && remove.mutate(userToDelete.user_id)}
      />
    </MotionPage>
  );
}
