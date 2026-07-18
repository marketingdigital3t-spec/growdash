import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DatePreset, PRESET_LABELS, resolvePreset } from "@/hooks/useDateFilter";

interface Props {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customRange: { from: Date; to: Date };
  onCustomRangeChange: (range: { from: Date; to: Date }) => void;
  startDate: Date;
  endDate: Date;
  className?: string;
}

const PRESET_ORDER: DatePreset[] = [
  "today_yesterday",
  "today",
  "yesterday",
  "7days",
  "last_14_days",
  "last_28_days",
  "30days",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "max",
  "custom",
];

function formatTrigger(preset: DatePreset, start: Date, end: Date) {
  const sameDay = start.toDateString() === end.toDateString();
  const label = PRESET_LABELS[preset];
  if (sameDay) {
    return `${label}: ${format(start, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
  }
  return `${label}: ${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
}

export function MetaDateRangePicker({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  startDate,
  endDate,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<DatePreset>(preset);
  const [pendingRange, setPendingRange] = useState<{ from: Date; to: Date }>({
    from: startDate,
    to: endDate,
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePreset, setComparePreset] = useState<DatePreset>("yesterday");

  useEffect(() => {
    if (open) {
      setPendingPreset(preset);
      setPendingRange({ from: startDate, to: endDate });
    }
  }, [open, preset, startDate, endDate]);

  const handlePresetClick = (p: DatePreset) => {
    setPendingPreset(p);
    if (p !== "custom") {
      const resolved = resolvePreset(p, customRange);
      setPendingRange({ from: resolved.startDate, to: resolved.endDate });
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setPendingRange({ from: range.from, to: range.to ?? range.from });
      setPendingPreset("custom");
    }
  };

  const handleApply = () => {
    onPresetChange(pendingPreset);
    if (pendingPreset === "custom") {
      onCustomRangeChange(pendingRange);
    }
    setOpen(false);
  };

  const compareRange = compareEnabled ? resolvePreset(comparePreset, customRange) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-h-11 w-full min-w-0 justify-start bg-card font-normal sm:h-10 sm:min-h-0 sm:w-auto",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{formatTrigger(preset, startDate, endDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[95vw]" align="start">
        <div className="flex flex-col md:flex-row">
          {/* Presets */}
          <ScrollArea className="md:w-56 border-b md:border-b-0 md:border-r max-h-[50vh] md:max-h-[480px]">
            <div className="p-3 space-y-1">
              {PRESET_ORDER.map((p) => {
                const active = pendingPreset === p;
                return (
                  <button
                    key={p}
                    onClick={() => handlePresetClick(p)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors hover:bg-accent",
                      active && "bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0",
                        active ? "border-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </span>
                    <span>{PRESET_LABELS[p]}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Calendar + compare + footer */}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              numberOfMonths={typeof window !== "undefined" && window.innerWidth < 768 ? 1 : 2}
              selected={{ from: pendingRange.from, to: pendingRange.to }}
              onSelect={handleCalendarSelect}
              locale={ptBR}
              weekStartsOn={1}
              className="p-3 pointer-events-auto"
            />

            <div className="px-4 pb-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="compare"
                  checked={compareEnabled}
                  onCheckedChange={(v) => setCompareEnabled(!!v)}
                />
                <label htmlFor="compare" className="text-sm cursor-pointer">
                  Comparar
                </label>
              </div>

              {compareEnabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={comparePreset} onValueChange={(v) => setComparePreset(v as DatePreset)}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_ORDER.filter((p) => p !== "custom").map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRESET_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {compareRange && (
                    <span className="text-xs text-muted-foreground">
                      {format(compareRange.startDate, "d MMM", { locale: ptBR })} –{" "}
                      {format(compareRange.endDate, "d MMM yyyy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Fuso horário das datas: Horário de São Paulo
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Atualizar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
