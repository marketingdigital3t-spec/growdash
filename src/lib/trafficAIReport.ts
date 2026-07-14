export type TrafficAISectionKey = "summary" | "campaigns" | "adsets" | "ads" | "actions" | "projections";

function normalizeHeading(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function headingKey(heading: string): TrafficAISectionKey | null {
  const value = normalizeHeading(heading);
  if (value.includes("RESUMO")) return "summary";
  if (value.includes("CAMPANHA")) return "campaigns";
  if (value.includes("CONJUNTO")) return "adsets";
  if (value.includes("ANUNCIO")) return "ads";
  if (value.includes("PLANO DE ACAO")) return "actions";
  if (value.includes("PROJE")) return "projections";
  return null;
}

export function splitTrafficAIReport(report: string) {
  const sections: Partial<Record<TrafficAISectionKey, string>> = {};
  let current: TrafficAISectionKey = "summary";
  for (const line of report.split("\n")) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      const key = headingKey(match[1]);
      if (key) {
        current = key;
        sections[current] = "";
        continue;
      }
    }
    sections[current] = `${sections[current] || ""}${line}\n`;
  }
  return sections;
}
