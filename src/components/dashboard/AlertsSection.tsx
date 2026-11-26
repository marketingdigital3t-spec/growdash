import { getSeverityColor, getSeverityIcon } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface AlertsSectionProps {
  alerts: Tables<"alerts">[];
  onMarkRead: (id: string) => void;
}

export function AlertsSection({ alerts, onMarkRead }: AlertsSectionProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas Recentes</h3>
      <div className="grid gap-2">
        {alerts.slice(0, 5).map((alert) => (
          <div key={alert.id} className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${getSeverityColor(alert.severity)}`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
              <div>
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs opacity-70">{alert.alert_type}</p>
              </div>
            </div>
            {!alert.is_read && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMarkRead(alert.id)}>
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
