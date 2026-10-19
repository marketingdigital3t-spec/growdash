import { readFile, mkdir, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const sourcePath = process.env.TRAFEGO_SOURCE ?? "public/apresentacao-trafego-pago/index.html";
const outputPaths = [
  "public/apresentacao-trafego-pago/index.html",
  "public/apresentaçao-trafego-pago/index.html",
];

const source = await readFile(sourcePath, "utf8");
const dom = new JSDOM(source);
const { document } = dom.window;

document.documentElement.lang = "pt-BR";
document.title = "Thiego — Estratégia & Tráfego | Growdash";
document.querySelector('link[rel="stylesheet"]')?.remove();

document.querySelectorAll("a[href]").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href?.startsWith("https://skip-artifacts-snapshots.application.production.adapta.tools")) return;
  const hashIndex = href.indexOf("#");
  link.setAttribute("href", hashIndex >= 0 ? href.slice(hashIndex) : "#inicio");
});

const clearInline = (selector, properties) => {
  document.querySelectorAll(selector).forEach((element) => {
    properties.forEach((property) => element.style.removeProperty(property));
  });
};

// Remove only the transient styles captured by the original snapshot. The
// original scroll/parallax/tilt scripts still own those values after load.
clearInline("#scrollProgress", ["width"]);
clearInline("#cursorGlow", ["transform", "opacity"]);
clearInline(".ambient-orb", ["transform"]);
clearInline("#heroLeftCol, #heroRightCol", ["transform", "opacity"]);
clearInline(".scroll-parallax-item, .tilt-card", ["transform"]);
document.querySelectorAll("[data-section-head].in-focus").forEach((element) => element.classList.remove("in-focus"));

// The source snapshot captures only the elements that were visible when it
// was exported. Activate every reveal in the static route so a fast scroll or
// a deep-link never leaves sections blank before IntersectionObserver runs.
document.querySelectorAll(".reveal").forEach((element) => element.classList.add("active"));

// The shell chart helpers are unused on this page and add parse/execute cost.
document.querySelectorAll("script").forEach((script) => {
  if (script.textContent.includes("Skip artifact shell — fixed helpers")) script.remove();
});

const performanceStyle = document.createElement("style");
document.querySelectorAll("style").forEach((style) => {
  if (style.textContent.includes("Static presentation route:")) style.remove();
});
performanceStyle.textContent = `
  /* Static presentation route: keep first paint light while preserving the source effects. */
  .particles-canvas { contain: strict; }
  @media (prefers-reduced-motion: reduce) {
    .ambient-orb, .metric-card, #servicos .icon-box, .marquee-track, .pulse-dot, .floating-wa::before { animation: none !important; }
  }
`;
document.head.appendChild(performanceStyle);

const output = `<!doctype html>\n${document.documentElement.outerHTML}\n`;
for (const outputPath of outputPaths) {
  await mkdir(outputPath.substring(0, outputPath.lastIndexOf("/")), { recursive: true });
  await writeFile(outputPath, output);
}

console.log(`Prepared ${outputPaths.length} static traffic presentation routes.`);
