import { CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { findModule } from "./navigation";
import { MetricCard, MiniBars, PageHeading } from "./shared";

export default function ModulePage() {
  const { pathname } = useLocation();
  const module = findModule(pathname);
  if (!module) return <Navigate to="/" replace />;
  const Icon = module.icon;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Growdash" title={module.label} description={module.description} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {module.metrics.map((metric, index) => <MetricCard key={metric.label} {...metric} emphasis={index === 0} />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.8fr]">
        <section className="gd-panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f9ecc2] text-[#906b13]"><Icon className="h-5 w-5" /></span>
            <div><h2 className="font-black">Evolução de {module.label.toLowerCase()}</h2><p className="text-xs text-[#817b74]">Visão demonstrativa do período selecionado</p></div>
          </div>
          <MiniBars values={[38, 52, 46, 65, 58, 74, 62, 84, 76, 94, 88, 100]} />
        </section>
        <section className="gd-panel overflow-hidden">
          <div className="border-b border-[#e9e4dd] p-5"><h2 className="font-black">Destaques</h2><p className="text-xs text-[#817b74]">Itens que pedem sua atenção</p></div>
          <div className="divide-y divide-[#eeeae4]">
            {module.highlights.map((highlight, index) => (
              <button key={highlight} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[#fbf8f1]">
                {index === 0 ? <Clock3 className="h-4 w-4 text-[#d19b15]" /> : <CheckCircle2 className="h-4 w-4 text-[#4e8d63]" />}
                <span className="grow text-xs font-bold">{highlight}</span>
                <ChevronRight className="h-4 w-4 text-[#aaa39a]" />
              </button>
            ))}
          </div>
          <div className="m-4 rounded-xl border border-dashed border-[#d9c894] bg-[#fffaf0] p-4 text-[11px] leading-relaxed text-[#796835]">
            Dados demonstrativos. Na próxima etapa, conectaremos esta área às fontes reais do seu negócio.
          </div>
        </section>
      </div>
    </div>
  );
}
