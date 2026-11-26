import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const funnelPageSource = readFileSync(
  fileURLToPath(new URL("./FunnelAnalysis.tsx", import.meta.url)),
  "utf8",
);
const kpisSource = readFileSync(
  fileURLToPath(new URL("../components/funnel-analysis/FunnelKPIs.tsx", import.meta.url)),
  "utf8",
);
const badgeSource = readFileSync(
  fileURLToPath(new URL("../components/funnel-analysis/FunnelSyncStatusBadge.tsx", import.meta.url)),
  "utf8",
);

describe("Análise de Funis — contrato de sincronização sem travamento", () => {
  it("usa o snapshot persistido da Meta como autoridade para exibir os números", () => {
    expect(funnelPageSource).toContain("const hasMetaSnapshot = funnelMeta.data.rowCount > 0;");
    expect(funnelPageSource).toContain("metaLeadsAvailable = hasMetaSnapshot");
    // O snapshot salvo não pode ser descartado quando a cobertura ainda não
    // confirmou o período; o Dashboard já usa o mesmo contrato.
    expect(funnelPageSource).not.toContain("spend: funnelMeta.data.available ? funnelMeta.data.spend : 0");
  });

  it("mantém as etapas salvas nas negociações quando o catálogo do RD não responde", () => {
    expect(funnelPageSource).toContain("hasRenderableFunnelStages(operationalStages.length, periodAnalytics.stages.length)");
    expect(funnelPageSource).toContain("!renderableStages");
  });

  it("dispara a sincronização em segundo plano e libera a interface", () => {
    expect(funnelPageSource).toContain("void runProviderReconciliation();");
    expect(funnelPageSource).toContain("Sincronização em andamento");
    // O handler não pode aguardar o provider dentro do caminho de clique.
    expect(funnelPageSource).toContain("function handleSync() {");
  });

  it("exibe o badge de atualização com o tempo decorrido", () => {
    expect(funnelPageSource).toContain("<FunnelSyncStatusBadge");
    expect(badgeSource).toContain("Atualizado");
    expect(badgeSource).toContain("formatDistanceToNow");
  });

  it("não substitui um snapshot confirmado por estado de carregamento nos cartões", () => {
    expect(kpisSource).toContain("metaAvailability");
    expect(kpisSource).toContain("rdAvailability");
    // Um snapshot confirmado permanece numérico mesmo durante o refresh.
    expect(kpisSource).toContain("const metaUsable = metaAvailability ? isMetricAvailable(metaAvailability) : true;");
  });
});
