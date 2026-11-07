import { Check } from "lucide-react";
import { useAccentTheme, type ReadingMode } from "@/hooks/useAccentTheme";
import { cn } from "@/lib/utils";

/**
 * Reading-mode picker for the platform visual contract.
 *
 * The platform ships a single palette — Esmeralda Neon — with two reading
 * modes: Modo Claro (translucent light surfaces) and Modo Escuro (deep
 * cosmic black surfaces). Both modes keep the same emerald accent, the same
 * glass treatment and the same luminous borders.
 */
const MODES: { value: ReadingMode; label: string; description: string }[] = [
  { value: "dark", label: "Modo Escuro", description: "Preto cósmico profundo, vidro translúcido e neon esmeralda." },
  { value: "light", label: "Modo Claro", description: "Superfícies claras translúcidas com o mesmo neon esmeralda." },
];

export function PlatformThemePicker({ className }: { className?: string }) {
  const { mode, setMode } = useAccentTheme();

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)} role="group" aria-label="Modo de leitura da plataforma">
      {MODES.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-pressed={active}
            className="gd-theme-swatch"
          >
            <span className={`gd-theme-swatch-preview gd-theme-swatch-preview-${option.value}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="flex min-w-0 items-start gap-2">
              <span className="min-w-0 grow">
                <b className="block text-sm">{option.label}</b>
                <small className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</small>
              </span>
              {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
