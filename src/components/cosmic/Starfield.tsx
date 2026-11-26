import { useEffect, useRef } from "react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";
import type { Phase } from "@/lib/phase/phase";

type Star = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
  layer: number; // 1, 2 ou 3 para efeito parallax com velocidades diferentes
};

function starCountForPhase(phase: Phase): number {
  switch (phase) {
    case "terra":
      return 85;
    case "orbita":
      return 140;
    case "galaxia":
      return 220;
  }
}

/**
 * Fundo estrelado em Canvas 2D nativo.
 *
 * Desenhado diretamente em canvas com 60fps, sem three.js. Aplica leve
 * parallax suave no movimento do mouse e respeita estritamente
 * `prefers-reduced-motion` congelando o frame.
 */
export function Starfield({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phase = useEffectivePhase();
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      mouseRef.current.targetX = (event.clientX - midX) / midX;
      mouseRef.current.targetY = (event.clientY - midY) / midY;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Inicializar estrelas com base na fase
    const count = starCountForPhase(phase);
    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.6 + 0.5,
      alpha: Math.random() * 0.7 + 0.2,
      alphaSpeed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      layer: Math.floor(Math.random() * 3) + 1,
    }));

    // Pega cor da fase computada no documento
    const computed = getComputedStyle(document.documentElement);
    const primaryNeon = computed.getPropertyValue("--primary-neon").trim() || "#00FF88";

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Parallax interpolado suavemente (lerp)
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;
      const mouseOffset = mouseRef.current;

      for (const star of stars) {
        if (!reducedMotion) {
          // Cintilação suave
          star.alpha += star.alphaSpeed;
          if (star.alpha > 0.95 || star.alpha < 0.15) {
            star.alphaSpeed = -star.alphaSpeed;
          }
        }

        // Parallax por camada (estrelas mais proximas se movem mais)
        const offsetX = mouseOffset.x * star.layer * 9;
        const offsetY = mouseOffset.y * star.layer * 9;
        let drawX = (star.x + offsetX) % width;
        let drawY = (star.y + offsetY) % height;
        if (drawX < 0) drawX += width;
        if (drawY < 0) drawY += height;

        ctx.beginPath();
        ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 246, 255, ${Math.max(0.1, Math.min(1, star.alpha))})`;
        ctx.fill();

        // 1 em cada 10 estrelas ganha halo colorido com a cor neon da fase
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, star.size * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = primaryNeon;
          ctx.globalAlpha = star.alpha * 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
    };
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`gd-starfield-layer pointer-events-none fixed inset-0 z-[-2] h-full w-full ${className}`}
    />
  );
}
