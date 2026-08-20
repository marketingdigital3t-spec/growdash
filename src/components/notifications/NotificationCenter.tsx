import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, CheckCheck, CircleAlert, Info, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotificationCenter } from "@/hooks/useNotificationCenter";
import { cn } from "@/lib/utils";

const BROWSER_SENT_KEY = "growdash:smart-alerts:browser-sent";

function loadBrowserSent() {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(BROWSER_SENT_KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

export function NotificationCenter() {
  const center = useNotificationCenter();
  const navigate = useNavigate();
  const [dismissedPreview, setDismissedPreview] = useState<string | null>(null);
  const preview = useMemo(() => center.unread.find((item) => item.severity === "critical") || center.unread[0], [center.unread]);
  const browserCandidate = useMemo(() => center.unread.find((item) => item.severity !== "info"), [center.unread]);
  const browserEnabled = center.preferences.browserEnabled;
  const markRead = center.markRead;
  const visiblePreview = preview && preview.id !== dismissedPreview ? preview : null;

  useEffect(() => {
    if (!browserEnabled || !browserCandidate || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const sent = loadBrowserSent();
    if (sent.has(browserCandidate.id)) return;
    const notification = new Notification(`Growdash · ${browserCandidate.title}`, {
      body: `${browserCandidate.accountName ? `${browserCandidate.accountName}: ` : ""}${browserCandidate.description}`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: browserCandidate.id,
    });
    notification.onclick = () => {
      window.focus();
      markRead(browserCandidate.id);
      navigate(browserCandidate.href);
      notification.close();
    };
    sent.add(browserCandidate.id);
    window.localStorage.setItem(BROWSER_SENT_KEY, JSON.stringify(Array.from(sent).slice(-100)));
  }, [browserCandidate, browserEnabled, markRead, navigate]);

  return <>
    {visiblePreview && <aside aria-live="polite" className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-[109] w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-[0_24px_80px_-22px_rgba(0,0,0,.85)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", visiblePreview.severity === "critical" ? "bg-red-500/12 text-red-500" : "bg-amber-500/12 text-amber-500")}><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 grow"><span className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Alerta inteligente</span><h2 className="mt-1 text-sm font-black">{visiblePreview.title}</h2>{visiblePreview.accountName && <p className="mt-0.5 truncate text-[10px] font-bold text-muted-foreground">Conta: {visiblePreview.accountName}</p>}<p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">{visiblePreview.description}</p></div>
        <button type="button" className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar prévia do alerta" onClick={() => setDismissedPreview(visiblePreview.id)}><X className="h-4 w-4" /></button>
      </div>
      <NavLink to={visiblePreview.href} onClick={() => center.markRead(visiblePreview.id)} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary transition hover:bg-primary/15">Ver análise e corrigir <ArrowRight className="h-3.5 w-3.5" /></NavLink>
    </aside>}

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[110] flex h-14 items-center gap-3 rounded-2xl border border-primary/35 bg-[#080808]/95 px-4 text-white shadow-[0_24px_75px_-22px_rgba(0,0,0,.95)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/60" aria-label={`${center.unread.length} alertas inteligentes não lidos`}>
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Bell className="h-4 w-4" />{center.unread.length > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{Math.min(99, center.unread.length)}</span>}</span>
          <span className="hidden text-left sm:block"><b className="block text-xs">Alertas inteligentes</b><small className="mt-0.5 block text-[9px] text-white/45">{center.unread.length ? `${center.unread.length} ponto(s) para agir` : "Operação monitorada"}</small></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={12} collisionPadding={12} className="z-[140] w-[min(430px,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-3"><DropdownMenuLabel className="p-0"><span className="block">Notificações da sua operação</span><span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">Somente contas e módulos liberados para seu usuário.</span></DropdownMenuLabel><Button variant="ghost" size="sm" className="ml-auto h-8 shrink-0 text-[10px]" onClick={center.markAllRead}><CheckCheck className="mr-1 h-3.5 w-3.5" />Ler todas</Button></div>
        <DropdownMenuSeparator className="m-0" />
        <div className="growdash-scrollbar max-h-[min(560px,65vh)] overflow-y-auto p-2">
          {center.items.length === 0 ? <div className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhum ponto crítico nas contas que você pode acessar.</div> : center.items.map((item) => {
            const unread = !center.isRead(item.id);
            const Icon = item.severity === "critical" ? CircleAlert : item.severity === "warning" ? AlertTriangle : Info;
            return <NavLink key={item.id} to={item.href} onClick={() => center.markRead(item.id)} className={cn("mb-1 flex gap-3 rounded-xl border p-3 transition last:mb-0 hover:bg-muted/65", unread ? "border-primary/35 bg-primary/[.045]" : "border-transparent bg-muted/25")}>
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.severity === "critical" ? "bg-red-500/12 text-red-500" : item.severity === "warning" ? "bg-amber-500/12 text-amber-500" : "bg-blue-500/12 text-blue-500")}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="flex items-center gap-2 text-xs font-black">{item.title}{unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</span>{item.accountName && <span className="mt-0.5 block truncate text-[9px] font-bold text-primary/80">{item.accountName}</span>}<span className="mt-1 line-clamp-3 block text-[10px] leading-relaxed text-muted-foreground">{item.description}</span></span>
            </NavLink>;
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}
