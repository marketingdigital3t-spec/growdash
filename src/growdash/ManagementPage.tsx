import { Bot, Building2, Image, Plus, UserCog } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { agents, brands, campaigns, users } from "./data";
import { PageHeading } from "./shared";

export default function ManagementPage() {
  const { pathname } = useLocation();
  if (pathname === "/marcas") return <Brands />;
  if (pathname === "/usuarios") return <Users />;
  if (pathname === "/agentes") return <Agents />;
  if (pathname === "/anuncios") return <Ads />;
  return <Navigate to="/" replace />;
}

function Brands() {
  return <Shell eyebrow="Gestão" title="Marcas" description="Organize contas de anúncio, funis, usuários e metas dentro de cada operação." button="Nova marca"><div className="grid gap-4 lg:grid-cols-3">{brands.map((brand) => <article key={brand.name} className="gd-panel p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Building2 className="h-5 w-5" /></span><div><h2 className="font-black">{brand.name}</h2><p className="text-[10px] text-muted-foreground">{brand.domain}</p></div><span className="ml-auto rounded-full bg-success/12 px-2 py-1 text-[8px] font-black text-success">{brand.status}</span></div><div className="mt-5 grid grid-cols-2 gap-2 text-[10px]"><Stat label="Contas" value={String(brand.accounts)} /><Stat label="Funis" value={String(brand.funnels)} /><Stat label="Receita" value={brand.revenue} /><Stat label="Equipe" value={brand.name === "Vida Leve" ? "3" : "1"} /></div></article>)}</div></Shell>;
}

function Users() {
  return <Shell eyebrow="Administração" title="Usuários" description="Controle papéis e acesso a marcas, contas de anúncio e funis do RD Station." button="Convidar usuário"><section className="gd-panel overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Usuário", "Função", "Acesso", "Último acesso"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{users.map((user) => <tr key={user.email}><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary/12 text-[9px] font-black text-primary"><UserCog className="h-4 w-4" /></span><div><b>{user.name}</b><span className="block text-[9px] text-muted-foreground">{user.email}</span></div></div></td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4">{user.access}</td><td className="px-4 py-4">{user.lastSeen}</td></tr>)}</tbody></table></div></section></Shell>;
}

function Agents() {
  return <Shell eyebrow="Inteligência artificial" title="Agentes" description="Agentes especializados para monitorar mídia, funil, receita e operação continuamente." button="Novo agente"><div className="grid gap-4 lg:grid-cols-3">{agents.map((agent) => <article key={agent.name} className="gd-panel p-5"><div className="flex items-center gap-3"><span className="gold-flash grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Bot className="h-5 w-5" /></span><div><h2 className="font-black">{agent.name}</h2><span className="text-[9px] font-bold text-success">● {agent.status}</span></div></div><p className="mt-4 min-h-12 text-xs leading-relaxed text-muted-foreground">{agent.purpose}</p><div className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground"><b className="text-foreground">{agent.executions}</b> execuções neste mês</div></article>)}</div></Shell>;
}

function Ads() {
  const ads = campaigns.flatMap((campaign, index) => [1, 2].map((variation) => ({ name: `${campaign.name} · Criativo ${variation}`, campaign: campaign.name, status: campaign.status, ctr: campaign.ctr + variation * .12, spend: campaign.spend / 2, winner: index % 2 === 0 && variation === 1 }))).slice(0, 8);
  return <Shell eyebrow="Biblioteca" title="Anúncios" description="Criativos de Meta e Google reunidos para comparar desempenho e identificar fadiga." button="Novo anúncio"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{ads.map((ad) => <article key={ad.name} className="gd-panel overflow-hidden"><div className="grid aspect-video place-items-center bg-gradient-to-br from-primary/20 via-primary/45 to-primary text-primary-foreground"><Image className="h-8 w-8" /></div><div className="p-4"><div className="flex gap-2">{ad.winner && <span className="rounded-full bg-primary/12 px-2 py-1 text-[8px] font-black text-primary">Vencedor</span>}<span className="rounded-full bg-success/12 px-2 py-1 text-[8px] font-black text-success">{ad.status}</span></div><h2 className="mt-3 line-clamp-2 min-h-9 text-xs font-black">{ad.name}</h2><div className="mt-3 flex justify-between text-[9px] text-muted-foreground"><span>CTR <b className="text-foreground">{ad.ctr.toFixed(2)}%</b></span><span>Gasto <b className="text-foreground">R$ {ad.spend.toFixed(2)}</b></span></div></div></article>)}</div></Shell>;
}

function Shell({ eyebrow, title, description, button, children }: { eyebrow: string; title: string; description: string; button: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1500px]"><PageHeading eyebrow={eyebrow} title={title} description={description} actions={<button className="gold-action"><Plus className="h-4 w-4" /> {button}</button>} />{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><span className="block text-muted-foreground">{label}</span><b className="mt-1 block text-sm text-foreground">{value}</b></div>;
}
