import { useEffect, useState } from "react";
import { Bell, BellRing, CircleAlert, MessageCircleWarning, Smartphone, WalletCards } from "lucide-react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { requestSmartAlertBrowserPermission, useSmartAlertPreferences } from "@/hooks/useSmartAlertPreferences";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import type { SmartAlertPreferences } from "@/lib/smartAlerts";

const alertOptions: Array<{ key: keyof Pick<SmartAlertPreferences, "lowBudget" | "cplRise" | "noConversion" | "syncError" | "oauth">; title: string; description: string; icon: typeof WalletCards }> = [
  { key: "lowBudget", title: "Orçamento baixo", description: "Saldo com autonomia curta ou orçamento esgotado.", icon: WalletCards },
  { key: "cplRise", title: "CPL subiu", description: "Custo por lead acima do alvo configurado da conta/campanha.", icon: MessageCircleWarning },
  { key: "noConversion", title: "Campanha parou de converter", description: "Campanha ativa gastando sem gerar leads suficientes.", icon: CircleAlert },
  { key: "syncError", title: "Falha de sincronização", description: "Meta ou RD deixou de atualizar os dados da conta.", icon: Bell },
  { key: "oauth", title: "Acesso precisa ser renovado", description: "Token Meta expirado, revogado ou inválido.", icon: BellRing },
];

export function SmartAlertSettingsCard() {
  const { data: accounts = [] } = useAdAccounts();
  const { preferences, updateAsync, isUpdating } = useSmartAlertPreferences();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  async function patch(changes: Partial<SmartAlertPreferences>) {
    try {
      await updateAsync({ ...preferences, ...changes });
      toast({ title: "Alertas inteligentes atualizados" });
    } catch (error) {
      toast({ title: "Não foi possível atualizar os alertas", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  }

  async function toggleBrowser(enabled: boolean) {
    if (!enabled) return patch({ browserEnabled: false });
    const result = await requestSmartAlertBrowserPermission();
    setPermission(result);
    if (result !== "granted") {
      toast({ title: "Permissão de notificações não concedida", description: result === "unsupported" ? "Este navegador não oferece notificações do sistema." : "Autorize as notificações do navegador para receber alertas no celular.", variant: "destructive" });
      return;
    }
    await patch({ browserEnabled: true });
  }

  return <section id="smart-alerts" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[.08] via-card to-card p-5 shadow-[0_22px_70px_-42px_hsl(var(--primary))]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><BellRing className="h-5 w-5" /></span>
      <div className="min-w-0 grow"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">Alerta inteligente</h2><span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-primary">Proativo</span></div><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Monitore automaticamente somente as contas e módulos que seu usuário pode acessar. O alerta aparece no canto inferior direito e pode chegar como notificação do celular.</p></div>
      <Switch aria-label="Ativar alertas inteligentes" checked={preferences.enabled} onCheckedChange={(checked) => void patch({ enabled: checked })} disabled={isUpdating} />
    </div>

    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{alertOptions.map(({ key, title, description, icon: Icon }) => <div key={key} className="flex items-start gap-3 rounded-xl border border-border bg-background/45 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0 grow"><b className="block text-xs">{title}</b><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p></div><Switch aria-label={`Ativar alerta: ${title}`} checked={preferences[key]} onCheckedChange={(checked) => void patch({ [key]: checked })} disabled={!preferences.enabled || isUpdating} /></div>)}</div>

    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background/45 p-4 sm:flex-row sm:items-center">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-500"><Smartphone className="h-4 w-4" /></span>
      <div className="min-w-0 grow"><b className="block text-xs">Notificações no celular / navegador</b><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Autorize o navegador para receber avisos críticos enquanto a Growdash estiver aberta ou instalada como app. O bloqueio do navegador não altera os alertas internos.</p><p aria-live="polite" className="mt-1 text-[10px] font-bold text-primary">Status: {permission === "granted" ? "permitidas" : permission === "denied" ? "bloqueadas no navegador" : permission === "unsupported" ? "indisponíveis neste navegador" : "ainda não configuradas"}</p></div>
      <Switch aria-label="Receber alertas inteligentes no celular" checked={preferences.browserEnabled} onCheckedChange={(checked) => void toggleBrowser(checked)} disabled={!preferences.enabled || isUpdating} />
    </div>

    <div className="mt-4 rounded-xl border border-border bg-background/35 p-4"><div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-primary" /><b className="text-xs">Escopo monitorado</b></div><p className="mt-1 text-[10px] text-muted-foreground">A lista abaixo é derivada do acesso atual do usuário. Não são criados alertas de contas fora deste escopo.</p><div className="mt-3 flex flex-wrap gap-2">{accounts.length ? accounts.slice(0, 12).map((account) => <span key={account.id} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold">{account.name}</span>) : <span className="text-[10px] text-muted-foreground">Nenhuma conta de anúncio disponível neste workspace.</span>}{accounts.length > 12 && <span className="rounded-full border border-primary/25 px-2.5 py-1 text-[10px] font-bold text-primary">+{accounts.length - 12} contas</span>}</div></div>
  </section>;
}

