import { Fuel, Globe2, Rocket, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import earthTexture from "@/assets/growth/earth-2k-web.jpg";
import { EarthGlobe } from "./EarthGlobe";
import { SpaceRocket } from "./SpaceRocket";

/**
 * Textura do planeta Terra.
 *
 * A versao 8K 300 DPI (3,6 MB) nao entra no bundle JavaScript: ela e
 * servida como asset estatico e o browser so a baixa quando a textura de
 * alta resolucao faz sentido. A 2K (556 KB) fica no bundle como fallback
 * imediato, entao o planeta nunca aparece vazio enquanto o 8K carrega.
 */
const EARTH_8K_TEXTURE = "/assets/growth/earth-8k-300dpi.jpg";

export type SpacePhase = "terra" | "orbita" | "galaxia";

const PHASE_COPY: Record<SpacePhase, { title: string; subtitle: string }> = {
  terra: { title: "GROWDASH — FASE TERRA", subtitle: "Missão em andamento — R$ 0 a R$ 100 mil" },
  orbita: { title: "GROWDASH — FASE ÓRBITA", subtitle: "Missão em aceleração — R$ 100 mil a R$ 500 mil" },
  galaxia: { title: "GROWDASH — FASE GALÁXIA", subtitle: "Missão no topo — acima de R$ 500 mil" },
};

function starCount(phase: SpacePhase) {
  return phase === "terra" ? 18 : phase === "orbita" ? 30 : 46;
}

/**
 * Meteoros por fase. Terra tem poucos (a cena e mais calma), Orbita e
 * Galaxia aceleram. Cada um tem posicao e duracao proprias no CSS, entao
 * nunca caem em sincronia.
 */
function meteorCount(phase: SpacePhase) {
  return phase === "terra" ? 6 : phase === "orbita" ? 10 : 14;
}

export function SpacePhaseBackground({ phase, dashboardScene = false }: { phase: SpacePhase; dashboardScene?: boolean }) {
  const copy = PHASE_COPY[phase];
  const [globeReady, setGlobeReady] = useState(false);
  const handleGlobeReady = useCallback(() => setGlobeReady(true), []);
  return (
    <div
      className="space-phase-bg"
      data-phase={phase}
      data-dashboard-scene={dashboardScene || undefined}
      data-globe-ready={globeReady || undefined}
      style={{
        position: "relative",
        "--earth-texture": `url(${earthTexture})`,
        "--earth-texture-hd": `url(${EARTH_8K_TEXTURE})`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <div className="space-phase-nebula" />
      <div className="space-phase-stars" style={{ zIndex: 2, pointerEvents: "none" }}>{Array.from({ length: starCount(phase) }, (_, index) => <i key={index} style={{ "--star-x": `${(index * 47) % 100}%`, "--star-y": `${(index * 71) % 100}%`, "--star-delay": `${(index % 9) * 0.45}s` } as CSSProperties} />)}</div>
      {(dashboardScene || phase !== "terra") && <div className="space-phase-meteors">
        {Array.from({ length: meteorCount(phase) }, (_, index) => (
          <i key={index} />
        ))}
      </div>}
      {phase === "terra" && <EarthGlobe onReady={handleGlobeReady} />}
      <div className="space-phase-planet" style={phase === "terra" && globeReady ? { opacity: 0.14 } : undefined}><span className="space-phase-atmosphere" /><span className="space-phase-rings" /></div>
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
    <section className="space-mission-strip" data-phase={phase} aria-label="Meta de faturamento">
      <div className="space-mission-title"><Fuel /><span><b>META DE FATURAMENTO</b><small>{realized.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de {target > 0 ? target.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "meta não definida"}</small></span></div>
      <div className="space-mission-track"><span style={{ width: `${progress}%` }} /><SpaceRocket className="space-mission-rocket" style={{ left: `${progress}%` }} /></div>
      <strong>{target > 0 ? `${progress.toFixed(0)}%` : "—"}</strong>
    </section>
  );
}
