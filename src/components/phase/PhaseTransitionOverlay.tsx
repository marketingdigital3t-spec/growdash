import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { PHASES, type Phase } from "@/lib/phase/phase";
import { formatCurrency } from "@/lib/format/formatPtBr";
import { SpaceRocket } from "@/components/space/SpaceRocket";

interface PhaseTransitionOverlayProps {
  /** Se presente, dispara a animacao de evolucao da fase antiga para a nova. */
  transition: { from: Phase; to: Phase; revenue: number } | null;
  /** Chamado quando a animacao conclui ou o usuario clica em Pular. */
  onComplete: () => void;
}

/**
 * Animacao cinematografica de subida de fase (ETAPA 4).
 *
 * Conforme secao 8.1 do Prompt Mestre:
 * 1. Interface escurece e particulas aceleram (warp)
 * 2. Foguete cruza a tela deixando rastro que se transforma da cor antiga para a nova
 * 3. Surge o elemento cosmico novo com explosao de luz
 * 4. Texto central: "NOVA FASE DESBLOQUEADA" + nome em tipografia grande com glow
 * 5. Pulavel a qualquer momento com o botao "Pular"
 */
export function PhaseTransitionOverlay({ transition, onComplete }: PhaseTransitionOverlayProps) {
  const [step, setStep] = useState<"warp" | "rocket" | "reveal">("warp");

  useEffect(() => {
    if (!transition) return;
    setStep("warp");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Pula animacao se usuario tiver reducao de movimento ativa
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }

    const t1 = setTimeout(() => setStep("rocket"), 1000);
    const t2 = setTimeout(() => setStep("reveal"), 2800);
    const t3 = setTimeout(onComplete, 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [transition, onComplete]);

  if (!transition) return null;

  const targetInfo = PHASES[transition.to];
  const isGalaxia = transition.to === "galaxia";
  const isOrbita = transition.to === "orbita";

  const glowColor = isGalaxia ? "#B15CFF" : isOrbita ? "#FFC21A" : "#3D9BFF";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[500] flex flex-col items-center justify-center overflow-hidden bg-black/95 text-white backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Evolução para Fase ${targetInfo.label}`}
      >
        {/* Botao Pular fixo no canto superior direito */}
        <button
          type="button"
          onClick={onComplete}
          className="absolute right-6 top-6 z-30 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          Pular animação <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
        </button>

        {/* Fundo de estrelas em warp speed */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{
                x: `${(i * 37) % 100}vw`,
                y: `${(i * 71) % 100}vh`,
                scaleY: 1,
                opacity: 0.2,
              }}
              animate={{
                scaleY: step === "warp" ? 8 : 1,
                y: ["0vh", "100vh"],
                opacity: [0.2, 0.9, 0.2],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "linear",
                delay: (i % 8) * 0.1,
              }}
              className="absolute h-3 w-0.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"
            />
          ))}
        </div>

        {/* Trajetoria do foguete cruzando a tela */}
        {step === "rocket" && (
          <motion.div
            initial={{ x: "-20vw", y: "40vh", rotate: -35 }}
            animate={{ x: "120vw", y: "-20vh", rotate: -35 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
            className="pointer-events-none absolute z-20 flex items-center"
          >
            <div className="relative text-white drop-shadow-[0_0_24px_currentColor]">
              <SpaceRocket className="h-20 w-20" />
              {/* Rastro que muda de cor da fase anterior para a nova */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 0.85 }}
                transition={{ duration: 0.8 }}
                style={{
                  background: `linear-gradient(90deg, transparent, ${glowColor})`,
                  boxShadow: `0 0 20px ${glowColor}`,
                }}
                className="absolute right-full top-1/2 h-2 -translate-y-1/2 rounded-full"
              />
            </div>
          </motion.div>
        )}

        {/* Revelacao central da nova fase */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: step === "reveal" ? [0.9, 1.05, 1] : 0.95,
            opacity: step === "reveal" ? 1 : 0.6,
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex flex-col items-center px-4 text-center"
        >
          {/* Halo de luz expansivo */}
          <div
            style={{
              background: `radial-gradient(circle, ${glowColor}50 0%, transparent 70%)`,
            }}
            className="pointer-events-none absolute -inset-24 rounded-full blur-3xl opacity-80"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white/90 shadow-2xl backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-warning animate-spin [animation-duration:12s]" />
            Nova Fase Desbloqueada
          </span>

          <h2
            style={{ textShadow: `0 0 40px ${glowColor}` }}
            className="font-display mt-4 text-4xl font-extrabold uppercase tracking-tight sm:text-6xl lg:text-7xl"
          >
            FASE {targetInfo.label}
          </h2>

          <p className="mt-3 max-w-lg text-sm text-white/80 sm:text-base">
            Você atingiu {formatCurrency(transition.revenue)} no mês e alcançou um novo patamar na missão.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onComplete}
              style={{
                background: `linear-gradient(135deg, ${glowColor}, ${glowColor}dd)`,
                boxShadow: `0 0 24px -2px ${glowColor}`,
              }}
              className="rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:scale-105"
            >
              Continuar Missão
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
