import { Columns3, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  campaignColumnLabels, editableCampaignColumns, getBreakdownLabel, getMetaColumnPreset, metaBreakdownGroups,
  metaColumnPresets, type CampaignColumnKey, type MetaColumnPresetKey,
} from "@/lib/metaTableConfig";

export function MetaTableControls({ preset, columns, breakdown, onPreset, onColumns, onBreakdown }: { preset: MetaColumnPresetKey; columns: Set<CampaignColumnKey>; breakdown: string; onPreset: (value: MetaColumnPresetKey) => void; onColumns: (value: Set<CampaignColumnKey>) => void; onBreakdown: (value: string) => void }) {
  const selectPreset = (value: MetaColumnPresetKey) => { const selected = getMetaColumnPreset(value); onPreset(value); onColumns(new Set(selected.columns)); };
  const toggle = (column: CampaignColumnKey, checked: boolean) => { const next = new Set(columns); if (checked) next.add(column); else next.delete(column); onColumns(next); };
  return <div className="flex flex-wrap items-center gap-2">
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 bg-background"><Columns3 className="h-4 w-4" />Colunas: {getMetaColumnPreset(preset).label}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[75vh] w-[330px] overflow-y-auto"><DropdownMenuLabel>Predefinições da Meta</DropdownMenuLabel>{metaColumnPresets.map((item) => <DropdownMenuItem key={item.id} onSelect={() => selectPreset(item.id)} className="flex-col items-start"><span className="text-xs font-bold">{item.label}</span><span className="text-[10px] text-muted-foreground">{item.description}</span></DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuLabel>Personalizar colunas</DropdownMenuLabel>{editableCampaignColumns.map((column) => <DropdownMenuCheckboxItem key={column} checked={columns.has(column)} onCheckedChange={(checked) => toggle(column, checked === true)} onSelect={(event) => event.preventDefault()} className="text-xs">{campaignColumnLabels[column]}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 bg-background"><Layers3 className="h-4 w-4" />Detalhamento: {getBreakdownLabel(breakdown)}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[75vh] w-[300px] overflow-y-auto"><DropdownMenuRadioGroup value={breakdown} onValueChange={onBreakdown}>{metaBreakdownGroups.map((group) => <div key={group.label}><DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>{group.items.map((item) => <DropdownMenuRadioItem key={item.id} value={item.id} className="text-xs">{item.label}{item.id !== "none" && <span className="ml-auto text-[8px] text-amber-600">requer breakdown</span>}</DropdownMenuRadioItem>)}</div>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
  </div>;
}
