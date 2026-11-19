import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function CalendarCaption({
  month,
  onMonthChange,
  fromYear,
  toYear,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  fromYear: number;
  toYear: number;
}) {
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index);
  return (
    <div className="flex items-center justify-center gap-2">
      <Select
        value={String(month.getMonth())}
        onValueChange={(value) => {
          onMonthChange(new Date(month.getFullYear(), Number(value), 1));
        }}
      >
        <SelectTrigger
          aria-label="Selecionar mês"
          className="h-8 w-[8.5rem] border-border/80 bg-background/70 text-xs font-semibold"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="crm-filter-popover z-[260]">
          {MONTH_LABELS.map((label, index) => (
            <SelectItem key={label} value={String(index)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(month.getFullYear())}
        onValueChange={(value) => {
          onMonthChange(new Date(Number(value), month.getMonth(), 1));
        }}
      >
        <SelectTrigger
          aria-label="Selecionar ano"
          className="h-8 w-[6rem] border-border/80 bg-background/70 text-xs font-semibold"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="crm-filter-popover z-[260]">
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const fromYear = props.fromYear ?? 2020;
  const toYear = props.toYear ?? new Date().getFullYear() + 1;
  const [captionMonth, setCaptionMonth] = React.useState<Date>(
    () => props.month ?? props.defaultMonth ?? new Date(),
  );

  React.useEffect(() => {
    if (props.month) setCaptionMonth(props.month);
  }, [props.month]);

  const handleMonthChange = React.useCallback((next: Date) => {
    setCaptionMonth(next);
    props.onMonthChange?.(next);
  }, [props.onMonthChange]);

  // O `captionLayout="dropdown"` do react-day-picker renderiza <select> nativo.
  // O popup nativo do sistema abre por cima do calendário, cobre a tabela de
  // dias e não pode ser estilizado pela paleta da plataforma. Substituímos
  // pelo caption próprio com <Select> do Radix, que abre dentro do popover.
  const { captionLayout: _ignoredCaptionLayout, ...dayPickerProps } = props;

  return (
    <DayPicker
      {...dayPickerProps}
      showOutsideDays={showOutsideDays}
      captionLayout="label"
      fromYear={fromYear}
      toYear={toYear}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-6 sm:flex-row sm:gap-5",
        month: "space-y-3",
        caption: "relative flex h-9 items-center justify-center border-b border-border/70 pb-2",
        caption_label: "text-sm font-bold tracking-tight",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 border-0 bg-transparent p-0 text-muted-foreground opacity-100 shadow-none hover:bg-muted hover:text-foreground",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "w-9 rounded-md text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        row: "mt-1.5 flex w-full",
        cell: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        // DayPicker cells are data controls, not action buttons. Do not use
        // the shared `premium-button` variant here: its global metallic skin
        // paints every day in the range and creates the large blue/white bars.
        day: "inline-flex h-8 w-8 items-center justify-center rounded-none border-0 bg-transparent p-0 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100",
        day_range_start: "rdp-day_range_start day-range-start rounded-full",
        day_range_end: "rdp-day_range_end day-range-end rounded-full",
        day_selected:
          "rounded-full bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black dark:bg-white dark:text-black",
        day_today: "rdp-day_today day-today font-bold underline decoration-white/60 underline-offset-4",
        day_outside:
          "rdp-day_outside day-outside text-muted-foreground opacity-100 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "rdp-day_range_middle day-range-middle rounded-none bg-white/10 text-foreground aria-selected:bg-white/10 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Caption: ({ calendarMonth }: { calendarMonth?: Date }) => (
          <CalendarCaption
            month={calendarMonth ?? captionMonth}
            onMonthChange={handleMonthChange}
            fromYear={fromYear}
            toYear={toYear}
          />
        ),
      }}
      locale={props.locale ?? ptBR}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
