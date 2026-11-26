import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MetricHelpTooltipProps {
  children: ReactNode;
  title: string;
  description: string;
  detail?: string;
  className?: string;
  showHint?: boolean;
}

/**
 * Ajuda contextual padronizada para métricas e blocos analíticos.
 * Funciona por hover, foco de teclado e toque, sem trocar o cursor do usuário.
 */
export function MetricHelpTooltip({
  children,
  title,
  description,
  detail,
  className,
  showHint = false,
}: MetricHelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={280} skipDelayDuration={100}>
      <Tooltip>
        <div className={cn("group/help relative min-w-0", className)}>
          {children}
          {showHint ? (
            <TooltipTrigger asChild>
              <button type="button" aria-label={`${title}. ${description}${detail ? ` ${detail}` : ""}`} className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full border border-primary/35 bg-background/80 text-primary opacity-70 shadow-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Info className="h-3 w-3" aria-hidden="true" />
              </button>
            </TooltipTrigger>
          ) : (
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-label={`${title}. ${description}${detail ? ` ${detail}` : ""}`} className="pointer-events-none absolute inset-0 outline-none" />
            </TooltipTrigger>
          )}
        </div>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={10}
          className="z-[120] max-w-[340px] rounded-xl border-primary/35 bg-popover/95 px-4 py-3 text-popover-foreground shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              {detail && <p className="mt-2 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
