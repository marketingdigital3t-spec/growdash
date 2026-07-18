import { useEffect, useState } from "react";

export type AccentTheme = "gold" | "purple" | "blue" | "pink";
const STORAGE_KEY = "growdash:accent-theme";

function readAccent(): AccentTheme {
  if (typeof window === "undefined") return "gold";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "purple" || value === "blue" || value === "pink" ? value : "gold";
}

function applyAccent(value: AccentTheme) {
  document.documentElement.dataset.accent = value;
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

