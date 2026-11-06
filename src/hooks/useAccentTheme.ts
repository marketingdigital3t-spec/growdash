import { useCallback, useEffect, useState } from "react";

/**
 * Platform theme (fonte única de verdade do visual).
 *
 * `obsidian` é o tema escuro cósmico (deep matte black + nebulosa roxa) e
 * `emerald` é o tema claro elegante (translúcido esverdeado). O atributo
 * `data-platform-theme` no <html> é o contrato consumido pelo design system;
 * a classe `.dark` é mantida sincronizada porque ~100 regras legadas de
 * `index.css` ainda dependem dela.
 */
export type AccentTheme = "obsidian" | "emerald";
export const PLATFORM_THEME_STORAGE_KEY = "growdash:accent-theme";

const ACCENT: Record<AccentTheme, { html: string; color: string; isDark: boolean }> = {
  obsidian: { html: "obsidian", color: "#07090E", isDark: true },
  emerald: { html: "emerald", color: "#F4F8F6", isDark: false },
};

export const PLATFORM_THEMES: { value: AccentTheme; label: string; description: string }[] = [
  { value: "obsidian", label: "Obsidian", description: "Preto profundo cósmico, nebulosa violeta e dados em destaque." },
  { value: "emerald", label: "Esmeralda", description: "Claro translúcido esverdeado, alto contraste e leitura confortável." },
];

function readAccent(): AccentTheme {
  try {
    const saved = window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY);
    // Legacy prefs (gold/monochrome) migrate to the emerald light theme.
    return saved === "obsidian" ? "obsidian" : "emerald";
  } catch {
    return "emerald";
  }
}

export function applyAccent(value: AccentTheme) {
  const palette = ACCENT[value];
  const root = document.documentElement;
  root.dataset.accent = palette.html;
  root.dataset.platformTheme = palette.html;
  root.classList.toggle("dark", palette.isDark);

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = palette.color;

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
 * Keeps next-themes in sync with the platform theme so `useTheme()` consumers
 * (toasts, sidebar toggle, settings switch) all report the same state.
 */
export function useAccentTheme() {
  const [accent, setAccentState] = useState<AccentTheme>(readAccent);

  useEffect(() => {
    applyAccent(accent);
    document.documentElement.style.colorScheme = ACCENT[accent].isDark ? "dark" : "light";
  }, [accent]);

  const setAccent = useCallback((value: AccentTheme) => {
    try {
      window.localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, value);
      window.localStorage.setItem("theme", value === "obsidian" ? "dark" : "light");
    } catch {
      // The preference remains active for this session if browser storage is blocked.
    }
    applyAccent(value);
    setAccentState(value);
  }, []);

  return { accent, setAccent };
}
