import { useCallback, useEffect, useState } from "react";

/**
 * Platform theme (fonte única de verdade do visual).
 *
 * Two independent dimensions:
 *   - `data-platform-theme` on <html> = the PALETTE (emerald = green,
 *     obsidian = purple). It only decides the accent colours.
 *   - the `.dark` class on <html>   = the READING MODE (light or dark),
 *     owned by next-themes. It only decides the surface colours.
 *
 * Every combination is valid, so Esmeralda can be read in light or dark and
 * Obsidian can be read in light or dark. The `.dark` class is kept in sync
 * because ~100 legacy rules in `index.css` still depend on it.
 */
export type AccentTheme = "obsidian" | "emerald";
export type ReadingMode = "light" | "dark";
export const PLATFORM_THEME_STORAGE_KEY = "growdash:accent-theme";

const ACCENT: Record<AccentTheme, { html: string; color: string }> = {
  obsidian: { html: "obsidian", color: "#07090E" },
  emerald: { html: "emerald", color: "#F4F8F6" },
};

export const PLATFORM_THEMES: { value: AccentTheme; label: string; description: string }[] = [
  { value: "obsidian", label: "Obsidian", description: "Paleta violeta sobre preto cósmico." },
  { value: "emerald", label: "Esmeralda", description: "Paleta verde sobre superfícies translúcidas." },
];

/**
 * Resolves the platform palette. This MUST mirror the inline bootstrap in
 * `index.html` exactly: when the bootstrap writes `obsidian` because the
 * browser prefers dark, the hook has to agree, otherwise next-themes
 * re-applies the `.dark` class right after and the two layers fight.
 */
function readAccent(): AccentTheme {
  try {
    const saved = window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY);
    if (saved === "obsidian" || saved === "emerald") return saved;
  } catch {
    // Storage is blocked; fall through to the system preference.
  }
  if (typeof window === "undefined") return "emerald";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "obsidian" : "emerald";
}

export function applyAccent(value: AccentTheme) {
  const palette = ACCENT[value];
  const root = document.documentElement;
  root.dataset.accent = palette.html;
  root.dataset.platformTheme = palette.html;
  // `gd-premium` anchors the premium layer above the legacy theme rules.
  root.classList.add("gd-premium");

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = palette.color;

  // The favicon follows the palette, so Esmeralda stays green and Obsidian
  // stays purple no matter the reading mode.
  const gradient = value === "obsidian"
    ? `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2D0B4F"/><stop offset=".42" stop-color="#8A2BE2"/><stop offset=".7" stop-color="#4C1D95"/><stop offset="1" stop-color="#A855F7"/></linearGradient>`
    : `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D1FAE5"/><stop offset=".45" stop-color="#34D399"/><stop offset="1" stop-color="#047857"/></linearGradient>`;
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
