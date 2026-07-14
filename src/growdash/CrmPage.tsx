import { ChevronDown, CircleDollarSign, RefreshCw, UsersRound } from "lucide-react";
import { rdStages } from "./data";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const deals = [
  { name: "Mariana Alves", source: "Meta · Captação 07", stage: "Proposta enviada", value: 7800, owner: "Rafael" },
  { name: "Grupo Horizonte", source: "Google · Pesquisa", stage: "Oportunidade", value: 12400, owner: "Thiego" },
  { name: "Paulo Ferreira", source: "Meta · Remarketing", stage: "Contato iniciado", value: 4200, owner: "Rafael" },
  { name: "Clube Essencial", source: "Meta · Tráfego Perfil", stage: "Venda", value: 9600, owner: "Marina" },
];

export default function CrmPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="RD Station CRM" title="CRM" description="Funis, negociações e receita sincronizados com a origem de mídia de cada lead." actions={<><button className="gd-button">Funil Comercial Principal <ChevronDown className="h-4 w-4" /></button><button className="gd-button"><RefreshCw className="h-4 w-4" /> Sincronizar RD</button></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Negociações ativas" value="355" change="+12%" emphasis /><MetricCard label="Receita em aberto" value="R$ 616 mil" change="+15%" /><MetricCard label="Vendas no período" value="28" change="+11%" /><MetricCard label="Conversão do funil" value="5,76%" change="+0,9%" /></div>
      <section className="gd-panel mt-4 p-5"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-[#a17817]" /><div><h2 className="font-black">Pipeline sincronizado</h2><p className="text-xs text-[#817a72]">Etapas recebidas diretamente do funil conectado no RD Station</p></div></div><div className="mt-5 grid gap-3 lg:grid-cols-5">{rdStages.map((stage) => <article key={stage.label} className="rounded-xl border border-[#e4dfd8] p-4"><div className="mb-3 h-1 rounded-full" style={{ background: stage.color }} /><p className="text-[10px] font-bold text-[#77716a]">{stage.label}</p><p className="mt-2 text-2xl font-black">{stage.deals}</p><p className="mt-1 text-[9px] text-[#918a82]">{stage.revenue ? brl.format(stage.revenue) : "Entrada do funil"}</p></article>)}</div></section>
      <section className="gd-panel mt-4 overflow-hidden"><div className="flex items-center gap-3 border-b border-[#e4dfd8] p-5"><CircleDollarSign className="h-5 w-5 text-[#a17817]" /><div><h2 className="font-black">Negociações recentes</h2><p className="text-xs text-[#817a72]">Com origem da campanha identificada</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#f7f5f2] text-[10px] text-[#736d66]"><tr>{["Negociação", "Origem de mídia", "Etapa", "Responsável", "Valor"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#eeeae4]">{deals.map((deal) => <tr key={deal.name}><td className="px-4 py-4 font-black">{deal.name}</td><td className="px-4 py-4">{deal.source}</td><td className="px-4 py-4"><span className="rounded-full bg-[#fff1ca] px-2 py-1 text-[9px] font-bold text-[#8c6814]">{deal.stage}</span></td><td className="px-4 py-4">{deal.owner}</td><td className="px-4 py-4 font-black">{brl.format(deal.value)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
