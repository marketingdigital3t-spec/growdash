import type { SVGProps } from "react";

/** Decorative mission rocket matching the spatial dashboard reference. */
export function SpaceRocket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label="Foguete em lançamento" {...props}>
      <defs>
        <linearGradient id="rocket-shell" x1="20" y1="78" x2="76" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7d8b99" />
          <stop offset=".38" stopColor="#f7fbff" />
          <stop offset=".68" stopColor="#bcc8d2" />
          <stop offset="1" stopColor="#667685" />
        </linearGradient>
        <linearGradient id="rocket-fin" x1="25" y1="72" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f5364" />
          <stop offset="1" stopColor="#cbd7e0" />
        </linearGradient>
        <radialGradient id="rocket-window" cx="35%" cy="30%">
          <stop stopColor="#b9efff" />
          <stop offset=".42" stopColor="#318bc3" />
          <stop offset="1" stopColor="#103c67" />
        </radialGradient>
        <linearGradient id="rocket-flame" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e7fbff" />
          <stop offset=".38" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0878e8" stopOpacity="0" />
        </linearGradient>
        <filter id="rocket-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform="rotate(45 48 48)" filter="url(#rocket-glow)">
        <path d="M48 7c12 7 20 22 20 37v17l-20 12-20-12V44c0-15 8-30 20-37Z" fill="url(#rocket-shell)" stroke="#f5fbff" strokeWidth="1.2" />
        <path d="m28 55-13 10 17 1 9-9Z" fill="url(#rocket-fin)" stroke="#8fa1af" strokeWidth="1" />
        <path d="m68 55 13 10-17 1-9-9Z" fill="url(#rocket-fin)" stroke="#8fa1af" strokeWidth="1" />
        <circle cx="48" cy="39" r="9" fill="#172b3c" stroke="#e7f4fb" strokeWidth="2" />
        <circle cx="48" cy="39" r="6.5" fill="url(#rocket-window)" />
        <path d="M44 36c2-2 4-2 6-1" fill="none" stroke="#d8f8ff" strokeLinecap="round" strokeWidth="1.5" opacity=".75" />
        <path d="M41 72h14l-3 8h-8Z" fill="#394d5d" />
        <path d="M43 79h10l-5 15Z" fill="url(#rocket-flame)" />
        <path d="M46 80h4l-2 9Z" fill="#efffff" opacity=".9" />
      </g>
    </svg>
  );
}
