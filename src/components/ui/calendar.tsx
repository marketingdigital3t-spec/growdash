import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
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
        day: cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 rounded-full p-0 font-medium text-foreground aria-selected:opacity-100 hover:bg-muted"),
        day_range_start: "rounded-l-full bg-muted",
        day_range_end: "rounded-r-full bg-muted",
        day_selected:
          "rounded-full bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black dark:bg-white dark:text-black",
        day_today: "font-bold underline decoration-white/60 underline-offset-4",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "rounded-none bg-white/10 text-foreground aria-selected:bg-white/10 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
