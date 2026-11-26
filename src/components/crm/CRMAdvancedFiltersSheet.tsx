import React, { useState } from "react";
import { Calendar as CalendarIcon, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { CRMAdvancedFilterState } from "@/lib/crmAdvancedFilters";
import { countActiveAdvancedFilters } from "@/lib/crmAdvancedFilters";

function CRMDateRangePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: { start: string | null; end: string | null };
  onChange: (val: { start: string | null; end: string | null } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasRange = Boolean(value?.start || value?.end);

  const selectedRange: DateRange | undefined = value?.start
    ? {
        from: parseISO(value.start),
        to: value.end ? parseISO(value.end) : undefined,
      }
    : undefined;

  const formattedLabel = (() => {
    if (!value?.start) return "Selecionar período no calendário…";
    const s = format(parseISO(value.start), "dd/MM/yyyy", { locale: ptBR });
    if (!value.end) return `A partir de ${s}`;
    const e = format(parseISO(value.end), "dd/MM/yyyy", { locale: ptBR });
    return `${s} – ${e}`;
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground">{label}</Label>
        {hasRange && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`w-full justify-start text-left text-xs font-medium h-10 gap-2.5 border-border ${
              hasRange ? "border-primary/50 text-foreground bg-primary/5" : "text-muted-foreground"
            }`}
          >
            <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate font-mono text-[11px]">{formattedLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0 border border-border bg-card shadow-2xl z-[220]">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={(range) => {
              if (!range) {
                onChange(null);
                return;
              }
              const startStr = range.from ? format(range.from, "yyyy-MM-dd") : null;
              const endStr = range.to ? format(range.to, "yyyy-MM-dd") : startStr;
              onChange({ start: startStr, end: endStr });
              if (range.from && range.to) {
                setOpen(false);
              }
            }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface CRMAdvancedFiltersSheetProps {
  filters: CRMAdvancedFilterState;
  onApplyFilters: (filters: CRMAdvancedFilterState) => void;
  availableCampaigns: string[];
  availableSources: string[];
  availableProducts: string[];
  triggerClassName?: string;
}

export function CRMAdvancedFiltersSheet({
  filters,
  onApplyFilters,
  availableCampaigns,
  availableSources,
  availableProducts,
  triggerClassName,
}: CRMAdvancedFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CRMAdvancedFilterState>(filters);

  const activeCount = countActiveAdvancedFilters(filters);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(filters);
    }
    setOpen(isOpen);
  };

  const handleApply = () => {
    onApplyFilters(draft);
    setOpen(false);
  };

  const handleClear = () => {
    const empty: CRMAdvancedFilterState = {};
    setDraft(empty);
    onApplyFilters(empty);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={triggerClassName || "h-11 gap-2 border-border/80 bg-background/50 text-xs font-semibold"}
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md border-l border-border bg-background shadow-2xl"
      >
        {/* Cabeçalho espelho do RD Station */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4 space-y-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg font-black text-foreground">
              Filtros
            </SheetTitle>
            {activeCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary/20 px-1.5 text-xs font-bold text-primary">
                {activeCount}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Corpo com scroll dos filtros */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 1. Faixa de Valor */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Valor da negociação</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="R$ Mínimo"
                  value={draft.minValue ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      minValue: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="h-10 text-xs"
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">até</span>
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="R$ Máximo"
                  value={draft.maxValue ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      maxValue: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="h-10 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Data de criação com seletor de intervalo no calendário */}
          <CRMDateRangePickerField
            label="Data de criação"
            value={draft.createdAt}
            onChange={(val) => setDraft((prev) => ({ ...prev, createdAt: val }))}
          />

          {/* 3. Data de fechamento (Ganhos/Perdidos) com seletor de intervalo */}
          <CRMDateRangePickerField
            label="Data de fechamento (Ganhos/Perdidos)"
            value={draft.closedAt}
            onChange={(val) => setDraft((prev) => ({ ...prev, closedAt: val }))}
          />

          {/* 4. Data de último contato / movimentação com seletor de intervalo */}
          <CRMDateRangePickerField
            label="Data de último contato / movimentação"
            value={draft.lastContactAt}
            onChange={(val) => setDraft((prev) => ({ ...prev, lastContactAt: val }))}
          />

          {/* 5. Campanha */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Campanha</Label>
            <select
              aria-label="Filtrar por campanha"
              value={draft.campaign ?? "all"}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  campaign: e.target.value === "all" ? null : e.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas as campanhas</option>
              {availableCampaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Fonte */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Fonte / Origem</Label>
            <select
              aria-label="Filtrar por fonte"
              value={draft.source ?? "all"}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  source: e.target.value === "all" ? null : e.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas as fontes</option>
              {availableSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 7. Produto ou serviço */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Produto ou serviço</Label>
            <select
              aria-label="Filtrar por produto ou serviço"
              value={draft.product ?? "all"}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  product: e.target.value === "all" ? null : e.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos os produtos</option>
              {availableProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rodapé fixo com ações espelho do RD Station */}
        <div className="flex items-center gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="flex-1 h-11 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Limpar filtros
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="flex-1 h-11 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Aplicar filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
