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
    expect(settingsPage).toContain('aria-label="Ativar modo escuro"');
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
});
