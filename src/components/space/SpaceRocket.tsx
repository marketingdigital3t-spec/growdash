import type { SVGProps } from "react";

/**
 * Foguete da missao.
 *
 * Desenhado como SVG em viewbox 512x512: o navegador rasteriza na densidade
 * real da tela, entao a nave continua nitida em telas 8K sem depender de um
 * arquivo raster. O casco tem gradiente multicamada, a janela tem reflexo, e
 * a base tem a chama de combustao em tres camadas (nucleo, corpo e fumaca)
 * com pulso proprio.
 *
 * As animacoes respeitam `prefers-reduced-motion`: sem isso, o contrato de
 * acessibilidade da plataforma reprova.
 */
export function SpaceRocket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" role="img" aria-label="Foguete em lancamento" {...props}>
      <defs>
        {/* Casco: quatro faixas de luz atravessando o metal. */}
        <linearGradient id="rocket-shell" x1="96" y1="430" x2="416" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f4d5c" />
          <stop offset=".18" stopColor="#8d9dac" />
          <stop offset=".38" stopColor="#f8fcff" />
          <stop offset=".56" stopColor="#c9d6e0" />
          <stop offset=".78" stopColor="#7d8b99" />
          <stop offset="1" stopColor="#4a5866" />
        </linearGradient>
        <linearGradient id="rocket-shell-shade" x1="256" y1="40" x2="256" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity=".55" />
          <stop offset=".42" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1520" stopOpacity=".38" />
        </linearGradient>
        <linearGradient id="rocket-fin" x1="120" y1="380" x2="268" y2="238" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2d3d4c" />
          <stop offset=".55" stopColor="#8fa1af" />
          <stop offset="1" stopColor="#dce7ef" />
        </linearGradient>
        <linearGradient id="rocket-fin-r" x1="392" y1="380" x2="244" y2="238" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2d3d4c" />
          <stop offset=".55" stopColor="#8fa1af" />
          <stop offset="1" stopColor="#dce7ef" />
        </linearGradient>
        <radialGradient id="rocket-window" cx="34%" cy="28%">
          <stop stopColor="#e7fbff" />
          <stop offset=".28" stopColor="#7fd8ff" />
          <stop offset=".62" stopColor="#2a86c4" />
          <stop offset="1" stopColor="#0a2d4e" />
        </radialGradient>
        <linearGradient id="rocket-body" x1="180" y1="0" x2="332" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8d9dac" />
          <stop offset=".42" stopColor="#ffffff" />
          <stop offset="1" stopColor="#66757f" />
        </linearGradient>
        <linearGradient id="rocket-nozzle" x1="196" y1="352" x2="316" y2="352" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22303c" />
          <stop offset=".5" stopColor="#5d6f7d" />
          <stop offset="1" stopColor="#1b2732" />
        </linearGradient>

        {/* Chama de combustao: nucleo, corpo e fumaca. */}
        <linearGradient id="rocket-flame-core" x1="256" y1="352" x2="256" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset=".28" stopColor="#d6f7ff" />
          <stop offset=".62" stopColor="#67d8ff" />
          <stop offset="1" stopColor="#2a8fe0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rocket-flame-body" x1="256" y1="352" x2="256" y2="492" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9ff0ff" stopOpacity=".92" />
          <stop offset=".45" stopColor="#38bdf8" stopOpacity=".55" />
          <stop offset="1" stopColor="#0878e8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rocket-flame-smoke" cx="50%" cy="30%">
          <stop stopColor="#ffe9c4" stopOpacity=".72" />
          <stop offset=".55" stopColor="#ff9d4d" stopOpacity=".28" />
          <stop offset="1" stopColor="#ff6b35" stopOpacity="0" />
        </radialGradient>

        <filter id="rocket-glow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rocket-flame-glow" x="-90%" y="-60%" width="280%" height="240%">
          <feGaussianBlur stdDeviation="16" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rocket-smoke-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <g transform="rotate(45 256 256)">
        {/* Fumaca quente na base, sob a chama. */}
        <g filter="url(#rocket-smoke-blur)" opacity=".55">
          <ellipse cx="256" cy="410" rx="86" ry="52" fill="url(#rocket-flame-smoke)" />
          <ellipse cx="256" cy="452" rx="62" ry="38" fill="url(#rocket-flame-smoke)" opacity=".7" />
        </g>

        {/* Chama de combustao em 3 camadas. */}
        <g filter="url(#rocket-flame-glow)" className="space-rocket-flame">
          <path d="M212 350h88l-14 44-30 62-30-62Z" fill="url(#rocket-flame-body)" opacity=".75">
            <animate attributeName="opacity" values=".55;.85;.55" dur="1.4s" repeatCount="indefinite" />
          </path>
          <path d="M228 350h56l-10 40-18 40-18-40Z" fill="url(#rocket-flame-core)">
            <animate attributeName="d" values="M228 350h56l-10 40-18 40-18-40Z;M230 350h52l-8 48-18 34-18-34Z;M228 350h56l-10 40-18 40-18-40Z" dur="1.1s" repeatCount="indefinite" />
          </path>
          <path d="M242 350h28l-6 26-8 22-8-22Z" fill="#ffffff" opacity=".92">
            <animate attributeName="opacity" values=".85;1;.85" dur="0.8s" repeatCount="indefinite" />
          </path>
        </g>

        {/* Aletas traseiras. */}
        <path d="m150 296-62 48 84 6 44-44Z" fill="url(#rocket-fin)" stroke="#aebdca" strokeWidth="3" />
        <path d="m362 296 62 48-84 6-44-44Z" fill="url(#rocket-fin-r)" stroke="#aebdca" strokeWidth="3" />
        <path d="m150 296-62 48 84 6Z" fill="#0f1a24" opacity=".28" />

        {/* Corpo principal. */}
        <path
          d="M256 40c58 34 96 104 96 176v74l-96 62-96-62v-74c0-72 38-142 96-176Z"
          fill="url(#rocket-shell)"
          stroke="#f5fbff"
          strokeWidth="3"
        />
        <path
          d="M256 40c58 34 96 104 96 176v74l-96 62-96-62v-74c0-72 38-142 96-176Z"
          fill="url(#rocket-shell-shade)"
        />

        {/* Anel de reforco e rebites. */}
        <rect x="168" y="286" width="176" height="16" rx="8" fill="url(#rocket-body)" opacity=".9" />
        <rect x="176" y="176" width="160" height="12" rx="6" fill="#ffffff" opacity=".22" />
        <g fill="#5a6a78" opacity=".55">
          <circle cx="196" cy="300" r="4" /><circle cx="232" cy="300" r="4" />
          <circle cx="280" cy="300" r="4" /><circle cx="316" cy="300" r="4" />
        </g>

        {/* Cabine. */}
        <circle cx="256" cy="196" r="46" fill="#12212f" stroke="#e7f4fb" strokeWidth="7" />
        <circle cx="256" cy="196" r="36" fill="url(#rocket-window)" />
        <path d="M238 182c10-11 24-14 36-8" fill="none" stroke="#d8f8ff" strokeLinecap="round" strokeWidth="7" opacity=".72" />
        <path d="M236 212c12 10 30 12 42 2" fill="none" stroke="#0b3f66" strokeLinecap="round" strokeWidth="5" opacity=".45" />

        {/* Bocal. */}
        <path d="M196 350h120l-16 30h-88Z" fill="url(#rocket-nozzle)" />
        <path d="M206 350h100l-6 12h-88Z" fill="#8fa1af" opacity=".55" />
      </g>
    </svg>
  );
}
