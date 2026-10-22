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
});
