import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bot, Download, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelSuggestedActions({ a }: { a: FunnelAnalytics }) {
  const navigate = useNavigate();
  const actions = [
    a.agingBuckets.gt7 > 0 ? { color: "border-red-500/30 bg-red-500/5", Icon: AlertTriangle, title: `${a.agingBuckets.gt7} leads parados há mais de 7 dias`, detail: "Priorize o contato antes que a oportunidade esfrie.", buttons: [["Exportar leads", Download, () => navigate("/crm?status=open")], ["Disparar automação", Bot, () => navigate("/automacoes")]] } : null,
    a.bottleneck ? { color: "border-amber-500/30 bg-amber-500/5", Icon: Palette, title: `Gargalo em ${a.bottleneck.from} → ${a.bottleneck.to}`, detail: `${a.bottleneck.lossPct.toFixed(0)}% de perda nesta passagem. Revise abordagem, oferta e criativos de origem.`, buttons: [["Revisar criativos", Palette, () => navigate("/campanhas")], ["Ver CRM", ArrowRight, () => navigate("/crm")]] } : null,
  ].filter(Boolean) as { color: string; Icon: any; title: string; detail: string; buttons: [string, any, () => void][] }[];
  if (!actions.length) return null;
  return <section className="rounded-2xl border border-primary/25 bg-card/70 p-4"><div className="mb-3"><h2 className="text-sm font-black">Ações sugeridas</h2><p className="mt-1 text-xs text-muted-foreground">Transforme os alertas do funil em uma próxima ação objetiva.</p></div><div className="grid gap-3 lg:grid-cols-2">{actions.map(({ color, Icon, title, detail, buttons }) => <article key={title} className={`rounded-xl border p-4 ${color}`}><div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><b className="text-sm">{title}</b><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{buttons.map(([label, ButtonIcon, action]) => <Button key={label} type="button" size="sm" variant="outline" onClick={action}><ButtonIcon className="mr-1.5 h-3.5 w-3.5" />{label}</Button>)}</div></article>)}</div></section>;
}
