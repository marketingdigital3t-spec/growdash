import { NavLink } from "react-router-dom";
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotificationCenter } from "@/hooks/useNotificationCenter";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const center = useNotificationCenter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="relative grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.05] text-white/75 transition hover:bg-white/10 hover:text-white" aria-label={`${center.unread.length} notificações não lidas`}>
          <Bell className="h-4 w-4" />
          {center.unread.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{Math.min(99, center.unread.length)}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="z-[140] w-[min(420px,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0">Notificações da sua operação</DropdownMenuLabel>
          <Button variant="ghost" size="sm" className="ml-auto h-8 text-[10px]" onClick={center.markAllRead}><CheckCheck className="mr-1 h-3.5 w-3.5" />Marcar lidas</Button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="growdash-scrollbar max-h-[min(560px,70vh)] overflow-y-auto p-2">
          {center.items.length === 0 ? <div className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhum alerta disponível para os módulos e contas aos quais você tem acesso.</div> : center.items.map((item) => {
            const unread = !center.isRead(item.id);
            const Icon = item.severity === "critical" ? CircleAlert : item.severity === "warning" ? AlertTriangle : Info;
            return <NavLink key={item.id} to={item.href} onClick={() => center.markRead(item.id)} className={cn("mb-1 flex gap-3 rounded-xl border p-3 transition last:mb-0 hover:bg-muted/65", unread ? "border-primary/35 bg-primary/[.045]" : "border-transparent bg-muted/25")}>
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.severity === "critical" ? "bg-red-500/12 text-red-500" : item.severity === "warning" ? "bg-amber-500/12 text-amber-500" : "bg-blue-500/12 text-blue-500")}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="flex items-center gap-2 text-xs font-black">{item.title}{unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</span><span className="mt-1 line-clamp-3 block text-[10px] leading-relaxed text-muted-foreground">{item.description}</span></span>
            </NavLink>;
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
