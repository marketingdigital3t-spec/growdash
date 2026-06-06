import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CampaignOption {
  id: string;
  name: string;
}

interface Props {
  campaigns: CampaignOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CampaignMultiSelect({
  campaigns,
  selectedIds,
  onChange,
  placeholder = "Todas campanhas",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => c.name.toLowerCase().includes(q));
  }, [campaigns, search]);

  const allSelected = selectedIds.length === 0;
  const triggerLabel = allSelected
    ? placeholder
    : selectedIds.length === 1
    ? campaigns.find((c) => c.id === selectedIds[0])?.name ?? "1 campanha"
    : `${selectedIds.length} campanhas`;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const selectAllVisible = () =>
    onChange(Array.from(new Set([...selectedIds, ...filtered.map((c) => c.id)])));
  const clearAll = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("bg-card font-normal justify-between min-w-[220px]", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {!allSelected && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {selectedIds.length}
              </Badge>
            )}
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] max-w-[calc(100vw-2rem)] p-0"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <div className="sticky top-0 z-10 bg-popover border-b">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar campanha..."
                className="h-9 pl-7 pr-7"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="px-2 py-1.5 flex items-center justify-between text-xs">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectAllVisible}
              className="text-primary hover:underline disabled:opacity-50"
              disabled={filtered.length === 0}
            >
              Selecionar visíveis ({filtered.length})
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
              className="text-muted-foreground hover:underline disabled:opacity-50"
              disabled={selectedIds.length === 0}
            >
              Limpar ({selectedIds.length})
            </button>
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          <div className="p-1 pr-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma campanha encontrada
              </div>
            ) : (
              filtered.map((c) => {
                const checked = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(c.id)}
                    title={c.name}
                    className={cn(
                      "w-full flex items-start gap-2 px-2 py-2 rounded text-sm text-left hover:bg-accent transition-colors",
                      checked && "bg-accent/50",
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 mt-0.5 rounded border flex items-center justify-center shrink-0",
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="leading-snug break-words line-clamp-2 flex-1">{c.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
