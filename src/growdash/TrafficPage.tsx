import { useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Download,
  GitBranch,
  Megaphone,
  PanelTop,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adAccounts, attributionRows, campaigns, rdStages } from "./data";

const tabs = [
  { id: "campaigns", label: "Campanhas", icon: Megaphone },
  { id: "budget", label: "Orçamento (BM)", icon: WalletCards },
  { id: "ai", label: "IA & Relatórios de Leads", icon: Bot },
  { id: "funnels", label: "Funis de Tráfego", icon: GitBranch },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");

export default function TrafficPage() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [accountId, setAccountId] = useState(adAccounts[0].id);
  const [search, setSearch] = useState("");
  const account = adAccounts.find((item) => item.id === accountId) ?? adAccounts[0];

  return (
    <div className="mx-auto max-w-[1600px]">
      <WelcomeHero />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-[#dfdcda] p-1 lg:grid-cols-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-md px-2 text-[11px] font-semibold transition",
              activeTab === id ? "gold-flash bg-gradient-to-r from-[#d69d12] via-[#ffd95c] to-[#b87906] text-[#30230a] shadow-sm" : "text-[#554f49] hover:bg-white/50",
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-[#ddd7ce] bg-white p-2 sm:flex-row sm:items-center">
        <div className="px-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8f6b16]">Conta selecionada</div>
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-9 min-w-0 grow rounded-md border border-[#d8d2ca] bg-white px-3 text-xs font-bold outline-none focus:border-[#d5a72a] sm:max-w-md">
          {adAccounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.platform}</option>)}
        </select>
        <span className="rounded-full bg-[#eaf5ed] px-3 py-1.5 text-[10px] font-bold text-[#3e7d52]">● Sincronizada há 4 min</span>
        <Link to="/trafego-pago/gerenciador" className="gold-action">
          <PanelTop className="h-3.5 w-3.5" /> Gerenciador avançado
        </Link>
        <button className="gd-button"><RefreshCw className="h-3.5 w-3.5" /> Sincronizar</button>
      </div>

      {activeTab === "campaigns" && <CampaignsView accountId={accountId} search={search} setSearch={setSearch} />}
      {activeTab === "budget" && <BudgetView account={account} />}
      {activeTab === "ai" && <AiReportsView accountName={account.name} />}
      {activeTab === "funnels" && <FunnelsView />}
    </div>
  );
}

function WelcomeHero() {
  return (
    <section className="relative mb-5 overflow-hidden rounded-xl border border-[#6f551c] bg-[#0f0d09] px-6 py-7 text-center text-[#f8db84] shadow-[inset_0_0_80px_rgba(205,148,28,.14)] sm:px-12 sm:py-9">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_16%_12%,rgba(245,203,91,.38),transparent_20%),radial-gradient(circle_at_84%_80%,rgba(236,178,48,.27),transparent_22%),linear-gradient(115deg,transparent_0_28%,rgba(197,139,31,.18)_40%,transparent_55%)]" />
      <div className="pointer-events-none absolute -left-12 bottom-[-80px] h-40 w-[45%] rotate-[-8deg] rounded-[100%] border-[18px] border-[#bd831b]/40" />
      <div className="pointer-events-none absolute -right-12 top-[-80px] h-40 w-[45%] rotate-[8deg] rounded-[100%] border-[18px] border-[#e0a92f]/35" />
      <div className="relative mx-auto flex max-w-5xl items-center justify-center gap-4">
        <TrendingUp className="hidden h-14 w-14 text-[#e2b447] sm:block" strokeWidth={1.3} />
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#f5dc91] drop-shadow-[0_0_18px_rgba(244,205,102,.25)] sm:text-5xl">Bem-Vindo a Growdash</h1>
          <p className="mt-2 font-serif text-base text-[#dbc48a] sm:text-2xl">Sua Jornada de Crescimento Digital Começa Aqui</p>
        </div>
      </div>
      <button className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#4b4339]" aria-label="Fechar boas-vindas"><X className="h-4 w-4" /></button>
    </section>
  );
}

function CampaignsView({ accountId, search, setSearch }: { accountId: string; search: string; setSearch: (value: string) => void }) {
  const filtered = useMemo(() => campaigns.filter((campaign) => campaign.accountId === accountId && campaign.name.toLowerCase().includes(search.toLowerCase())), [accountId, search]);
  const totals = filtered.reduce((sum, campaign) => ({ spend: sum.spend + campaign.spend, leads: sum.leads + campaign.leads, clicks: sum.clicks + campaign.clicks, impressions: sum.impressions + campaign.impressions }), { spend: 0, leads: 0, clicks: 0, impressions: 0 });

  return (
    <section className="gd-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#ded9d2] p-3 lg:flex-row lg:items-center">
        <div><h2 className="text-base font-black">Campanhas</h2><span className="text-[10px] text-[#8d867e]">Estrutura inspirada no gerenciador de anúncios</span></div>
        <label className="flex h-9 min-w-0 grow items-center gap-2 rounded-md border border-[#e2ddd6] bg-white px-3 lg:max-w-[480px]">
          <Search className="h-3.5 w-3.5 text-[#9c958d]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 grow bg-transparent text-[11px] outline-none" placeholder="Filtrar por nome, objetivo ou métrica" />
        </label>
        <button className="gd-button ml-auto"><CalendarDays className="h-3.5 w-3.5" /> 6 jul – 12 jul 2026</button>
        <button className="gold-action"><Download className="h-3.5 w-3.5" /> Baixar relatório</button>
      </div>

      <div className="grid grid-cols-2 border-b border-[#e4dfd8] bg-[#fbfaf8] lg:grid-cols-4">
        <Summary label="Investimento" value={brl.format(totals.spend)} />
        <Summary label="Impressões" value={number.format(totals.impressions)} />
        <Summary label="Cliques" value={number.format(totals.clicks)} />
        <Summary label="Leads" value={number.format(totals.leads)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-[10px]">
          <thead className="border-b border-[#ded9d2] bg-[#f7f5f2] text-[#716a63]">
            <tr>{["Campanha", "Veiculação", "Objetivo", "Orçamento", "Valor usado", "Impressões", "Cliques", "CTR", "Leads", "CPL", "ROAS"].map((label) => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#eeeae4]">
            {filtered.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-[#fffaf0]">
                <td className="max-w-[280px] px-3 py-3 font-black">{campaign.name}<span className="mt-0.5 block text-[8px] font-medium text-[#9b948c]">{campaign.platform} · ID {campaign.id.toUpperCase()}</span></td>
                <td className="px-3 py-3"><StatusPill status={campaign.status} /></td>
                <td className="px-3 py-3">{campaign.objective}</td>
                <td className="px-3 py-3 font-bold">{brl.format(campaign.budget)}/dia</td>
                <td className="px-3 py-3 font-bold">{brl.format(campaign.spend)}</td>
                <td className="px-3 py-3">{number.format(campaign.impressions)}</td>
                <td className="px-3 py-3">{number.format(campaign.clicks)}</td>
                <td className="px-3 py-3">{campaign.ctr.toFixed(2)}%</td>
                <td className="px-3 py-3">{campaign.leads}</td>
                <td className="px-3 py-3 font-bold">{brl.format(campaign.cpl)}</td>
                <td className="px-3 py-3 font-black text-[#437b54]">{campaign.roas.toFixed(1)}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BudgetView({ account }: { account: (typeof adAccounts)[number] }) {
  const used = Math.min(100, (account.spentToday / account.dailyBudget) * 100);
  const available = Math.max(0, account.dailyBudget - account.spentToday);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BudgetCard label="Orçamento diário" value={brl.format(account.dailyBudget)} note="Definido na conta" />
        <BudgetCard label="Investido hoje" value={brl.format(account.spentToday)} note={`${used.toFixed(1)}% do orçamento`} active />
        <BudgetCard label="Disponível hoje" value={brl.format(available)} note="Até o fim do dia" />
        <BudgetCard label="Saldo da conta" value={brl.format(account.remainingBalance)} note="Estimativa de 12 dias" />
      </div>
      <section className="gd-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-base font-black">Ritmo de investimento diário</h2><p className="text-xs text-[#817a72]">Quanto já foi consumido e quanto ainda pode ser investido hoje.</p></div>
          <button className="gold-action"><WalletCards className="h-4 w-4" /> Ajustar orçamento</button>
        </div>
        <div className="mt-8 h-5 overflow-hidden rounded-full bg-[#eeeae3] p-1"><div className="gold-meter h-full rounded-full" style={{ width: `${used}%` }} /></div>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-[#7e776f]"><span>Usado: {brl.format(account.spentToday)}</span><span>Disponível: {brl.format(available)}</span></div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {["00h–08h · 18%", "08h–16h · 54%", "16h–24h · 28% projetado"].map((item, index) => <div key={item} className={cn("rounded-xl border p-4 text-xs font-bold", index === 1 ? "border-[#e5bd4d] bg-[#fff8df]" : "border-[#e3ded6]")}>{item}</div>)}
        </div>
      </section>
    </div>
  );
}

function AiReportsView({ accountName }: { accountName: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <section className="gd-panel p-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#16130d] text-[#f3c84b]"><Sparkles className="h-5 w-5" /></span><div><h2 className="font-black">Diagnóstico inteligente</h2><p className="text-xs text-[#817a72]">{accountName}</p></div></div>
        <div className="mt-5 space-y-3">
          {[
            ["Oportunidade", "A campanha [VL] [CONVERSÃO] entrega CPL 31% abaixo da média. Há espaço para aumentar o orçamento em 18%."],
            ["Atenção", "A frequência do remarketing cresceu por 4 dias. Teste novos criativos antes de escalar."],
            ["Receita", "Os leads originados nesta conta geraram R$ 184,3 mil no RD Station, com ROAS atribuído de 4,2x."],
          ].map(([label, text]) => <article key={label} className="rounded-xl border border-[#e5dfd6] bg-[#fcfbf8] p-4"><span className="rounded-full bg-[#f8edc9] px-2 py-1 text-[9px] font-black uppercase text-[#8d6710]">{label}</span><p className="mt-3 text-xs leading-relaxed text-[#514c46]">{text}</p></article>)}
        </div>
      </section>
      <section className="gd-panel overflow-hidden">
        <div className="border-b border-[#e4dfd8] p-5"><h2 className="font-black">Mídia + RD Station</h2><p className="text-xs text-[#817a72]">Atribuição consolidada por conta</p></div>
        <div className="divide-y divide-[#eeeae4]">{attributionRows.map((row) => <div key={row.account} className="p-4"><div className="flex items-center justify-between gap-3"><strong className="text-[11px]">{row.account}</strong><span className="text-sm font-black text-[#39794e]">{row.roas.toFixed(2)}x</span></div><div className="mt-2 flex flex-wrap gap-4 text-[9px] text-[#7f7870]"><span>Investido <b className="text-[#302c28]">{brl.format(row.spend)}</b></span><span>Leads <b className="text-[#302c28]">{row.leads}</b></span><span>Vendas <b className="text-[#302c28]">{row.deals}</b></span><span>Receita <b className="text-[#302c28]">{brl.format(row.revenue)}</b></span></div></div>)}</div>
      </section>
    </div>
  );
}

function FunnelsView() {
  return (
    <section className="gd-panel p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="font-black">Funil RD Station + origem da mídia</h2><p className="text-xs text-[#817a72]">Funil Comercial Principal · sincronizado há 7 min</p></div><button className="gd-button sm:ml-auto">Selecionar funil <ChevronDown className="h-3 w-3" /></button></div>
      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {rdStages.map((stage, index) => <article key={stage.label} className="relative rounded-xl border border-[#e3ded6] bg-white p-4"><div className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: stage.color }} /><p className="text-[10px] font-bold text-[#756f68]">{stage.label}</p><p className="mt-3 text-2xl font-black">{stage.deals}</p><p className="mt-1 text-[10px] text-[#89827a]">{index === 0 ? "Leads sincronizados" : `Potencial ${brl.format(stage.revenue)}`}</p>{index < rdStages.length - 1 && <span className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 place-items-center rounded-full border bg-white text-[10px] lg:grid">›</span>}</article>)}
      </div>
      <div className="mt-6 rounded-xl border border-[#e0c56f] bg-[#fff9e7] p-4 text-xs text-[#695822]"><b>Leitura Growdash:</b> 5,76% dos novos leads chegaram à etapa de venda. A conta Vida Leve respondeu por 63% da receita atribuída no período.</div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-[#e4dfd8] p-3"><span className="text-[9px] font-semibold text-[#817a72]">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>;
}

function StatusPill({ status }: { status: "Ativa" | "Pausada" | "Aprendizado" }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-bold", status === "Ativa" && "bg-[#e8f5ec] text-[#3b7b50]", status === "Pausada" && "bg-[#efedeb] text-[#6e6760]", status === "Aprendizado" && "bg-[#fff1cf] text-[#916b13]")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function BudgetCard({ label, value, note, active }: { label: string; value: string; note: string; active?: boolean }) {
  return <article className={cn("gd-panel p-4", active && "border-[#e1b83f] bg-gradient-to-br from-[#fffdf5] to-[#fff4cc]")}><p className="text-[10px] font-bold text-[#77716a]">{label}</p><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-[10px] text-[#918a82]">{note}</p></article>;
}
