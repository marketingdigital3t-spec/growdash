import { useCallback, useEffect, useState } from "react";

/**
 * Platform theme (fonte única de verdade do visual).
 *
 * Two independent dimensions:
 *   - `data-platform-theme` on <html> = the PALETTE (emerald = pure green,
 *     obsidian = pure purple neon). It only decides the accent colours.
 *   - the `.dark` class on <html>   = the READING MODE (light or dark),
 *     owned by next-themes. It only decides the surface colours.
 *
 * Every combination is valid, so Esmeralda can be read in light or dark and
 * Obsidian can be read in light or dark. The `.dark` class is kept in sync
 * because ~100 legacy rules in `index.css` still depend on it.
 */
export type AccentTheme = "terra" | "orbita" | "galaxia";
export type ReadingMode = "light" | "dark";
export const PLATFORM_THEME_STORAGE_KEY = "growdash:phase-theme";

export const PLATFORM_THEMES: { value: AccentTheme; label: string; description: string }[] = [
  { value: "terra", label: "Terra", description: "Fase inicial: azul cósmico e prata até R$ 50 mil." },
  { value: "orbita", label: "Órbita", description: "Fase de aceleração: dourado solar de R$ 50 mil a R$ 100 mil." },
  { value: "galaxia", label: "Galáxia", description: "Fase de escala máxima: púrpura e violeta neon acima de R$ 100 mil." },
];

function readAccent(): AccentTheme {
  try {
    const saved = window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY);
    if (saved === "orbita" || saved === "galaxia" || saved === "terra") return saved;
  } catch {}
  return "terra";
}

export function applyAccent(phase?: string) {
  const root = document.documentElement;
  const activePhase = (phase === "orbita" || phase === "galaxia") ? phase : (root.dataset.phase || root.dataset.spacePhase || "terra");
  const isGalaxia = activePhase === "galaxia";
  const isOrbita = activePhase === "orbita";

  const themeName = isGalaxia ? "galaxia" : isOrbita ? "orbita" : "terra";
  const themeColorHex = isGalaxia ? "#A855F7" : isOrbita ? "#FFC107" : "#00A8FF";

  root.dataset.accent = themeName;
  root.dataset.platformTheme = themeName;
  root.dataset.spacePhase = activePhase;
  root.dataset.phase = activePhase;
  root.classList.add("gd-premium");

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = themeColorHex;

  // Favicon dinamico na cor da fase ativa
  const stopColor = isGalaxia ? "#A855F7" : isOrbita ? "#FFC107" : "#E2E8F0";
  const gradient = `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF"/><stop offset=".55" stop-color="${stopColor}"/><stop offset="1" stop-color="#050505"/></linearGradient>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${gradient}</defs><path fill="url(#s)" d="M8 31 32 7l24 24-8 8-16-16-16 16z"/><path fill="url(#s)" d="m32 31 12 12-12 12-12-12z"/></svg>`;
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.type = "image/svg+xml";
  favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Applies the reading mode. The `.dark` class is owned by next-themes, so this
 * only mirrors the decision; it never derives the mode from the palette.
 */
export function applyReadingMode(mode: ReadingMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

/**
 * Keeps the palette applied and reports the current reading mode.
 *
 * The reading mode stays owned by next-themes (`localStorage["theme"]` plus a
 * `storage` event), because next-themes owns the `.dark` class and re-applies
 * it whenever it hydrates. Calling `setTheme` from an effect would fight that
 * hydration and could loop.
 */
export function useAccentTheme() {
  const [accent, setAccentState] = useState<AccentTheme>(readAccent);
  const [mode, setModeState] = useState<ReadingMode>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("theme") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  // Mirror next-themes' mode onto the document and keep local state in sync
  // so the appearance screen can show the active reading mode.
  useEffect(() => {
    const sync = () => {
      const next: ReadingMode = window.localStorage.getItem("theme") === "light" ? "light" : "dark";
      applyReadingMode(next);
      setModeState(next);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const setAccent = useCallback((value: AccentTheme) => {
    try {
      window.localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, value);
    } catch {
      // The preference remains active for this session if browser storage is blocked.
    }
    applyAccent(value);
    setAccentState(value);
  }, []);

  const setMode = useCallback((value: ReadingMode) => {
    try {
      window.localStorage.setItem("theme", value);
    } catch {
      // The preference remains active for this session if browser storage is blocked.
    }
    applyReadingMode(value);
    setModeState(value);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { accent, setAccent, mode, setMode };
}
