import { useEffect, useState } from "react";

export type AccentTheme = "gold" | "purple" | "blue" | "pink";
const STORAGE_KEY = "growdash:accent-theme";

const ACCENT_HEX: Record<AccentTheme, string> = {
  gold: "#e6ad28",
  blue: "#2f6bf4",
  purple: "#8b5cf6",
  pink: "#ec4899",
};

function readAccent(): AccentTheme {
  if (typeof window === "undefined") return "gold";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "purple" || value === "blue" || value === "pink" ? value : "gold";
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
    window.localStorage.setItem(STORAGE_KEY, value);
    applyAccent(value);
    setAccentState(value);
  };

  return { accent, setAccent };
}
