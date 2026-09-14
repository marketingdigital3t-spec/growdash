import { ArrowUpRight, CircleDollarSign, LayoutDashboard, MousePointerClick, Target, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { MetricCard, MiniBars, PageHeading } from "./shared";

// This legacy shell is kept for compatibility, but must never present
// fabricated business metrics. The data-backed dashboard is /dashboard.
const activities: Array<[string, string, string]> = [];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Visão geral"
        title="Dashboard"
        description="Acompanhe marketing, comercial e operação em um único painel."
        actions={(
          <Link to="/dashboard/completo" className="gold-action">
            <LayoutDashboard className="h-4 w-4" /> Dashboard completo
          </Link>
        )}
      />

      <div className="gd-auto-grid gap-3">
        <MetricCard label="Receita no período" value="—" change="sem dados" emphasis />
        <MetricCard label="Leads gerados" value="—" change="sem dados" />
        <MetricCard label="Investimento em mídia" value="—" change="sem dados" />
        <MetricCard label="ROAS" value="—" change="sem dados" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_.8fr]">
        <section className="gd-panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-black">Crescimento de receita</h2>
              <p className="text-xs text-[#817b74]">Evolução dos últimos 10 períodos</p>
            </div>
            <span className="rounded-full bg-[#f8edc9] px-3 py-1 text-[11px] font-bold text-[#86630e]">+24,8%</span>
          </div>
          <MiniBars />
          <div className="mt-3 flex justify-between text-[9px] font-bold uppercase tracking-wide text-[#9a948c]">
            <span>Início</span><span>Período atual</span>
          </div>
        </section>
        <section className="gd-panel overflow-hidden">
          <div className="border-b border-[#e7e2da] p-5">
            <h2 className="font-black">Atividade recente</h2>
            <p className="text-xs text-[#817b74]">Atualizações das integrações</p>
          </div>
          <div className="divide-y divide-[#eeeae4]">
            {activities.length ? activities.map(([source, text, time]) => (
              <div key={text} className="flex items-start gap-3 p-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 grow">
                  <p className="text-xs font-bold">{source}</p>
                  <p className="truncate text-[11px] text-[#77716a]">{text}</p>
                </div>
                <span className="shrink-0 text-[9px] text-[#9c958d]">{time}</span>
              </div>
            )) : <p className="p-5 text-xs text-[#77716a]">Nenhuma atividade oficial disponível nesta visão.</p>}
          </div>
        </section>
      </div>

      <div className="gd-auto-grid mt-4 gap-3">
        {[
          [Target, "Conversão do funil", "18,4%", "+2,1%"],
          [UsersRound, "Oportunidades", "214", "+8%"],
          [MousePointerClick, "CTR médio", "1,56%", "+0,3%"],
          [CircleDollarSign, "Custo por lead", "R$ 14,42", "-6%"],
        ].map(([Icon, label, value, change]) => {
          const IconComponent = Icon as typeof Target;
          return (
            <article key={label as string} className="gd-panel flex items-center gap-4 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fbf0cd] text-[#9b7417]"><IconComponent className="h-5 w-5" /></span>
              <div><p className="text-[10px] font-semibold text-[#807970]">{label as string}</p><p className="text-lg font-black">{value as string}</p></div>
              <span className="ml-auto flex items-center text-[10px] font-bold text-[#3f8359]"><ArrowUpRight className="h-3 w-3" />{change as string}</span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
