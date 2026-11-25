// A aba "Agentes" da Growdash.
//
// Duas vistas, alternadas por um seletor:
// - "Escritorio": o Habblaud, o escritorio em pixel art onde os agentes
//   trabalham. E o visual principal desta aba.
// - "Mapa": o Mapa da Inteligencia (o nucleo neural que mostra as areas da
//   operacao e os dados de cada uma). Continua disponivel, como antes.
//
// O escritorio vem do projeto Habblaud (github.com/marmottajr/habblaud,
// MIT), vendorizado em `src/habblaud`. Ele roda com o simulador embutido do
// proprio Habblaud: nao ha servidor local do Habblaud na Growdash (e uma SPA
// estatica na Cloudflare Pages), entao nao ha leitura dos transcripts da
// maquina.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { CoreAccountInput } from "@/lib/agentCore";
import HabblaudOffice from "@/habblaud/HabblaudOffice";
import "@/habblaud/office.css";

const KnowledgeMap = lazy(() =>
  import("@/growdash/AgentsOfficePage").then((m) => ({ default: m.KnowledgeMap })),
);

type View = "office" | "map";

export default function HabblaudOfficePanel() {
  const [view, setView] = useState<View>("office");
  const { startDate, endDate, businessUnitId, segment } = useGlobalFilters();
  const { data: accounts = [] } = useAdAccounts();
  const visibleAccounts = useMemo<CoreAccountInput[]>(() => {
    const filtered = businessUnitId
      ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
      : accounts;
    return filtered.map((account) => ({ id: account.id, name: account.name, target_cpl: account.target_cpl }));
  }, [accounts, businessUnitId, segment]);

  // Tela cheia: o escritorio ocupa a janela inteira, sem a barra lateral nem
  // o cabecalho da plataforma.
  //
  // Nao usamos a Fullscreen API: ela exige permissao no navegador (o
  // Chrome pode recusar com "Permissions check failed") e so funciona com um
  // gesto do usuario. Um overlay em `position: fixed` faz o mesmo efeito, sem
  // permissao nenhuma, e o `Esc` fecha.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    // O corpo sem barra de rolagem enquanto o escritorio esta em tela cheia.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);
  const toggleFullscreen = useCallback(() => setFullscreen((value) => !value), []);

  // O escritorio em tela cheia vai para o `body` (portal): dentro da pagina, o
  // `filter` da transicao de rota cria um bloco contentor e o `position:
  // fixed` ficaria preso ao conteudo, nao a janela.
  const office = (
    <div className={cn("habblaud-office-frame overflow-hidden rounded-2xl border border-border", fullscreen && "is-fullscreen")}>
      <HabblaudOffice />
      {fullscreen ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur transition-colors hover:bg-black/85"
          aria-label="Sair da tela cheia"
        >
          <Minimize2 className="h-3.5 w-3.5" /> Sair
        </button>
      ) : null}
    </div>
  );
  const officeContent = fullscreen && typeof document !== "undefined"
    ? createPortal(office, document.body)
    : office;

  return (
    <div className="agents-office-page mx-auto flex w-full max-w-[1920px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">Agentes</h1>
          <p className="truncate text-xs text-muted-foreground">
            O escritório da operação: cada agente, a sala onde trabalha e o que está fazendo agora.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            aria-label={fullscreen ? "Sair da tela cheia" : "Ver o escritório em tela cheia"}
            title={fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            Tela cheia
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Vista da área de agentes">
          <button
            type="button"
            role="tab"
            aria-selected={view === "office"}
            onClick={() => setView("office")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "office" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            Escritório
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            onClick={() => setView("map")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "map" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <Network className="h-3.5 w-3.5" /> Mapa
          </button>
          </div>
        </div>
      </div>

      {view === "office" ? (
        officeContent
      ) : (
        <Suspense fallback={<div className="grid min-h-[620px] place-items-center rounded-2xl border border-primary/25 bg-[#161108] text-sm text-primary">Carregando o mapa…</div>}>
          <KnowledgeMap
            onOpenOffice={() => setView("office")}
            accounts={visibleAccounts}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      )}
    </div>
  );
}
