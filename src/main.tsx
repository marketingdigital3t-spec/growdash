import { createRoot } from "react-dom/client";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;
rootElement.dataset.build = "2026-07-18-dashboard-restore";
createRoot(rootElement).render(<App />);
