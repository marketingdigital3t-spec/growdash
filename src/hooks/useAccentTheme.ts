import { useEffect, useState } from "react";

export type AccentTheme = "gold" | "purple" | "blue" | "pink" | "sapphire" | "obsidian" | "emerald";
const STORAGE_KEY = "growdash:accent-theme";

const ACCENT_HEX: Record<AccentTheme, string> = {
  gold: "#b88722",
  blue: "#2f6bf4",
  purple: "#8b5cf6",
  pink: "#ec4899",
  sapphire: "#0ea5e9",
  obsidian: "#a8b0bd",
  emerald: "#10b981",
};

function readAccent(): AccentTheme {
  if (typeof window === "undefined") return "gold";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && value in ACCENT_HEX ? value as AccentTheme : "gold";
  } catch {
    return "gold";
  }
}

export function applyAccent(value: AccentTheme) {
  document.documentElement.dataset.accent = value;

  const color = ACCENT_HEX[value];
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = color;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="${color}" d="M8 31 32 7l24 24-8 8-16-16-16 16z"/><path fill="${color}" d="m32 31 12 12-12 12-12-12z"/></svg>`;
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
      // A preferência continua válida nesta sessão quando o navegador bloqueia storage.
    }
    applyAccent(value);
    setAccentState(value);
  };

  return { accent, setAccent };
}
