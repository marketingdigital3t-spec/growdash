import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMaster } from "@/hooks/useIsMaster";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Users as UsersIcon, KeyRound } from "lucide-react";
import { Navigate } from "react-router-dom";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";

const PAGES = [
  { key: "can_dashboard", label: "Dashboard" },
  { key: "can_campaigns", label: "Campanhas" },
  { key: "can_funnels", label: "Análise de Funis" },
  { key: "can_crm", label: "CRM" },
  { key: "can_commercial", label: "Comercial" },
  { key: "can_classes", label: "Datas & Turmas" },
  { key: "can_leads", label: "Leads incompletos" },
  { key: "can_alerts", label: "Alertas" },
  { key: "can_users", label: "Usuários" },
  { key: "can_integrations", label: "Integrações" },
  { key: "can_announcements", label: "Anúncios" },
  { key: "can_automations", label: "Automações" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

type UserRow = {
  user_id: string;
  username: string;
  can_dashboard: boolean;
  can_campaigns: boolean;
  can_funnels: boolean;
  can_classes: boolean;
  can_crm: boolean;
  can_commercial: boolean;
  can_leads: boolean;
  can_alerts: boolean;
  can_users: boolean;
  can_integrations: boolean;
  can_announcements: boolean;
  can_automations: boolean;
  ad_account_ids: string[];
  rd_funnel_ids: string[];
};

const emptyPerms = (): Record<PageKey, boolean> =>
  PAGES.reduce((acc, p) => ({ ...acc, [p.key]: false }), {} as Record<PageKey, boolean>);

export default function UsersPage() {
  const { data: isMaster, isLoading: loadingMaster } = useIsMaster();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: rdFunnels = [] } = useRDFunnels();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    ...emptyPerms(),
    ad_account_ids: [] as string[],
    rd_funnel_ids: [] as string[],
  });


  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managed_users"],
    enabled: !!isMaster,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.users ?? []) as UserRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const action = editing ? "update" : "create";
      const body: Record<string, unknown> = {
        action,
        ...PAGES.reduce((acc, p) => ({ ...acc, [p.key]: form[p.key] }), {}),
        ad_account_ids: form.ad_account_ids,
        rd_funnel_ids: form.rd_funnel_ids,
      };

      if (editing) {
        body.target_user_id = editing.user_id;
        if (form.password) body.password = form.password;
      } else {
        body.username = form.username;
        body.password = form.password;
      }
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: editing ? "Usuário atualizado" : "Usuário criado" });
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["managed_users"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (target_user_id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "delete", target_user_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: "Usuário removido" });
      qc.invalidateQueries({ queryKey: ["managed_users"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      username: "",
      password: "",
      ...emptyPerms(),
      can_dashboard: true,
      ad_account_ids: [],
      rd_funnel_ids: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: "",
      ...PAGES.reduce(
        (acc, p) => ({ ...acc, [p.key]: !!(u as any)[p.key] }),
        {} as Record<PageKey, boolean>,
      ),
      ad_account_ids: u.ad_account_ids,
      rd_funnel_ids: u.rd_funnel_ids,
    });
    setDialogOpen(true);
  };

  const allPagesSelected = PAGES.every((p) => (form as any)[p.key]);
  const setAllPages = (v: boolean) => {
    const next = { ...form };
    PAGES.forEach((p) => ((next as any)[p.key] = v));
    setForm(next);
  };
  const allAdAccountsSelected = adAccounts.length > 0 && form.ad_account_ids.length === adAccounts.length;
  const setAllAdAccounts = (v: boolean) =>
    setForm({ ...form, ad_account_ids: v ? adAccounts.map((a) => a.id) : [] });
  const allRdSelected = rdFunnels.length > 0 && form.rd_funnel_ids.length === rdFunnels.length;
  const setAllRd = (v: boolean) =>
    setForm({ ...form, rd_funnel_ids: v ? rdFunnels.map((f) => f.id) : [] });


  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  if (loadingMaster) return null;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <MotionPage className="space-y-6 max-w-4xl">
      <MotionItem>
        <div className="flex items-center justify-between">
          <div>
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
            {users.map((u) => (
              <div key={u.user_id} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="space-y-2">
                  <p className="font-medium">{u.username}</p>
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
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                    if (confirm(`Remover ${u.username}?`)) remove.mutate(u.user_id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </MotionItem>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.username}` : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div>
                <Label>Usuário</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })}
                  placeholder="ex: joao"
                />
              </div>
            )}
            <div>
              <Label className="flex items-center gap-2"><KeyRound className="h-3 w-3" /> {editing ? "Nova senha (opcional)" : "Senha"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? "Deixe vazio para manter" : "min. 6 caracteres"}
              />
            </div>

            <div>
              <Label className="mb-2 block">Páginas permitidas</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAGES.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(form as any)[p.key]}
                      onCheckedChange={(v) => setForm({ ...form, [p.key]: !!v } as typeof form)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Contas de anúncio</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {adAccounts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>}
                {adAccounts.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.ad_account_ids.includes(a.id)}
                      onCheckedChange={() => setForm({ ...form, ad_account_ids: toggle(form.ad_account_ids, a.id) })}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Funis RD</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {rdFunnels.length === 0 && <p className="text-xs text-muted-foreground">Nenhum funil cadastrado</p>}
                {rdFunnels.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.rd_funnel_ids.includes(f.id)}
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
              disabled={save.isPending || (!editing && (!form.username || !form.password))}
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}
