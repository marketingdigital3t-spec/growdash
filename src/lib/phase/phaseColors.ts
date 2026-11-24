/**
 * Cores oficiais dos 3 departamentos de fase da Growdash.
 *
 * Cada departamento de fase tem uma identidade visual própria:
 *
 * - Terra: azul intenso e prateado (fase inicial, construção)
 * - Órbita: dourado solar vibrante (fase de aceleração)
 * - Galáxia: púrpura e violeta neon (fase de escala máxima)
 */
export type Phase = "terra" | "orbita" | "galaxia";

export type PhaseColor = {
  /** Cor principal da fase (usada em textos, bordas, ícones) */
  primary: string;
  /** Cor de brilho/luz da fase (usada em sombras e neblinas) */
  glow: string;
  /** Cor secundária (usada em elementos secundários) */
  secondary: string;
  /** Cor de destaque (usada em destaques e destaques) */
  accent: string;
  /** Cor de fundo (usada em painéis e cards) */
  background: string;
  /** Cor de texto sobre o fundo */
  text: string;
};

/**
 * Paleta de cores dos 3 departamentos de fase.
 * Cada cor foi escolhida para ser distinta e vibrante, sem mistura de cores
 * entre os departamentos.
 */
export const PHASE_COLORS: Record<Phase, PhaseColor> = {
  terra: {
    primary: "#00A8FF",      // Azul intenso e profundo
    glow: "rgba(0,168,255,.25)", // Brilho azul elétrico
    secondary: "#4EB5FF",    // Azul claro secundário
    accent: "#38BDF8",       // Azul ciano de destaque
    background: "rgba(0,168,255,.05)", // Fundo azul muito sutil
    text: "#00A8FF",         // Texto azul intenso
  },
  orbita: {
    primary: "#FFC107",      // Dourado solar vibrante
    glow: "rgba(255,193,7,.35)", // Brilho dourado intenso
    secondary: "#FFD54F",    // Dourado claro secundário
    accent: "#FFE082",       // Dourado claro de destaque
    background: "rgba(255,193,7,.05)", // Fundo dourado muito sutil
    text: "#FFC107",         // Texto dourado solar
  },
  galaxia: {
    primary: "#A855F7",      // Púrpura e violeta neon
    glow: "rgba(142,68,173,.3)", // Brilho púrpura neon
    secondary: "#D8B4FE",    // Púrpura claro secundário
    accent: "#E879F9",       // Púrpura neon de destaque
    background: "rgba(142,68,173,.05)", // Fundo púrpura muito sutil
    text: "#A855F7",         // Texto púrpura neon
  },
};

/**
 * Retorna as cores de uma fase específica.
 * Se a fase for inválida, retorna a de "terra" como fallback.
 */
export function getPhaseColors(phase: unknown): PhaseColor {
  const safePhase = sanitizePhase(phase);
  return PHASE_COLORS[safePhase];
}

import { sanitizePhase } from "./phase";
