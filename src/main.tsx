import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles/tokens.css";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    __GROWDASH_BOOTED__?: boolean;
    /** Local base path for Excalidraw's bundled font assets. */
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

const rootElement = document.getElementById("root")!;

// The entry module has loaded successfully. Mark this synchronously so the
// static HTML watchdog never replaces a healthy React application after a
// slow route, permission query, or data request. Runtime errors are handled by
// the React error boundaries instead of an HTML-level screen replacement.
rootElement.dataset.build = "2026-08-12-loading-recovery";
rootElement.dataset.growdashBooted = "true";
window.__GROWDASH_BOOTED__ = true;
// Excalidraw falls back to esm.sh when this path is not configured. The
// production CSP intentionally blocks that remote font origin, so point it
// at the self-hosted assets shipped under public/excalidraw instead.
window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";
createRoot(rootElement).render(<App />);
