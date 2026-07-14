import { useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import {
  useRDFieldConfigs,
  useSaveRDFieldConfig,
  useDeleteRDFieldConfig,
  type RDFieldConfig,
  type RDFieldOption,
} from "@/hooks/useRDFieldConfigs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag, RefreshCw, Sliders } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function RDCustomFieldsCard() {
  const { data: accounts = [] } = useAdAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const effectiveAccount = accountId || accounts[0]?.id || "";
  const { data: configs = [], isLoading, refetch } = useRDFieldConfigs(effectiveAccount);
  const save = useSaveRDFieldConfig();
  const del = useDeleteRDFieldConfig();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [editingRanges, setEditingRanges] = useState<RDFieldConfig | null>(null);
  const [rangeDraft, setRangeDraft] = useState<RDFieldOption[]>([]);

  const handleDiscover = async () => {
    if (!effectiveAccount) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-discover-fields", {
        body: { ad_account_id: effectiveAccount },
      });
      if (error) throw error;
      const d: any = data || {};
      toast({
        title: "Campos sincronizados do RD",
        description: `${d.discovered ?? 0} encontrados · ${d.created ?? 0} novos · ${d.updated ?? 0} atualizados${d.had_token === false ? " (sem token do RD configurado — usado apenas histórico de deals)" : ""}`,
      });
      await refetch();
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleShow = async (cfg: RDFieldConfig, show: boolean) => {
    try {
      await save.mutateAsync({ id: cfg.id, ad_account_id: cfg.ad_account_id, show_in_dashboard: show } as any);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const openRanges = (cfg: RDFieldConfig) => {
    setEditingRanges(cfg);
    setRangeDraft(cfg.options.length ? [...cfg.options] : [{ label: "", min: null, max: null }]);
  };

  const saveRanges = async () => {
    if (!editingRanges) return;
    const clean = rangeDraft.filter((o) => (o.label || "").trim() !== "");
    try {
      await save.mutateAsync({
        id: editingRanges.id,
        ad_account_id: editingRanges.ad_account_id,
        options: clean,
      } as any);
      toast({ title: "Faixas salvas" });
      setEditingRanges(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" /> Campos personalizados do RD
        </CardTitle>
        <CardDescription>
          Os campos são descobertos automaticamente direto do RD Station. Escolha quais aparecem no dashboard;
          para campos numéricos, defina as faixas que farão sentido para o seu negócio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between">
          <div className="flex-1 max-w-sm">
            <Label className="text-xs">Conta</Label>
            <Select value={effectiveAccount} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleDiscover} disabled={!effectiveAccount || syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar campos do RD"}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : configs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum campo encontrado. Clique em <strong>Sincronizar campos do RD</strong> para descobrir
              automaticamente os campos personalizados desta conta.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{c.label}</p>
                    <Badge variant="secondary" className="text-[10px]">{c.field_type === "number" ? "numérico" : "opções"}</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.rd_source}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.field_type === "number"
                      ? `${c.options.filter((o) => o.min != null || o.max != null).length} faixa(s) definidas`
                      : `${c.options.length} opção(ões) do RD`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.field_type === "number" && (
                    <Button variant="outline" size="sm" onClick={() => openRanges(c)}>
                      <Sliders className="h-3.5 w-3.5 mr-1" /> Faixas
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`show-${c.id}`} className="text-xs text-muted-foreground hidden sm:inline">
                      Dashboard
                    </Label>
                    <Switch
                      id={`show-${c.id}`}
                      checked={c.show_in_dashboard}
                      onCheckedChange={(v) => toggleShow(c, v)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Remover "${c.label}"? Será recriado na próxima sincronização se ainda existir no RD.`)) {
                        del.mutate(c.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Após habilitar campos, rode a sincronização do RD em <strong>Saúde dos Dados</strong> para preencher
          retroativamente os valores em deals e vendas.
        </p>
      </CardContent>

      <Dialog open={!!editingRanges} onOpenChange={(o) => !o && setEditingRanges(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Faixas — {editingRanges?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Defina os intervalos numéricos que serão usados para agrupar os valores no gráfico.
            Deixe <em>min</em> ou <em>max</em> em branco para "sem limite".
          </p>
          <div className="space-y-2 max-h-80 overflow-auto">
            {rangeDraft.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...rangeDraft];
                    next[idx] = { ...opt, label: e.target.value };
                    setRangeDraft(next);
                  }}
                  placeholder="Ex: 100k a 500k"
                />
                <Input
                  type="number"
                  className="w-28"
                  value={opt.min ?? ""}
                  onChange={(e) => {
                    const next = [...rangeDraft];
                    next[idx] = { ...opt, min: e.target.value === "" ? null : Number(e.target.value) };
                    setRangeDraft(next);
                  }}
                  placeholder="min"
                />
                <Input
                  type="number"
                  className="w-28"
                  value={opt.max ?? ""}
                  onChange={(e) => {
                    const next = [...rangeDraft];
                    next[idx] = { ...opt, max: e.target.value === "" ? null : Number(e.target.value) };
                    setRangeDraft(next);
                  }}
                  placeholder="max"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRangeDraft(rangeDraft.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRangeDraft([...rangeDraft, { label: "", min: null, max: null }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRanges(null)}>Cancelar</Button>
            <Button onClick={saveRanges} disabled={save.isPending}>Salvar faixas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
