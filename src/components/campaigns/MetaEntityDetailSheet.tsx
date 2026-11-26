import { BarChart3, Layers3, Megaphone, MousePointerClick, PauseCircle, Pencil, PlayCircle, Target, UsersRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeStatus } from "@/components/dashboard/ResizableTableHelpers";

export type MetaDetailEntity = {
  id: string;
  type: "adset" | "ad";
  name: string;
  status: string;
  campaignId: string;
  campaignName: string;
  adsetName?: string;
  daily_budget?: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
};

type Props = {
  entity: MetaDetailEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (entity: MetaDetailEntity) => void;
  onViewAds?: (entity: MetaDetailEntity) => void;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function MetaEntityDetailSheet({ entity, open, onOpenChange, onEdit, onViewAds }: Props) {
  if (!entity) return null;
  const active = normalizeStatus(entity.status) === "ACTIVE";
  const ctr = entity.impressions > 0 ? entity.clicks / entity.impressions * 100 : 0;
  const cpc = entity.clicks > 0 ? entity.spend / entity.clicks : 0;
  const cpl = entity.leads > 0 ? entity.spend / entity.leads : 0;
  const frequency = entity.reach > 0 ? entity.impressions / entity.reach : 0;
  const diagnosis = entity.spend > 0 && entity.leads === 0
    ? `Este ${entity.type === "ad" ? "anúncio" : "conjunto"} consumiu ${money.format(entity.spend)} sem gerar leads no período. Revise público, criativo, evento de conversão e página antes de aumentar o orçamento.`
    : entity.leads > 0
      ? `Foram gerados ${number.format(entity.leads)} leads a ${money.format(cpl)} por resultado. CTR de ${ctr.toFixed(2).replace(".", ",")}% e frequência de ${frequency.toFixed(2).replace(".", ",")} devem ser comparados com a meta da conta antes de escalar.`
      : "Ainda não há volume suficiente no período para emitir uma recomendação segura.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[460px]">
        <SheetHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{entity.type === "ad" ? "Anúncio" : "Conjunto de anúncios"}</Badge>
            <Badge className={active ? "bg-emerald-500/15 text-emerald-500" : "bg-zinc-500/15 text-zinc-400"}>{active ? "Ativo" : "Pausado"}</Badge>
          </div>
          <SheetTitle className="pr-6 text-left text-xl">{entity.name}</SheetTitle>
          <SheetDescription className="text-left">
            {entity.adsetName ? `${entity.adsetName} · ` : ""}{entity.campaignName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(entity)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(entity)}>{active ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}{active ? "Pausar" : "Ativar"}</Button>
          {entity.type === "adset" && <Button variant="outline" size="sm" className="col-span-2" onClick={() => onViewAds?.(entity)}><Layers3 className="mr-2 h-4 w-4" />Ver anúncios deste conjunto</Button>}
        </div>

        <section className="mt-5 grid grid-cols-2 gap-2">
          <Metric icon={Target} label="Investimento" value={money.format(entity.spend)} />
          <Metric icon={BarChart3} label="Impressões" value={number.format(entity.impressions)} />
          <Metric icon={UsersRound} label="Alcance*" value={number.format(entity.reach)} />
          <Metric icon={MousePointerClick} label="Cliques" value={number.format(entity.clicks)} />
          <Metric icon={Megaphone} label="CTR" value={`${ctr.toFixed(2).replace(".", ",")}%`} />
          <Metric icon={Target} label="CPC" value={money.format(cpc)} />
          <Metric icon={UsersRound} label="Leads" value={number.format(entity.leads)} />
          <Metric icon={Target} label="CPL" value={money.format(cpl)} />
        </section>

        {entity.type === "adset" && <div className="mt-3 rounded-xl border border-border bg-muted/25 p-4"><span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Orçamento diário</span><strong className="mt-1 block text-lg">{money.format(Number(entity.daily_budget || 0))}</strong></div>}

        <section className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.045] p-4">
          <h3 className="flex items-center gap-2 text-sm font-black"><BarChart3 className="h-4 w-4 text-primary" />Diagnóstico automático</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{diagnosis}</p>
          <p className="mt-3 text-[9px] text-muted-foreground">O diagnóstico usa somente os dados carregados do período; nenhuma alteração é feita automaticamente.</p>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{label}</div><strong className="mt-2 block text-sm tabular-nums">{value}</strong></div>;
}
