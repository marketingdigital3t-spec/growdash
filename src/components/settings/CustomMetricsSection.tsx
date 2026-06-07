import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Star, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  useCustomMetrics,
  useUpsertCustomMetric,
  useDeleteCustomMetric,
  useAvailableActions,
  friendlyActionLabel,
  type CustomMetric,
  type CustomMetricKind,
  type CustomMetricFormat,
} from "@/hooks/useCustomMetrics";
import { HowToSyncSteps } from "./HowToSyncSteps";
import {
  useAccountPixels,
  useAccountLpConfigs,
  useUpdateAccountLpConfig,
  useSyncMetaPixels,
} from "@/hooks/useAccountPixels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useToast } from "@/hooks/use-toast";

export function CustomMetricsSection() {
  const { data: metrics = [] } = useCustomMetrics();
  const { data: actions = [] } = useAvailableActions();
  const { data: pixelData } = useAccountPixels();
  const { data: lpConfigs = {} } = useAccountLpConfigs();
  const updateLp = useUpdateAccountLpConfig();
  const syncPixels = useSyncMetaPixels();
  const { data: adAccounts = [] } = useAdAccounts();
  const upsert = useUpsertCustomMetric();
  const del = useDeleteCustomMetric();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CustomMetric> | null>(null);

  const startNew = () =>
    setEditing({ name: "", kind: "count", format: "number", is_default_lead: false });
  const startEdit = (m: CustomMetric) => setEditing({ ...m });

  const save = async () => {
    if (!editing?.name || !editing.kind) return;
    if (editing.kind !== "rate" && !editing.numerator_action) {
      toast({ title: "Selecione o evento principal", variant: "destructive" });
      return;
    }
    if (editing.kind === "rate" && (!editing.numerator_action || (!editing.denominator_action && !editing.denominator_field))) {
      toast({ title: "Selecione numerador e denominador", variant: "destructive" });
      return;
    }
    const fmt: CustomMetricFormat =
      editing.kind === "cost_per" ? "currency" : editing.kind === "rate" ? "percent" : "number";
    await upsert.mutateAsync({ ...(editing as any), format: fmt });
    setEditing(null);
    setOpen(false);
    toast({ title: "Métrica salva" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Métricas personalizadas</CardTitle>
          <CardDescription>
            Configure como cada conta mede leads — igual ao Gerenciador do Meta Ads.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncPixels.mutate(undefined)}
            disabled={syncPixels.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncPixels.isPending ? "animate-spin" : ""}`} />
            Atualizar pixels
          </Button>
          <Button size="sm" onClick={() => { startNew(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova métrica
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {adAccounts.length > 0 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Eventos de lead por conta</p>
              <p className="text-xs text-muted-foreground">
                <strong>Formulário Instantâneo</strong> é detectado automaticamente da Meta.{" "}
                Para <strong>Landing Page</strong>, escolha o pixel e o evento de conversão (igual ao Meta Ads).{" "}
                Mensagens são contadas automaticamente em campanhas de mensagens.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {adAccounts.map((acc: any) => {
                const pixels = pixelData?.byAccount?.[acc.id] || [];
                const cfg = lpConfigs[acc.id];
                const selectedPixelId = cfg?.pixel_id || "";
                const events = selectedPixelId ? (pixelData?.eventsByPixel?.[selectedPixelId] || []) : [];
                const selectedEvent = cfg?.action_type || "";

                return (
                  <div key={acc.id} className="rounded-lg border p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium truncate">{acc.name}</p>
                      <p className="text-[11px] text-muted-foreground">act_{acc.account_id}</p>
                    </div>

                    {/* Native form: automatic */}
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-foreground">Formulário Instantâneo</span>
                      <Badge variant="secondary" className="text-[10px]">automático</Badge>
                    </div>

                    {/* LP: pixel + event */}
                    <div className="space-y-2">
                      <Label className="text-xs">Landing Page (Site / Pixel)</Label>
                      {pixels.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">
                          Nenhum pixel encontrado. Clique em "Atualizar pixels" no topo.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Conjunto de dados (Pixel)</p>
                            <Select
                              value={selectedPixelId}
                              onValueChange={(v) =>
                                updateLp.mutate({ ad_account_id: acc.id, pixel_id: v, action_type: null })
                              }
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Selecionar conjunto de dados" />
                              </SelectTrigger>
                              <SelectContent>
                                {pixels.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Evento de conversão</p>
                            <Select
                              value={selectedEvent}
                              disabled={!selectedPixelId}
                              onValueChange={(v) =>
                                updateLp.mutate({
                                  ad_account_id: acc.id,
                                  pixel_id: selectedPixelId,
                                  action_type: v,
                                })
                              }
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue
                                  placeholder={selectedPixelId ? "Selecionar evento" : "Escolha o pixel primeiro"}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {events.length === 0 && (
                                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                                    Nenhum evento detectado neste pixel.
                                  </div>
                                )}
                                {events.map((e) => (
                                  <SelectItem key={e.id} value={e.action_type} className="text-xs">
                                    {e.event_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      {cfg?.action_type && (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateLp.mutate({ ad_account_id: acc.id, pixel_id: null, action_type: null })
                          }
                        >
                          Limpar configuração
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma métrica definida. Use "Nova métrica" para criar.
          </p>
        ) : (
          <div className="rounded-lg border divide-y">
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {m.kind === "count" ? "Contagem" : m.kind === "cost_per" ? "Custo por" : "Taxa %"}
                    </Badge>
                    {m.is_default_lead && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                        <Star className="h-3 w-3 mr-1" /> Lead padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {friendlyActionLabel(m.numerator_action || "")}
                    {m.kind === "rate" && (
                      <> ÷ {m.denominator_action ? friendlyActionLabel(m.denominator_action) : m.denominator_field}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { startEdit(m); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar métrica" : "Nova métrica"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Concluiu Forms" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as CustomMetricKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Contagem do evento</SelectItem>
                    <SelectItem value="cost_per">Custo por evento (gasto ÷ evento)</SelectItem>
                    <SelectItem value="rate">Taxa de conversão (evento ÷ outro evento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Evento principal {editing.kind === "rate" ? "(numerador)" : ""}</Label>
                <Select
                  value={editing.numerator_action || ""}
                  onValueChange={(v) => setEditing({ ...editing, numerator_action: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {actions.map((a) => (
                      <SelectItem key={a.action_type} value={a.action_type}>
                        {friendlyActionLabel(a.action_type)} · {a.total.toFixed(0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.kind === "rate" && (
                <div>
                  <Label>Denominador</Label>
                  <Select
                    value={editing.denominator_action || (editing.denominator_field ? `field:${editing.denominator_field}` : "")}
                    onValueChange={(v) => {
                      if (v.startsWith("field:")) {
                        setEditing({ ...editing, denominator_field: v.slice(6), denominator_action: null });
                      } else {
                        setEditing({ ...editing, denominator_action: v, denominator_field: null });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um denominador" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="field:impressions">Impressões</SelectItem>
                      <SelectItem value="field:clicks">Cliques</SelectItem>
                      {actions.map((a) => (
                        <SelectItem key={a.action_type} value={a.action_type}>
                          {friendlyActionLabel(a.action_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.kind === "count" && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Usar como "Lead" padrão</p>
                    <p className="text-xs text-muted-foreground">Substitui o card "Leads" e o CPL global.</p>
                  </div>
                  <Switch
                    checked={!!editing.is_default_lead}
                    onCheckedChange={(v) => setEditing({ ...editing, is_default_lead: v })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
