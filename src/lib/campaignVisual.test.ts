/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const campaignSource = readFileSync(resolve(root, "src/pages/Campaigns.tsx"), "utf8");
const stylesheet = readFileSync(resolve(root, "src/index.css"), "utf8");

describe("identidade visual das campanhas no modo escuro", () => {
  it("mantém o nome da campanha neutro, sem azul de link", () => {
    expect(campaignSource).toMatch(/campaign-name-link[^\n]*text-foreground/);
    expect(campaignSource).not.toMatch(/campaign-name-link[^\n]*(blue|sky|cyan|#0866ff)/i);
  });

  it("define o contrato neutro para o nome da campanha", () => {
    expect(stylesheet).toMatch(/\.campaigns-workspace \.campaign-name-link\s*\{[^}]*color:\s*var\(--gd-content-text\)/s);
  });
});
