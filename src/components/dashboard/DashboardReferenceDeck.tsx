import { Crosshair, Eye, Rocket, UserRound, UsersRound } from "lucide-react";
import { SpaceRocket } from "@/components/space/SpaceRocket";

type Props = {
  impressions: number;
  clicks: number;
  leads: number;
  clients: number;
  roas: number;
  cpl: number;
};

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function pct(value: number, base: number) {
  return base > 0 ? `${((value / base) * 100).toFixed(2)}%` : "—";
}

export function DashboardReferenceDeck({ impressions, clicks, leads, clients, roas, cpl }: Props) {
  const cards = [
    { label: "Impressões", value: integer.format(impressions), detail: `${pct(clicks, impressions)} CTR`, icon: <Eye /> },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, detail: "retorno sobre mídia", icon: <Crosshair /> },
    { label: "CPL", value: brl.format(cpl), detail: "custo por lead", icon: <UserRound /> },
    { label: "Leads", value: integer.format(leads), detail: `${pct(clients, leads)} clientes`, icon: <UsersRound /> },
  ];

  const funnel = [
    ["IMPRESSÕES", integer.format(impressions)],
    ["CLIQUES", `${integer.format(clicks)} (${pct(clicks, impressions)})`],
    ["LEADS", `${integer.format(leads)} (${pct(leads, clicks)})`],
    ["CLIENTES", `${integer.format(clients)} (${pct(clients, leads)})`],
  ];

  return <section className="dashboard-reference-deck" aria-label="Visão espacial do Dashboard">
    <div className="dashboard-reference-kpis">{cards.map((card) => <article key={card.label} className="dashboard-reference-kpi"><span className="dashboard-reference-icon">{card.icon}</span><div><p>{card.label}</p><strong>{card.value}</strong><small>{card.detail}</small></div><span className="dashboard-reference-spark" /></article>)}</div>
    <div className="dashboard-reference-panels">
      <article className="dashboard-reference-funnel"><header><span><Rocket /> Funil orbital</span><small>Jornada em andamento</small></header><div className="dashboard-reference-funnel-body"><div className="dashboard-reference-funnel-steps">{funnel.map(([label, value], index) => <div key={label} className={`dashboard-reference-funnel-step step-${index + 1}`}><b>{label}</b><strong>{value}</strong></div>)}</div><div className="dashboard-reference-orbit-rocket"><SpaceRocket /></div></div><footer>Jornada em andamento <span>— dados do período selecionado</span></footer></article>
      <article className="dashboard-reference-radar"><header><span><Crosshair /> Radar de anomalias</span><small>Monitoramento</small></header><div className="dashboard-reference-radar-plot"><i /><i /><i /><span /></div><ul><li><b className="negative">!</b><span>CPL e eficiência de mídia</span><em>Verificar</em></li><li><b className="warning">!</b><span>Conversão por etapa</span><em>Acompanhar</em></li><li><b className="positive">i</b><span>Dados sincronizados</span><em>Estável</em></li></ul></article>
    </div>
  </section>;
}
