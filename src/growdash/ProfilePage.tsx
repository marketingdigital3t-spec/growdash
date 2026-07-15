/* New tenant tables are queried through the Supabase client before generated types are refreshed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, LockKeyhole, Mail, Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans, useWorkspace, useWorkspaceSubscription } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "./shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: workspace } = useWorkspace();
  const { data: plans = [] } = usePlans();
  const { data: subscription } = useWorkspaceSubscription(workspace?.id);
  const [form, setForm] = useState({ full_name: "", phone: "", gender: "", job_title: "", avatar_url: "", density: "comfortable" });
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("full_name, email, phone, gender, job_title, avatar_url, theme, density").eq("user_id", user!.id).single();
      if (!error) return data;
      if (!/phone|gender|job_title|avatar_url|theme|density|schema cache/i.test(error.message)) throw error;
      const legacy = await supabase.from("profiles").select("full_name, email").eq("user_id", user!.id).single();
      if (legacy.error) throw legacy.error;
      return { ...legacy.data, phone: "", gender: "", job_title: "", avatar_url: "", theme: "dark", density: "comfortable" };
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      gender: profile.gender ?? "",
      job_title: profile.job_title ?? "",
      avatar_url: profile.avatar_url ?? "",
      density: profile.density ?? "comfortable",
    });
    setEmail(profile.email || user?.email || "");
  }, [profile, user?.email]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("profiles").update({ ...form, theme }).eq("user_id", user!.id);
      if (error) {
        if (!/phone|gender|job_title|avatar_url|theme|density|schema cache/i.test(error.message)) throw error;
        const legacy = await supabase.from("profiles").update({ full_name: form.full_name }).eq("user_id", user!.id);
        if (legacy.error) throw legacy.error;
      }
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: form.full_name, avatar_url: form.avatar_url } });
      if (metadataError) throw metadataError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com segurança." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const updateAccess = useMutation({
    mutationFn: async () => {
      if (email && email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }
      if (password) {
        if (password.length < 10) throw new Error("Use uma senha com pelo menos 10 caracteres.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setPassword("");
      toast({ title: "Dados de acesso atualizados", description: email !== user?.email ? "Confirme o novo e-mail na mensagem enviada." : "Sua nova senha já está ativa." });
    },
    onError: (error: Error) => toast({ title: "Falha na atualização", description: error.message, variant: "destructive" }),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Envie JPG, PNG ou WebP.");
      if (file.size > 3 * 1024 * 1024) throw new Error("A foto deve ter no máximo 3 MB.");
      const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
      const path = `${user!.id}/profile-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    },
    onSuccess: (url) => setForm((current) => ({ ...current, avatar_url: url })),
    onError: (error: Error) => toast({ title: "Foto não enviada", description: error.message, variant: "destructive" }),
  });

  const currentPlan = useMemo(() => plans.find((plan: any) => plan.code === subscription?.plan_code), [plans, subscription?.plan_code]);
  const initials = (form.full_name || user?.email || "GD").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-[1250px]">
      <PageHeading eyebrow="Conta" title="Meu perfil" description="Gerencie identidade, segurança, aparência e assinatura do seu workspace." />

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1">
          <TabsTrigger value="personal"><UserRound className="mr-2 h-4 w-4" />Dados pessoais</TabsTrigger>
          <TabsTrigger value="security"><LockKeyhole className="mr-2 h-4 w-4" />Segurança</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" />Aparência</TabsTrigger>
          <TabsTrigger value="plan"><ShieldCheck className="mr-2 h-4 w-4" />Plano e uso</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="gd-panel p-5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-5 text-center">
              <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                <AvatarImage src={form.avatar_url} alt={form.full_name} />
                <AvatarFallback className="bg-primary text-xl font-black text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar" className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-muted">
                <Camera className="h-4 w-4" />{uploadAvatar.isPending ? "Enviando…" : "Alterar foto"}
              </Label>
              <Input id="avatar" className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && uploadAvatar.mutate(event.target.files[0])} />
              <p className="mt-2 text-[10px] text-muted-foreground">JPG, PNG ou WebP · até 3 MB</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo"><Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" /></Field>
              <Field label="Cargo"><Input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} placeholder="Ex.: Head de Growth" /></Field>
              <Field label="Como prefere se identificar">
                <Select value={form.gender || "nao_informar"} onValueChange={(value) => setForm({ ...form, gender: value === "nao_informar" ? "" : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="nao_binario">Não binário</SelectItem><SelectItem value="nao_informar">Prefiro não informar</SelectItem></SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2"><Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || isLoading}><Save className="mr-2 h-4 w-4" />{saveProfile.isPending ? "Salvando…" : "Salvar perfil"}</Button></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="gd-panel p-5 sm:p-7">
          <div className="max-w-xl space-y-5">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-500" />Sua sessão usa autenticação segura do Supabase.</div>
            <Field label="E-mail de acesso"><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div></Field>
            <Field label="Nova senha"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 10 caracteres" autoComplete="new-password" /></Field>
            <Button onClick={() => updateAccess.mutate()} disabled={updateAccess.isPending || (!password && email === user?.email)}>{updateAccess.isPending ? "Atualizando…" : "Atualizar acesso"}</Button>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="gd-panel p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <AppearanceCard active={theme === "dark"} title="Modo escuro" description="Maior conforto visual em operações prolongadas." onClick={() => setTheme("dark")} />
            <AppearanceCard active={theme === "light"} title="Modo claro" description="Mais contraste em ambientes bem iluminados." onClick={() => setTheme("light")} />
          </div>
          <div className="mt-6 max-w-sm"><Field label="Densidade da interface"><Select value={form.density} onValueChange={(value) => setForm({ ...form, density: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Confortável</SelectItem><SelectItem value="compact">Compacta</SelectItem></SelectContent></Select></Field></div>
          <Button className="mt-5" onClick={() => saveProfile.mutate()}><Save className="mr-2 h-4 w-4" />Salvar aparência</Button>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <div className="gd-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Plano atual</p><h2 className="mt-1 text-2xl font-black">{currentPlan?.name ?? "Carregando…"}</h2><p className="text-xs text-muted-foreground">Status: {subscription?.status ?? "—"} · Workspace: {workspace?.name ?? "—"}</p></div>
            {currentPlan && <div className="text-2xl font-black">{brl.format(Number(currentPlan.monthly_price))}<span className="text-xs font-medium text-muted-foreground">/mês</span></div>}
          </div>
          <div className="gd-auto-grid gap-4">
            {plans.map((plan: any) => {
              const current = plan.code === subscription?.plan_code;
              const limits = plan.entitlements || {};
              return <article key={plan.code} className={`gd-panel flex flex-col p-5 ${current ? "border-primary ring-1 ring-primary/30" : ""}`}><div className="flex items-center justify-between"><h3 className="font-black">{plan.name}</h3>{current && <span className="rounded-full bg-primary/15 px-2 py-1 text-[9px] font-black text-primary">ATUAL</span>}</div><p className="mt-2 min-h-12 text-xs text-muted-foreground">{plan.description}</p><p className="mt-4 text-2xl font-black">{brl.format(Number(plan.monthly_price))}<span className="text-xs font-medium text-muted-foreground">/mês</span></p><ul className="my-5 grow space-y-2 text-xs"><Limit label={`${limits.ad_accounts} contas de anúncio`} /><Limit label={`${limits.users} usuários`} /><Limit label={`${limits.ai_credits} créditos de IA/mês`} /><Limit label={`${limits.automations} automações`} /><Limit label={`${limits.whatsapp_reports} relatórios WhatsApp/mês`} /></ul><Button variant={current ? "secondary" : "outline"} disabled title={current ? "Plano atual" : "Checkout será ativado quando o provedor de cobrança for configurado"}>{current ? "Plano atual" : "Aguardando checkout"}</Button></article>;
            })}
          </div>
          <p className="text-xs text-muted-foreground">Mensagens de marketing e consumo da Meta são cobrados diretamente pelo provedor. Nenhum plano oferece uso ilimitado.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Limit({ label }: { label: string }) { return <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" />{label}</li>; }
function AppearanceCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left transition hover:bg-muted/50 ${active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"}`}><div className="flex items-center justify-between"><b>{title}</b>{active && <Check className="h-4 w-4 text-primary" />}</div><p className="mt-2 text-xs text-muted-foreground">{description}</p></button>; }
