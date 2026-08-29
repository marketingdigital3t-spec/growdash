import { Fuel, Globe2, Rocket, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import earthTexture from "@/assets/growth/earth-blue-marble-dashboard.jpg";
import { SpaceRocket } from "./SpaceRocket";

export type SpacePhase = "terra" | "orbita" | "galaxia";

const PHASE_COPY: Record<SpacePhase, { title: string; subtitle: string }> = {
  terra: { title: "GROWDASH — FASE TERRA", subtitle: "Missão em andamento — R$ 0 a R$ 100 mil" },
  orbita: { title: "GROWDASH — FASE ÓRBITA", subtitle: "Missão em aceleração — R$ 100 mil a R$ 500 mil" },
  galaxia: { title: "GROWDASH — FASE GALÁXIA", subtitle: "Missão no topo — acima de R$ 500 mil" },
};

function starCount(phase: SpacePhase) {
  return phase === "terra" ? 18 : phase === "orbita" ? 30 : 46;
}

export function SpacePhaseBackground({ phase, dashboardScene = false }: { phase: SpacePhase; dashboardScene?: boolean }) {
  const copy = PHASE_COPY[phase];
  return (
    <div className="space-phase-bg" data-phase={phase} data-dashboard-scene={dashboardScene || undefined} style={{ "--earth-texture": `url(${earthTexture})` } as CSSProperties} aria-hidden="true">
      <div className="space-phase-nebula" />
      <div className="space-phase-stars">{Array.from({ length: starCount(phase) }, (_, index) => <i key={index} style={{ "--star-x": `${(index * 47) % 100}%`, "--star-y": `${(index * 71) % 100}%`, "--star-delay": `${(index % 9) * 0.45}s` } as CSSProperties} />)}</div>
      {phase !== "terra" && <div className="space-phase-meteors"><i /><i />{phase === "galaxia" && <><i /><i /></>}</div>}
      <div className="space-phase-planet"><span className="space-phase-atmosphere" /><span className="space-phase-rings" /></div>
      <div className="space-phase-orbit-map" aria-hidden="true">
        <i /><i /><i /><i />
        <span className="space-phase-orbit-line space-phase-orbit-line-a" />
        <span className="space-phase-orbit-line space-phase-orbit-line-b" />
      </div>
      <div className="space-phase-radar" aria-hidden="true"><span /><i /><i /><i /></div>
      <div className="space-phase-rocket"><SpaceRocket /><span /></div>
      <div className="space-phase-badge"><Globe2 /><span><b>{copy.title}</b><small>{copy.subtitle}</small></span><em><Sparkles /> FASE: {phase === "orbita" ? "ÓRBITA" : phase.toUpperCase()}</em></div>
    </div>
  );
}

export function SpaceMissionStrip({ phase, realized, target }: { phase: SpacePhase; realized: number; target: number }) {
  const progress = target > 0 ? Math.max(0, Math.min(100, (realized / target) * 100)) : 0;
  return (
    <section className="space-mission-strip" data-phase={phase} aria-label="Combustível da Missão">
      <div className="space-mission-title"><Fuel /><span><b>COMBUSTÍVEL DA MISSÃO</b><small>{realized.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de {target > 0 ? target.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "meta não definida"}</small></span></div>
      <div className="space-mission-track"><span style={{ width: `${progress}%` }} /><SpaceRocket className="space-mission-rocket" style={{ left: `${progress}%` }} /></div>
      <strong>{target > 0 ? `${progress.toFixed(0)}%` : "—"}</strong>
    </section>
  );
}
