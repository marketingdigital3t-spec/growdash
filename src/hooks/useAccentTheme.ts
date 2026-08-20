import { useEffect, useState } from "react";

export type AccentTheme = "monochrome" | "metallic-gold";
const STORAGE_KEY = "growdash:accent-theme";

const ACCENT: Record<AccentTheme, { html: string; color: string }> = {
  monochrome: { html: "monochrome", color: "#e4e4e4" },
  "metallic-gold": { html: "metallic-gold", color: "#c98a24" },
};

function readAccent(): AccentTheme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // Versions prior to the selector stored "gold" while still rendering the
    // monochrome palette. Preserve that visual preference on upgrade.
    return saved === "metallic-gold" ? "metallic-gold" : "monochrome";
  } catch {
    return "monochrome";
  }
}

export function applyAccent(value: AccentTheme) {
  const palette = ACCENT[value];
  document.documentElement.dataset.accent = palette.html;

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = palette.color;

  const gradient = value === "metallic-gold"
    ? `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7a4407"/><stop offset=".42" stop-color="#f7d36a"/><stop offset=".7" stop-color="#b87616"/><stop offset="1" stop-color="#fff0a0"/></linearGradient>`
    : `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#9a9a9a"/></linearGradient>`;
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

export function useAccentTheme() {
  const [accent, setAccentState] = useState<AccentTheme>(readAccent);

  useEffect(() => applyAccent(accent), [accent]);

  const setAccent = (value: AccentTheme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The preference remains active for this session if browser storage is blocked.
    }
    applyAccent(value);
    setAccentState(value);
  };

  return { accent, setAccent };
}
