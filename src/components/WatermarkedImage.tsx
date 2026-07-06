import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;                 // object URL (blob:) descriptografado
  viewer: { name: string; email: string };
  onClose: () => void;
};

/**
 * Renderiza a foto descriptografada com marca d'água dinâmica em tiles diagonais.
 * A imagem é desenhada em canvas com o overlay embutido, então mesmo que a pessoa
 * consiga um print, o watermark identifica quem visualizou (rastreabilidade LGPD).
 * Também bloqueia clique-direito, arrastar e seleção.
 */
export default function WatermarkedImage({ src, viewer, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = Math.min(window.innerWidth * 0.9, 1400);
      const maxH = window.innerHeight * 0.9;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Tile watermark
      const label = `${viewer.name} • ${viewer.email} • ${new Date().toLocaleString("pt-BR")} • CONFIDENCIAL`;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.font = "600 14px system-ui, -apple-system, sans-serif";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);
      const step = 220;
      const cols = Math.ceil(canvas.width / step) + 4;
      const rows = Math.ceil(canvas.height / step) + 4;
      for (let r = -rows; r < rows; r++) {
        for (let c = -cols; c < cols; c++) {
          const x = c * step;
          const y = r * 60;
          ctx.strokeText(label, x, y);
          ctx.fillText(label, x, y);
        }
      }
      ctx.restore();
      setReady(true);
    };
    img.src = src;
  }, [src, viewer]);

  return (
    <div
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[110] grid place-items-center bg-black/95 p-6"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/20"
      >
        Fechar
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className="relative"
      >
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-[90vh] max-w-[90vw] rounded-2xl select-none"
          style={{ pointerEvents: "auto", userSelect: "none", WebkitUserSelect: "none" }}
        />
        {!ready && <p className="absolute inset-0 grid place-items-center text-white/70">Descriptografando…</p>}
      </div>
      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
        Toda visualização é registrada • uso indevido pode ser rastreado
      </p>
    </div>
  );
}
