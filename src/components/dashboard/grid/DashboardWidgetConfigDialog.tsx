import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { METRIC_LABELS, type WidgetConfig, type WidgetGroupBy, type WidgetMetric, type WidgetType } from "@/lib/widgetCatalog";

type ConfigurableWidget = { id: string; type: WidgetType; title: string; config?: WidgetConfig } | null;

const METRICS = Object.keys(METRIC_LABELS) as WidgetMetric[];
const GROUPS: Array<{ value: WidgetGroupBy; label: string }> = [
  { value: "date", label: "Data" },
  { value: "campaign", label: "Campanha" },
  { value: "ad", label: "Anúncio" },
  { value: "state", label: "Estado" },
  { value: "formation", label: "Turma" },
  { value: "product", label: "Produto" },
  { value: "payment", label: "Pagamento" },
];

function needsMetric(type: WidgetType) {
  return ["kpi", "line_chart", "bar_chart", "pie_chart", "top_ranking", "compare_period"].includes(type);
}

export function DashboardWidgetConfigDialog({ widget, open, onOpenChange, onSave }: {
  widget: ConfigurableWidget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { title: string; config: WidgetConfig }) => void;
}) {
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState<WidgetConfig>({});

  useEffect(() => {
    if (!widget) return;
    setTitle(widget.title || "Widget");
    setConfig({ ...(widget.config || {}) });
  }, [widget]);

  const metric = (config.metric || "leads") as WidgetMetric;
  const gridMetrics = useMemo(() => (config.metrics?.length ? config.metrics : ["spend", "leads", "cpl", "ctr"]) as WidgetMetric[], [config.metrics]);
  const set = (patch: Partial<WidgetConfig>) => setConfig((current) => ({ ...current, ...patch }));

  if (!widget) return null;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Configurar {widget.title || "widget"}</DialogTitle>
        <DialogDescription>Esta alteração afeta somente este bloco do dashboard.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <div className="space-y-2">
          <Label htmlFor="widget-title">Título</Label>
          <Input id="widget-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome exibido no dashboard" />
        </div>

        {needsMetric(widget.type) && <MetricSelect value={metric} onChange={(value) => set({ metric: value })} />}

        {widget.type === "kpi_grid" && <div className="space-y-2">
          <Label>Métricas desta grade</Label>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3">
            {METRICS.map((item) => {
              const checked = gridMetrics.includes(item);
              return <label key={item} className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={checked} onCheckedChange={(next) => {
                  const metrics = next ? [...gridMetrics, item] : gridMetrics.filter((value) => value !== item);
                  if (metrics.length) set({ metrics });
                }} />
                {METRIC_LABELS[item]}
              </label>;
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Mantenha pelo menos uma métrica selecionada.</p>
        </div>}

        {["line_chart", "bar_chart", "pie_chart"].includes(widget.type) && <div className="space-y-2">
          <Label>Agrupar por</Label>
          <Select value={config.groupBy || "date"} onValueChange={(value) => set({ groupBy: value as WidgetGroupBy })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GROUPS.map((group) => <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>}

        {widget.type === "bar_chart" && <div className="space-y-2"><Label>Orientação</Label><Select value={config.orientation || "vertical"} onValueChange={(value) => set({ orientation: value as "vertical" | "horizontal" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vertical">Vertical</SelectItem><SelectItem value="horizontal">Horizontal</SelectItem></SelectContent></Select></div>}
        {widget.type === "pie_chart" && <div className="space-y-2"><Label>Visual</Label><Select value={config.variant || "donut"} onValueChange={(value) => set({ variant: value as "pie" | "donut" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="donut">Donut</SelectItem><SelectItem value="pie">Pizza</SelectItem></SelectContent></Select></div>}
        {widget.type === "top_ranking" && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Exibir</Label><Select value={config.direction || "top"} onValueChange={(value) => set({ direction: value as "top" | "worst" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Melhores</SelectItem><SelectItem value="worst">Piores</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Quantidade</Label><Input type="number" min={1} max={20} value={config.limit || 5} onChange={(event) => set({ limit: Math.max(1, Math.min(20, Number(event.target.value) || 5)) })} /></div></div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => { onSave({ title: title.trim() || widget.title, config }); onOpenChange(false); }}>Aplicar neste widget</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function MetricSelect({ value, onChange }: { value: WidgetMetric; onChange: (value: WidgetMetric) => void }) {
  return <div className="space-y-2"><Label>Métrica</Label><Select value={value} onValueChange={(next) => onChange(next as WidgetMetric)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METRICS.map((metric) => <SelectItem key={metric} value={metric}>{METRIC_LABELS[metric]}</SelectItem>)}</SelectContent></Select></div>;
}
