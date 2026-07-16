/* saved_table_views is available after the additive automation migration. */
import { Columns3, Layers3, Save, SlidersHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  campaignColumnLabels, editableCampaignColumns, getBreakdownLabel, getMetaColumnPreset, metaBreakdownGroups,
  metaColumnPresets, type CampaignColumnKey, type MetaColumnPresetKey,
} from "@/lib/metaTableConfig";

export function MetaTableControls({ preset, columns, breakdown, onPreset, onColumns, onBreakdown }: { preset: MetaColumnPresetKey; columns: Set<CampaignColumnKey>; breakdown: string; onPreset: (value: MetaColumnPresetKey) => void; onColumns: (value: Set<CampaignColumnKey>) => void; onBreakdown: (value: string) => void }) {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: savedViews = [] } = useQuery({
    queryKey: ["saved-table-views", workspace?.id, user?.id, "campaigns"], enabled: !!workspace?.id && !!user?.id && !workspace?.id.startsWith("legacy-"),
    queryFn: async () => { const { data, error } = await (supabase as any).from("saved_table_views").select("id,name,config,is_shared").eq("workspace_id", workspace!.id).eq("scope", "campaigns").order("name"); if (error) { if (error.code === "42P01" || /saved_table_views|schema cache|does not exist/i.test(error.message)) return []; throw error; } return data ?? []; },
  });
  const saveView = useMutation({
    mutationFn: async () => { if (!workspace || !user || workspace.id.startsWith("legacy-")) throw new Error("Aplique as migrations do workspace para salvar na nuvem."); const name = window.prompt("Nome desta visualização:", "Minha visualização"); if (!name?.trim()) return false; const { error } = await (supabase as any).from("saved_table_views").upsert({ workspace_id: workspace.id, user_id: user.id, name: name.trim(), scope: "campaigns", is_shared: false, config: { preset, columns: Array.from(columns), breakdown } }, { onConflict: "workspace_id,user_id,scope,name" }); if (error) throw error; return true; },
    onSuccess: (saved) => { if (!saved) return; queryClient.invalidateQueries({ queryKey: ["saved-table-views"] }); toast({ title: "Visualização salva" }); },
    onError: (error: Error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });
  const selectPreset = (value: MetaColumnPresetKey) => { const selected = getMetaColumnPreset(value); onPreset(value); onColumns(new Set(selected.columns)); };
  const selectSaved = (item: any) => { const config = item.config ?? {}; if (config.preset) onPreset(config.preset); if (Array.isArray(config.columns)) onColumns(new Set(config.columns)); if (config.breakdown) onBreakdown(config.breakdown); toast({ title: `Visualização “${item.name}” aplicada` }); };
  const toggle = (column: CampaignColumnKey, checked: boolean) => { const next = new Set(columns); if (checked) next.add(column); else next.delete(column); onColumns(next); };
  return <div className="flex flex-wrap items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 bg-background"><Columns3 className="h-4 w-4" />Colunas: pré-definidas</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[75vh] w-[330px] overflow-y-auto">
        <DropdownMenuLabel>Predefinições da Meta</DropdownMenuLabel>
        {metaColumnPresets.map((item) => <DropdownMenuItem key={item.id} onSelect={() => selectPreset(item.id)} className="flex-col items-start"><span className="text-xs font-bold">{item.label}</span><span className="text-[10px] text-muted-foreground">{item.description}</span></DropdownMenuItem>)}
        {savedViews.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel>Minhas visualizações</DropdownMenuLabel>{savedViews.map((item: any) => <DropdownMenuItem key={item.id} onSelect={() => selectSaved(item)}><span className="text-xs font-bold">{item.name}</span></DropdownMenuItem>)}</>}
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 bg-background"><SlidersHorizontal className="h-4 w-4" />Personalizar colunas</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[75vh] w-[330px] overflow-y-auto">
        <DropdownMenuLabel>Colunas exibidas</DropdownMenuLabel>
        {editableCampaignColumns.map((column) => <DropdownMenuCheckboxItem key={column} checked={columns.has(column)} onCheckedChange={(checked) => toggle(column, checked === true)} onSelect={(event) => event.preventDefault()} className="text-xs">{campaignColumnLabels[column]}</DropdownMenuCheckboxItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2"><Layers3 className="h-3.5 w-3.5" />Detalhamento: {getBreakdownLabel(breakdown)}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={breakdown} onValueChange={onBreakdown}>{metaBreakdownGroups.map((group) => <div key={group.label}><DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>{group.items.map((item) => <DropdownMenuRadioItem key={item.id} value={item.id} className="text-xs">{item.label}</DropdownMenuRadioItem>)}</div>)}</DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => saveView.mutate()} disabled={saveView.isPending}><Save className="mr-2 h-4 w-4" />{saveView.isPending ? "Salvando…" : "Salvar visualização"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
