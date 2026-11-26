import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

export function OptionMultiSelect({ options, selectedIds, onChange, emptyLabel, ariaLabel, popoverClassName, emptyMessage = "Nenhuma opção encontrada.", className }: { options: Option[]; selectedIds: string[]; onChange: (ids: string[]) => void; emptyLabel: string; ariaLabel: string; popoverClassName?: string; emptyMessage?: string; className?: string }) {
  const label = selectedIds.length === 0 ? emptyLabel : selectedIds.length === 1 ? options.find((option) => option.id === selectedIds[0])?.name || "1 selecionado" : `${selectedIds.length} selecionados`;
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  return <Popover><PopoverTrigger asChild><Button type="button" variant="outline" aria-label={ariaLabel} className={cn("h-10 min-w-[190px] justify-between border-border bg-background text-xs font-bold text-foreground hover:bg-muted", className)}><span className="truncate">{label}</span><ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" /></Button></PopoverTrigger><PopoverContent className={cn("z-[360] w-[280px] border-border bg-popover p-1 text-popover-foreground", popoverClassName)}><button type="button" onClick={() => onChange([])} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted">{emptyLabel}{selectedIds.length === 0 && <Check className="h-3.5 w-3.5 text-primary" />}</button>{options.length ? options.map((option) => { const checked = selectedIds.includes(option.id); return <button key={option.id} type="button" onClick={() => toggle(option.id)} className={cn("flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-muted", checked && "bg-muted")}>{option.name}<span className={cn("grid h-4 w-4 place-items-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{checked && <Check className="h-3 w-3" />}</span></button>; }) : <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">{emptyMessage}</p>}</PopoverContent></Popover>;
}
