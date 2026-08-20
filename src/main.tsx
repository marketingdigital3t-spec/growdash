import { createRoot } from "react-dom/client";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    __GROWDASH_BOOTED__?: boolean;
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
createRoot(rootElement).render(<App />);
