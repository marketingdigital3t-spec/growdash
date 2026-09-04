import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getWidgetDef, type WidgetType } from "@/lib/widgetCatalog";
import { metricDescription } from "@/lib/metricPresentation";

type Props = {
  title: string;
  type?: WidgetType;
  children: ReactNode;
  className?: string;
};

/**
 * Gives every dashboard card a concise explanation without changing its
 * content. The trigger also receives keyboard focus, so the same guidance is
 * available without a mouse.
 */
export function DashboardWidgetHelp({ title, type, children, className }: Props) {
  const description = type === "kpi"
    ? metricDescription(title)
    : getWidgetDef(type ?? "default_block")?.description
      ?? `Entenda os dados e o recorte exibidos em ${title}.`;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className={`dashboard-widget-help ${className ?? ""}`}
          aria-label={`${title}. ${description}`}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs border-primary/30 bg-popover px-3 py-2 text-xs leading-5 shadow-xl">
        <p className="font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
