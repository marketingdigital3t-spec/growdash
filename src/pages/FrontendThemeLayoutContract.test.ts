import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../index.css", import.meta.url)),
  "utf8",
);
const businessPage = readFileSync(
  fileURLToPath(new URL("../growdash/BusinessWorkspacePage.tsx", import.meta.url)),
  "utf8",
);
const incompleteLeadsPage = readFileSync(
  fileURLToPath(new URL("./LeadsIncompletos.tsx", import.meta.url)),
  "utf8",
);
const announcementsPage = readFileSync(
  fileURLToPath(new URL("../growdash/AnnouncementsPage.tsx", import.meta.url)),
  "utf8",
);
const whatsappPage = readFileSync(
  fileURLToPath(new URL("./WhatsApp.tsx", import.meta.url)),
  "utf8",
);
const modulePage = readFileSync(
  fileURLToPath(new URL("../growdash/ModulePage.tsx", import.meta.url)),
  "utf8",
);
const financePage = readFileSync(
  fileURLToPath(new URL("../growdash/FinancePage.tsx", import.meta.url)),
  "utf8",
);
const settingsPage = readFileSync(
  fileURLToPath(new URL("./Settings.tsx", import.meta.url)),
  "utf8",
);
const themePicker = readFileSync(
  fileURLToPath(new URL("../components/settings/PlatformThemePicker.tsx", import.meta.url)),
  "utf8",
);
const premiumStyles = readFileSync(
  fileURLToPath(new URL("../styles/premium.css", import.meta.url)),
  "utf8",
);
const platformRules = readFileSync(
  fileURLToPath(new URL("../components/settings/PlatformRulesSection.tsx", import.meta.url)),
  "utf8",
);
const customMetrics = readFileSync(
  fileURLToPath(new URL("../components/settings/CustomMetricsSection.tsx", import.meta.url)),
  "utf8",
);
const flowTopBar = readFileSync(
  fileURLToPath(new URL("../components/GrowdashFlow/components/TopBar.tsx", import.meta.url)),
  "utf8",
);
const expertDashboard = readFileSync(
  fileURLToPath(new URL("./ExpertDashboard.tsx", import.meta.url)),
  "utf8",
);
const funnelAudienceProfile = readFileSync(
  fileURLToPath(new URL("../components/funnel-analysis/FunnelAudienceProfile.tsx", import.meta.url)),
  "utf8",
);

describe("frontend theme and responsive contracts", () => {
  it("keeps the campaign card stack measurable on mobile", () => {
    expect(css).toContain(
      '.campaigns-workspace[data-scroll-mode="locked"] .campaign-table-frame { height: auto !important;',
    );
    expect(css).toContain(
      '.campaigns-workspace[data-scroll-mode="locked"] .campaign-table-frame > .space-y-2 { max-height: none !important;',
    );
  });

  it("uses theme tokens for the Business workspace and preserves external links", () => {
    expect(businessPage).toContain("border-border bg-card text-foreground");
    expect(businessPage).toContain('target="_blank"');
    expect(businessPage).not.toContain("border-slate-200 bg-white text-slate-900");
  });

  it("names bulk-selection checkboxes for assistive technology", () => {
    expect(incompleteLeadsPage).toContain('aria-label="Selecionar todos os leads incompletos"');
    expect(incompleteLeadsPage).toContain("aria-label={`Selecionar ${s.contact_name || s.contact_email || s.id}`}");
    expect(announcementsPage).toContain("aria-label={label}");
  });

  it("names icon-only actions and switches across audited modules", () => {
    expect(whatsappPage).toContain('aria-label="Enviar mensagem"');
    expect(modulePage).toContain("aria-label={`Excluir automação ${automation.name}`}");
    expect(financePage).toContain('aria-label="Incluir imposto Meta no cálculo"');
    expect(settingsPage).toContain("PlatformThemePicker");
    expect(themePicker).toContain('aria-label="Modo de leitura da plataforma"');
    expect(themePicker).toContain('aria-pressed={active}');
    expect(platformRules).toContain('aria-label="Ativar regra"');
    expect(platformRules).toContain('aria-label="Usar como fallback"');
    expect(customMetrics).toContain('aria-label="Usar como Lead padrão"');
    expect(flowTopBar).toContain('aria-label="Limpar quadro"');
  });

  it("keeps the Expert brand and read-only badge legible in the light theme", () => {
    expect(expertDashboard).toContain("expert-dashboard-brand");
    expect(expertDashboard).toContain("expert-dashboard-readonly-badge");
    expect(css).toContain("html:not(.dark) .brand-shell .expert-dashboard .expert-dashboard-brand");
    expect(css).toContain("html:not(.dark) .brand-shell .expert-dashboard .expert-dashboard-readonly-badge");
  });

  it("does not repaint semantic funnel controls with the global white button skin", () => {
    expect(css).not.toContain(
      '.brand-shell .growdash-main :is(button, [role="button"], a.gd-button, a.gd-primary-action)',
    );
    expect(funnelAudienceProfile).toContain("gd-audience-accordion");
    expect(css).toContain(".gd-audience-accordion");
    expect(css).toContain("html.dark .brand-shell .gd-audience-accordion");
    expect(css).toContain("html:not(.dark) .brand-shell .gd-audience-accordion");
  });

  it("keeps muted light-theme copy and CRM metrics readable on white surfaces", () => {
    expect(css).toContain("--gd-content-muted: #425248 !important");
    expect(css).toContain("html:not(.dark) .brand-shell .growdash-main");
    expect(css).toContain(".gd-crm-metric-card .gd-metric-icon.text-primary");
    expect(css).toContain(".gd-crm-metric-card > p.text-primary");
  });

  it("ships the single emerald neon palette with the premium surface contract", () => {
    expect(premiumStyles).toContain('html[data-platform-theme="emerald"]');
    expect(premiumStyles).toContain("--palette-accent: #10B981");
    expect(premiumStyles).toContain("--palette-accent-bright: #00FF88");
    expect(premiumStyles).toContain("--accent-primary: var(--palette-accent)");
    // The obsidian palette is gone: no purple accent may remain.
    expect(premiumStyles).not.toContain("#BC13FE");
    expect(premiumStyles).not.toContain("#E879F9");
  });

  it("keeps the premium layer on glass, luminous borders and reduced motion", () => {
    expect(premiumStyles).toContain("backdrop-filter: blur(14px) saturate(135%)");
    expect(premiumStyles).toContain("--purple-glow-color: var(--palette-secondary-rgb)");
    expect(premiumStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(premiumStyles).toContain("animation-duration: 0.01ms !important");
    expect(premiumStyles).toContain("@keyframes gd-neon-flash");
  });

  it("keeps the platform theme as the single source of truth for the visual contract", () => {
    const themeHook = readFileSync(
      fileURLToPath(new URL("../hooks/useAccentTheme.ts", import.meta.url)),
      "utf8",
    );
    expect(themeHook).toContain('root.dataset.platformTheme = palette.html');
    expect(themeHook).toContain('root.classList.toggle("dark", mode === "dark")');
    expect(themeHook).toContain('export type AccentTheme = "emerald"');
    expect(themeHook).not.toContain("metallic-gold");
    expect(themeHook).not.toContain("obsidian");
  });

  it("wins the cascade against the legacy gradients that pin the shell flat", () => {
    // The legacy stylesheet paints the page shells with flat gradients and
    // pins `background-image: none` on the shell. The premium layer must
    // mirror those selector depths, otherwise the nebula is silently lost.
    expect(premiumStyles).toContain(
      "html:not(.dark) .brand-shell :is(.dashboard-page, .expert-dashboard, .crm-page, .commercial-ranking-shell)",
    );
    expect(premiumStyles).toContain(
      "html.gd-premium .brand-shell[data-space-phase] .space-mission-strip",
    );
    expect(premiumStyles).toContain(
      "html:not(.dark) .brand-shell :is(.dashboard-page, .expert-dashboard, .crm-page, .commercial-ranking-shell)\n  :is(.gd-panel",
    );
    expect(premiumStyles).toContain("html .brand-shell.growdash-app-shell");
    expect(premiumStyles).toContain("--gd-surface-card: var(--surface-card) !important");
  });

  it("keeps the platform theme toggle labelled as light and dark modes", () => {
    const appSidebar = readFileSync(
      fileURLToPath(new URL("../components/AppSidebar.tsx", import.meta.url)),
      "utf8",
    );
    const layout = readFileSync(
      fileURLToPath(new URL("../growdash/GrowdashLayout.tsx", import.meta.url)),
      "utf8",
    );
    expect(appSidebar).toContain("Modo Claro");
    expect(appSidebar).toContain("Modo Escuro");
    expect(appSidebar).toContain('aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}');
    expect(layout).toContain('aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}');
    expect(appSidebar).not.toContain("Tema Esmeralda");
    expect(layout).not.toContain("Tema Esmeralda");
  });

  it("keeps palette and reading mode as independent dimensions", () => {
    // The palette (`data-platform-theme`) only decides the accent colour; the
    // reading mode (`.dark`) only decides the surfaces. Esmeralda stays green
    // and Obsidian stays purple no matter which reading mode is active, so
    // every combination is valid: emerald+light, emerald+dark, obsidian+light,
    // obsidian+dark.
    const premiumStyles = readFileSync(
      fileURLToPath(new URL("../styles/premium.css", import.meta.url)),
      "utf8",
    );
    const appSidebar = readFileSync(
      fileURLToPath(new URL("../components/AppSidebar.tsx", import.meta.url)),
      "utf8",
    );
    const layout = readFileSync(
      fileURLToPath(new URL("../growdash/GrowdashLayout.tsx", import.meta.url)),
      "utf8",
    );
    const profile = readFileSync(
      fileURLToPath(new URL("../growdash/ProfilePage.tsx", import.meta.url)),
      "utf8",
    );
    const hook = readFileSync(
      fileURLToPath(new URL("../hooks/useAccentTheme.ts", import.meta.url)),
      "utf8",
    );

    // Palette: a single emerald neon palette drives every accent.
    expect(premiumStyles).toMatch(/\[data-platform-theme="emerald"\][\s\S]*?--palette-accent:\s*#10B981/);
    expect(premiumStyles).toMatch(/\[data-platform-theme="emerald"\][\s\S]*?--palette-secondary:\s*#059669/);
    expect(premiumStyles).toMatch(/\[data-platform-theme="emerald"\][\s\S]*?--palette-accent-bright:\s*#00FF88/);

    // Mode: the dark block depends only on `.dark`, not on the palette.
    expect(premiumStyles).toContain("html.dark {");
    expect(premiumStyles).not.toMatch(/html\.dark[^\n]*\[data-platform-theme/);

    // The cosmic background follows the palette, not the mode.
    expect(premiumStyles).toContain("rgba(var(--palette-secondary-rgb), 0.18)");
    expect(premiumStyles).toContain("rgba(var(--palette-accent-rgb), 0.16)");

    // The hook returns the reading mode separately and applies it.
    expect(hook).toContain("setMode");
    expect(hook).toContain("applyReadingMode");

    // Profile shows palette picker and reading-mode cards as two separate controls.
    expect(profile).toContain("PlatformThemePicker");
    expect(profile).toContain("Modo de leitura");
    expect(profile).toContain("setMode(\"dark\")");
    expect(profile).toContain("setMode(\"light\")");

    // Sidebar and layout buttons toggle the reading mode, not the palette.
    expect(appSidebar).toContain("setMode(mode === \"dark\" ? \"light\" : \"dark\")");
    expect(layout).toContain("setMode(mode === \"dark\" ? \"light\" : \"dark\")");
  });
});
