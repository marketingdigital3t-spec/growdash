import type { Phase } from "@/lib/phase/phase";
import { useEffectivePhase } from "@/lib/phase/phaseStore";

/**
 * Elemento cosmico exclusivo de cada fase, posicionado no canto superior direito.
 *
 * - TERRA: Planeta azul iluminado no limbo, linhas orbitais finas pontilhadas.
 * - ORBITA: Planeta com aneis dourados brilhantes, cometa cruzando o fundo.
 * - GALAXIA: Galaxia espiral roxa neon, nebulosa profunda e particulas densas.
 */
export function CosmicObject({ overridePhase, className = "" }: { overridePhase?: Phase; className?: string }) {
  const activePhase = useEffectivePhase();
  const phase = overridePhase ?? activePhase;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed right-0 top-0 z-[-1] overflow-hidden ${className}`}
      style={{ width: "min(42vw, 560px)", height: "min(42vw, 560px)" }}
    >
      {phase === "terra" && <EarthCosmicObject />}
      {phase === "orbita" && <RingedPlanetCosmicObject />}
      {phase === "galaxia" && <SpiralGalaxyCosmicObject />}
    </div>
  );
}

/** Planeta Terra azul iluminado no limbo */
function EarthCosmicObject() {
  return (
    <div className="relative h-full w-full">
      {/* Halos de atmosfera azul neon */}
      <div className="absolute -right-24 -top-24 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(46,123,255,0.35)_0%,rgba(0,212,255,0.18)_42%,transparent_72%)] blur-2xl" />
      {/* Globo iluminado cortado pela borda */}
      <div className="absolute -right-16 -top-16 h-[380px] w-[380px] rounded-full border border-sky-400/30 bg-[radial-gradient(circle_at_30%_30%,#1e5bff_0%,#0a1d4a_55%,#030814_85%)] shadow-[inset_0_0_60px_rgba(0,212,255,0.45),0_0_50px_rgba(61,155,255,0.35)]">
        {/* Limbo atmosferico brilhante */}
        <span className="absolute inset-0 rounded-full border-2 border-sky-300/40 opacity-75 blur-[1px]" />
        <span className="absolute inset-2 rounded-full bg-[radial-gradient(ellipse_at_25%_25%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
      </div>
      {/* Linhas orbitais pontilhadas */}
      <svg className="absolute -right-36 -top-36 h-[540px] w-[540px] stroke-sky-400/25" viewBox="0 0 540 540" fill="none">
        <ellipse cx="270" cy="270" rx="220" ry="110" strokeDasharray="4 8" transform="rotate(-25 270 270)" strokeWidth="1" />
        <ellipse cx="270" cy="270" rx="260" ry="130" strokeDasharray="2 12" transform="rotate(-15 270 270)" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** Planeta com aneis dourados brilhantes da Orbita */
function RingedPlanetCosmicObject() {
  return (
    <div className="relative h-full w-full">
      {/* Halo dourado/ambar */}
      <div className="absolute -right-24 -top-24 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,194,26,0.32)_0%,rgba(255,122,26,0.18)_45%,transparent_72%)] blur-2xl" />
      {/* Planeta base */}
      <div className="absolute -right-12 -top-12 h-[340px] w-[340px] rounded-full border border-amber-300/40 bg-[radial-gradient(circle_at_35%_35%,#ffe08a_0%,#f5a623_38%,#8a4b00_75%,#0d0701_100%)] shadow-[inset_0_0_55px_rgba(255,226,122,0.4),0_0_45px_rgba(255,184,28,0.4)]" />
      {/* Aneis dourados luminosos */}
      <svg className="absolute -right-36 -top-20 h-[480px] w-[560px] pointer-events-none" viewBox="0 0 560 480" fill="none">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#FFC21A" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#FF7A1A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <ellipse cx="300" cy="200" rx="240" ry="64" stroke="url(#ringGrad)" strokeWidth="6" transform="rotate(-28 300 200)" />
        <ellipse cx="300" cy="200" rx="255" ry="68" stroke="url(#ringGrad)" strokeWidth="1.5" strokeDasharray="6 4" transform="rotate(-28 300 200)" opacity="0.7" />
      </svg>
      {/* Rastro de cometa cruzando */}
      <span className="absolute right-48 top-16 h-0.5 w-36 -rotate-45 bg-gradient-to-l from-amber-200 via-amber-400 to-transparent shadow-[0_0_8px_#ffc21a] opacity-80" />
    </div>
  );
}

/** Galaxia espiral roxa neon */
function SpiralGalaxyCosmicObject() {
  return (
    <div className="relative h-full w-full">
      {/* Nebulosa violeta profunda */}
      <div className="absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(224,64,251,0.30)_0%,rgba(139,61,255,0.22)_40%,rgba(76,29,149,0.14)_60%,transparent_75%)] blur-2xl" />
      {/* Nucleo da galaxia espiral */}
      <div className="absolute -right-8 -top-8 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_45%_45%,#ffffff_0%,#d8b4fe_18%,#b15cff_45%,#6a1bff_75%,transparent_90%)] shadow-[0_0_65px_rgba(177,92,255,0.65),0_0_120px_rgba(224,64,251,0.4)] opacity-95">
        {/* Bracos espirais estilizados com SVG */}
        <svg className="absolute inset-0 h-full w-full animate-[spin_60s_linear_infinite] motion-reduce:animate-none" viewBox="0 0 360 360" fill="none">
          <path d="M180,180 Q230,120 290,140 T340,220" stroke="rgba(224,64,251,0.65)" strokeWidth="3" fill="none" filter="blur(1px)" />
          <path d="M180,180 Q130,240 70,220 T20,140" stroke="rgba(177,92,255,0.65)" strokeWidth="3" fill="none" filter="blur(1px)" />
          <path d="M180,180 Q240,230 220,290 T140,340" stroke="rgba(216,180,254,0.55)" strokeWidth="2" fill="none" />
          <path d="M180,180 Q120,130 140,70 T220,20" stroke="rgba(216,180,254,0.55)" strokeWidth="2" fill="none" />
        </svg>
      </div>
      {/* Estrelas cadentes na Galaxia */}
      <span className="absolute right-64 top-24 h-0.5 w-44 -rotate-45 bg-gradient-to-l from-white via-fuchsia-300 to-transparent shadow-[0_0_10px_#e040fb] opacity-85" />
    </div>
  );
}
