import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexPageSource = readFileSync(
  fileURLToPath(new URL("../pages/Index.tsx", import.meta.url)),
  "utf8",
);
const missionDashboardSource = readFileSync(
  fileURLToPath(new URL("../components/dashboard/MissionDashboard.tsx", import.meta.url)),
  "utf8",
);

describe("Dashboard — contrato do KPI de leads", () => {
  it("o card LEADS usa os leads do Meta, não os negócios do RD", () => {
    // O Gerenciador de Anúncios conta o lead de formulário nativo do Meta.
    // Usar os negócios ganhos do RD no mesmo card mistura dois contratos:
    // o número não bate com o Gerenciador e o CPL ao lado (que divide pelo
    // total do Meta) fica incoerente com o próprio card.
    expect(indexPageSource).toMatch(/leads:\s*glassLeads\b/);
    expect(indexPageSource).not.toMatch(
      /leads:\s*dashboardDeals\.length\s*>\s*0\s*\?\s*dashboardDeals\.length\s*:\s*glassLeads/,
    );
  });

  it("o CPL usa o mesmo total de leads exibido no card", () => {
    // Denominador e numerador precisam ser o mesmo contrato de leads.
    expect(indexPageSource).toMatch(
      /const glassCpl = glassLeads > 0 \? glassSpend \/ glassLeads : 0;/,
    );
  });

  it("o breakdown de leads continua separado em formulário, site e conversa", () => {
    expect(indexPageSource).toMatch(
      /const leadBreakdown = useMemo\(\(\) => \(\{[\s\S]{0,160}?total: glassForms \+ glassSite \+ glassConversations \}\)/,
    );
    expect(indexPageSource).toMatch(/const glassLeads = leadBreakdown\.total;/);
  });

  it("o funil orbital e o radar usam o total de leads do card", () => {
    // O funil exibe "LEADS" e o radar exibe "N leads". Ambos devem
    // refletir o mesmo número que o card, sem voltar ao total do RD.
    expect(missionDashboardSource).toMatch(/const leads = safeMetrics\.leads;/);
    expect(missionDashboardSource).not.toMatch(/const leads = dashboardDeals\.length/);
  });
});
