import { Globe2, Rocket, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";

export type SpacePhase = "terra" | "orbita" | "galaxia";

const PHASE_COPY: Record<SpacePhase, { title: string; subtitle: string }> = {
  terra: { title: "GROWDASH — FASE TERRA", subtitle: "Missão em andamento — R$ 0 a R$ 100 mil" },
  orbita: { title: "GROWDASH — FASE ÓRBITA", subtitle: "Missão em aceleração — R$ 100 mil a R$ 500 mil" },
  galaxia: { title: "GROWDASH — FASE GALÁXIA", subtitle: "Missão no topo — acima de R$ 500 mil" },
};

function starCount(phase: SpacePhase) {
  return phase === "terra" ? 18 : phase === "orbita" ? 30 : 46;
}

export function SpacePhaseBackground({ phase }: { phase: SpacePhase }) {
  const copy = PHASE_COPY[phase];
  return (
    <div className="space-phase-bg" data-phase={phase} aria-hidden="true">
      <div className="space-phase-nebula" />
      <div className="space-phase-stars">{Array.from({ length: starCount(phase) }, (_, index) => <i key={index} style={{ "--star-x": `${(index * 47) % 100}%`, "--star-y": `${(index * 71) % 100}%`, "--star-delay": `${(index % 9) * 0.45}s` } as CSSProperties} />)}</div>
      {phase !== "terra" && <div className="space-phase-meteors"><i /><i />{phase === "galaxia" && <><i /><i /></>}</div>}
      <div className="space-phase-planet"><span className="space-phase-atmosphere" /><span className="space-phase-rings" /></div>
      <div className="space-phase-rocket"><Rocket /><span /></div>
      <div className="space-phase-badge"><Globe2 /><span><b>{copy.title}</b><small>{copy.subtitle}</small></span><em><Sparkles /> FASE: {phase === "orbita" ? "ÓRBITA" : phase.toUpperCase()}</em></div>
    </div>
  );
}
