import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HourlyCoverage, MissingAccount, MissingReason } from "@/hooks/useHourlyCoverage";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useDashboard } from "@/contexts/DashboardContext";
import { businessDateKey } from "@/lib/businessDate";
import { EmptyState } from "@/components/ui/growdash-primitives";

const REASON_TEXT: Record<MissingReason, (name: string) => string> = {
  token_expired: (n) =>
    `A conta ${n} está com o token do Meta expirado. Renove o acesso no Meta Business e clique em "Sincronizar agora".`,
  no_delivery: (n) =>
    `Não houve entrega de anúncios para ${n} nesse intervalo. Tente um período maior ou verifique se as campanhas estavam ativas.`,
  never_synced: (n) =>
    `${n} ainda não foi sincronizada. Vá em Configurações → "Backfill 2026" para importar o histórico, ou clique em "Sincronizar agora".`,
  lead_event_not_configured: (n) =>
    `A conta ${n} tem entrega no período, mas o evento de Lead não está configurado. Vá em Configurações → conta → "Evento de Lead da Landing Page" e selecione o evento correto. Depois clique em "Sincronizar agora".`,
};

export function HourlyDataEmptyState({ coverage }: { coverage: HourlyCoverage }) {
  const { startDate, endDate, adAccountId } = useDashboard();
  const sync = useSyncMeta();
  const start = businessDateKey(startDate);
  const end = businessDateKey(endDate);

  return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Sem dados horários para este período" description={coverage.missingAccounts.map((m) => REASON_TEXT[m.reason](m.name)).join(" ")} action={<Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate({ adAccountId, startDate: start, endDate: end })}><RefreshCw className={`mr-1 h-3 w-3 ${sync.isPending ? "animate-spin" : ""}`} />Sincronizar agora</Button>} className="h-full min-h-40 border-0 bg-transparent" />;
}

export function HourlyCoverageBadge({ coverage }: { coverage: HourlyCoverage }) {
  if (coverage.status !== "partial") return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-amber-500 hover:text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-semibold mb-1">Algumas contas sem dados horários:</p>
          <ul className="text-xs space-y-0.5">
            {coverage.missingAccounts.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.name}</span> —{" "}
                {m.reason === "never_synced" && "rode 'Backfill 2026' em Configurações."}
                {m.reason === "no_delivery" && "sem entrega no período."}
                {m.reason === "token_expired" && "token do Meta expirado."}
                {m.reason === "lead_event_not_configured" && "evento de Lead não configurado."}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
