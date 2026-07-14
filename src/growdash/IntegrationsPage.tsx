import { useState } from "react";
import { CheckCircle2, ChevronRight, Cloud, DatabaseZap, RefreshCw, Settings2, TriangleAlert } from "lucide-react";
import { integrations } from "./data";
import { PageHeading } from "./shared";
import { cn } from "@/lib/utils";

const logos: Record<string, { label: string; className: string }> = {
  meta: { label: "∞", className: "bg-[#eaf1ff] text-[#2469da]" },
  rd: { label: "RD", className: "bg-[#efe9ff] text-[#6d46bc]" },
  "google-ads": { label: "G", className: "bg-[#e9f6ee] text-[#287847]" },
  drive: { label: "△", className: "bg-[#fff4d8] text-[#b27c0c]" },
};

export default function IntegrationsPage() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Administração" title="Integrações" description="Conecte suas fontes para transformar mídia, CRM e arquivos em uma visão única da operação." actions={<button className="gd-button"><RefreshCw className="h-4 w-4" /> Sincronizar tudo</button>} />

      {notice && <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#dfc068] bg-[#fff8df] p-4 text-xs text-[#6c5920]"><DatabaseZap className="h-4 w-4" /><span className="grow">{notice}</span><button onClick={() => setNotice(null)} className="font-black">Fechar</button></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.map((integration) => {
          const logo = logos[integration.id];
          const connected = integration.status === "Conectado";
          const warning = integration.status === "Atenção";
          return (
            <article key={integration.id} className="gd-panel overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black", logo.className)}>{logo.label}</span>
                <div className="min-w-0 grow"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{integration.name}</h2><span className={cn("rounded-full px-2 py-1 text-[8px] font-black uppercase", connected && "bg-[#e7f4eb] text-[#39764d]", warning && "bg-[#fff0cd] text-[#946a0f]", !connected && !warning && "bg-[#efedeb] text-[#736c65]")}>{integration.status}</span></div><p className="mt-1 text-xs leading-relaxed text-[#77716a]">{integration.description}</p></div>
                {connected ? <CheckCircle2 className="h-5 w-5 text-[#43845a]" /> : warning ? <TriangleAlert className="h-5 w-5 text-[#c49118]" /> : <Cloud className="h-5 w-5 text-[#9a938b]" />}
              </div>
              <div className="grid grid-cols-2 border-y border-[#ebe7e1] bg-[#faf9f7] text-[10px]"><div className="border-r border-[#ebe7e1] p-3"><span className="block text-[#8b847c]">Recursos</span><b>{integration.accounts}</b></div><div className="p-3"><span className="block text-[#8b847c]">Última sincronização</span><b>{integration.synced}</b></div></div>
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => setNotice(`${integration.name}: o fluxo de conexão será ativado quando inserirmos as credenciais OAuth reais.`)} className={connected ? "gd-button" : "gold-action"}>{connected ? <Settings2 className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}{connected ? "Gerenciar" : "Conectar"}</button>
                <button className="gd-button ml-auto">Ver dados <ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="gd-panel mt-4 p-5">
        <h2 className="font-black">Como os dados se encontram</h2>
        <p className="mt-1 text-xs text-[#7f7870]">UTMs, origem do lead e identificadores de conta ligam o investimento das plataformas de mídia às negociações e vendas do RD Station.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {["Meta / Google Ads", "UTM + conta + campanha", "Funil RD Station", "Receita e ROAS"].map((label, index) => <div key={label} className="relative rounded-xl border border-[#e2ddd6] bg-[#fcfbf8] p-4 text-center text-xs font-black">{label}{index < 3 && <span className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border bg-white text-[#9b7416] md:grid">›</span>}</div>)}
        </div>
      </section>
    </div>
  );
}
