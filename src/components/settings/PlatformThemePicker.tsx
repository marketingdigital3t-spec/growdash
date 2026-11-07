import { Check } from "lucide-react";
import { PLATFORM_THEMES, useAccentTheme } from "@/hooks/useAccentTheme";
import { cn } from "@/lib/utils";

/**
 * Theme picker for the platform visual contract.
 *
 * Obsidian (violet neon over cosmic black) and Esmeralda (pure green over
 * translucent glass) are the two supported platform palettes. Each palette
 * works in both light and dark mode.
 */
export function PlatformThemePicker({ className }: { className?: string }) {
  const { accent, setAccent } = useAccentTheme();

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)} role="group" aria-label="Cor da plataforma">
      {PLATFORM_THEMES.map((theme) => {
        const active = accent === theme.value;
        return (
          <button
            key={theme.value}
            type="button"
            onClick={() => setAccent(theme.value)}
            aria-pressed={active}
            className="gd-theme-swatch"
          >
            <span className={`gd-theme-swatch-preview gd-theme-swatch-preview-${theme.value}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="flex min-w-0 items-start gap-2">
              <span className="min-w-0 grow">
                <b className="block text-sm">{theme.label}</b>
                <small className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{theme.description}</small>
              </span>
              {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
