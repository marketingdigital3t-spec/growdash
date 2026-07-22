import { Bell, ChevronRight, Database, Link2, Palette, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { Switch } from "@/components/ui/switch";
import { SalesGoalSettingsCard } from "@/components/settings/SalesGoalSettingsCard";

const sections = [
  { to: "/perfil", icon: UserRound, title: "Perfil e acesso", description: "Nome, foto, telefone, e-mail, senha e aparência." },
  { to: "/usuarios", icon: UsersRound, title: "Equipe e permissões", description: "Membros, papéis e acesso às contas e módulos." },
  { to: "/integracoes", icon: Link2, title: "Integrações", description: "Meta, RD, IA, mensageria, pagamentos, arquivos e API." },
  { to: "/saude-dos-dados", icon: Database, title: "Saúde dos dados", description: "Sincronizações, divergências, duplicidades e auditoria." },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery({
    queryKey: ["profile-preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("email_alerts_enabled").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const updateAlerts = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await (supabase as any).from("profiles").update({ email_alerts_enabled: enabled }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profile-preferences", user?.id] }); toast({ title: "Notificações atualizadas" }); },
    onError: (error: Error) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });

  return (
    <MotionPage className="mx-auto w-full max-w-6xl space-y-6">
      <MotionItem>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Administração</p>
        <h1 className="mt-1 text-3xl font-black">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preferências do workspace {workspace?.name ? `“${workspace.name}”` : "Growdash"}. As conexões técnicas agora ficam centralizadas em Integrações.</p>
      </MotionItem>

      <MotionItem className="grid gap-4 md:grid-cols-2">
        {sections.map(({ to, icon: Icon, title, description }) => <Link key={to} to={to} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50"><div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0 grow"><h2 className="font-black">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div></Link>)}
      </MotionItem>

      <MotionItem className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3"><Palette className="h-5 w-5 text-primary" /><div><h2 className="font-black">Aparência rápida</h2><p className="text-xs text-muted-foreground">Aplicada em toda a plataforma.</p></div></div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4"><span className="text-sm">Modo escuro</span><Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} /></div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-primary" /><div><h2 className="font-black">Notificações</h2><p className="text-xs text-muted-foreground">Alertas críticos e resumos da operação.</p></div></div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4"><span className="text-sm">Alertas críticos por e-mail</span><Switch aria-label="Alertas críticos por e-mail" checked={!!preferences?.email_alerts_enabled} onCheckedChange={(checked) => updateAlerts.mutate(checked)} disabled={updateAlerts.isPending} /></div>
        </section>
      </MotionItem>

      <MotionItem><SalesGoalSettingsCard /></MotionItem>

      <MotionItem className="flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" /><div><b>Segurança por padrão</b><p className="mt-1 text-xs text-muted-foreground">Tokens de Meta e RD permanecem restritos ao backend; o navegador recebe somente campos operacionais permitidos.</p></div></MotionItem>
    </MotionPage>
  );
}
