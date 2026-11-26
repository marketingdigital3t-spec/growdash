import { useState } from "react";
import { Check, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Legacy alias kept for compatibility with other imports.
export type FunnelStep = string;

interface StepOption {
  key: string;
  label: string;
}

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  options: StepOption[];
}

export function FunnelStepsSelect({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const allKeys = options.map((o) => o.key);

  const toggle = (s: string) => {
    if (value.includes(s)) {
      if (value.length <= 2) return;
      onChange(value.filter((x) => x !== s));
    } else {
      onChange(allKeys.filter((x) => value.includes(x) || x === s));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs bg-card font-normal">
          <Filter className="h-3.5 w-3.5" />
          <span>Métricas do funil</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{value.length}</Badge>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-1" align="end">
        {options.map((o) => {
          const checked = value.includes(o.key);
          const disabled = checked && value.length <= 2;
          return (
            <button
              key={o.key}
              onClick={() => toggle(o.key)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                checked && "bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
                )}
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
              <span>{o.label}</span>
            </button>
          );
        })}
        <p className="text-[10px] text-muted-foreground px-2 py-1.5 border-t mt-1">Mínimo 2 etapas</p>
      </PopoverContent>
    </Popover>
  );
}
