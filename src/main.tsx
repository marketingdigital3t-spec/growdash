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

// Do not mark the application as started here. Importing this module is not a
// successful React render: a runtime error in App (or one of its eager
// dependencies) used to leave the static loading screen on forever because
// index.html believed the app was already running. App now marks the boot only
// after React has committed a visible shell.
rootElement.dataset.build = "2026-08-12-loading-recovery";
createRoot(rootElement).render(<App />);
