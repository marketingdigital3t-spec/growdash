import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface HowToSyncStepsProps {
  title?: string;
  steps: (string | { title: string; detail?: string })[];
  defaultOpen?: boolean;
  tone?: "default" | "info";
}

/**
 * Caixa expansível com passo a passo para qualquer ação de sincronização.
 * Use no topo (ou logo abaixo do CardDescription) de qualquer Card que tenha
 * botões do tipo "Sincronizar", "Atualizar", "Reconciliar", etc.
 */
export function HowToSyncSteps({
  title = "Como sincronizar — passo a passo",
  steps,
  defaultOpen = false,
  tone = "default",
}: HowToSyncStepsProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-md border bg-muted/30",
        tone === "info" && "border-primary/30 bg-primary/5",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40 rounded-md transition-colors"
      >
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ol className="space-y-2 px-3 pb-3 pt-1 text-xs text-muted-foreground">
          {steps.map((step, idx) => {
            const isObj = typeof step !== "string";
            const stepTitle = isObj ? step.title : step;
            const detail = isObj ? step.detail : undefined;
            return (
              <li key={idx} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-foreground">{stepTitle}</p>
                  {detail && <p className="mt-0.5 text-muted-foreground">{detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
