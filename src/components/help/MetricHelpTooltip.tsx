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
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            className={cn("group/help relative min-w-0 cursor-default outline-none", className)}
            aria-label={`${title}. ${description}${detail ? ` ${detail}` : ""}`}
          >
            {children}
            {showHint && (
              <span className="pointer-events-none absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full border border-[#d6aa35]/35 bg-background/80 text-[#e6b83f] opacity-70 shadow-sm transition-opacity group-hover/help:opacity-100 group-focus-visible/help:opacity-100">
                <Info className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={10}
          className="z-[120] max-w-[340px] rounded-xl border-[#d6aa35]/35 bg-popover/95 px-4 py-3 text-popover-foreground shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e6b83f]" aria-hidden="true" />
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
