import { useCallback, useEffect, useState } from "react";

/**
 * Platform theme (fonte única de verdade do visual).
 *
 * The platform ships ONE palette — Esmeralda Neon — and two reading modes:
 *   - `data-platform-theme` on <html> = always "emerald" (the accent
 *     colours: emerald neon, glass, luminous borders).
 *   - the `.dark` class on <html>   = the READING MODE (light or dark),
 *     owned by next-themes. It only decides the surface colours.
 *
 * The `.dark` class is kept in sync because ~100 legacy rules in
 * `index.css` still depend on it.
 */
export type AccentTheme = "emerald";
export type ReadingMode = "light" | "dark";
export const PLATFORM_THEME_STORAGE_KEY = "growdash:accent-theme";

const ACCENT: Record<AccentTheme, { html: string; color: string }> = {
  emerald: { html: "emerald", color: "#F4F8F6" },
};

/**
 * The platform palette is fixed. The reading mode lives in `localStorage`
 * under "theme" and is owned by next-themes.
 */
function readAccent(): AccentTheme {
  return "emerald";
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

  // The favicon follows the single platform palette: emerald neon.
  const gradient = `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D1FAE5"/><stop offset=".45" stop-color="#00FF88"/><stop offset="1" stop-color="#047857"/></linearGradient>`;
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
