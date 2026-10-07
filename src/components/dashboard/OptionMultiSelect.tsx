import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

export function OptionMultiSelect({ options, selectedIds, onChange, emptyLabel, ariaLabel }: { options: Option[]; selectedIds: string[]; onChange: (ids: string[]) => void; emptyLabel: string; ariaLabel: string }) {
  const label = selectedIds.length === 0 ? emptyLabel : selectedIds.length === 1 ? options.find((option) => option.id === selectedIds[0])?.name || "1 selecionado" : `${selectedIds.length} selecionados`;
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  return <Popover><PopoverTrigger asChild><Button type="button" variant="outline" aria-label={ariaLabel} className="h-10 min-w-[190px] justify-between border-white/10 bg-[#0b172c] text-xs font-bold text-slate-100 hover:bg-[#12213b]"><span className="truncate">{label}</span><ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" /></Button></PopoverTrigger><PopoverContent className="w-[280px] border-white/10 bg-[#0b172c] p-1 text-slate-100"><button type="button" onClick={() => onChange([])} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-slate-300 hover:bg-white/10">{emptyLabel}{selectedIds.length === 0 && <Check className="h-3.5 w-3.5 text-[#f6c94c]" />}</button>{options.map((option) => { const checked = selectedIds.includes(option.id); return <button key={option.id} type="button" onClick={() => toggle(option.id)} className={cn("flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-white/10", checked && "bg-white/10")}>{option.name}<span className={cn("grid h-4 w-4 place-items-center rounded border", checked ? "border-[#f6c94c] bg-[#d9a928] text-[#111728]" : "border-white/20")}>{checked && <Check className="h-3 w-3" />}</span></button>; })}</PopoverContent></Popover>;
}
