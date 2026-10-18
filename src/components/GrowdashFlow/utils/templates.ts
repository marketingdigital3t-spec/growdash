import type { DrawElement } from "../types";
import { createId, fitTextElementToContent } from "./geometry";

const now = () => new Date().toISOString();
const base = (type: DrawElement["type"], x: number, y: number, width: number, height: number, layerIndex: number, patch: Partial<DrawElement> = {}): DrawElement => ({
  id: createId("flow"), type, x, y, width, height, layerIndex, rotation: 0, opacity: 1,
  fillColor: "#1b1710", strokeColor: "#b57a20", strokeWidth: 2, locked: false,
  createdAt: now(), updatedAt: now(), ...patch,
});

const fitTemplateText = (elements: DrawElement[]) => elements.map((element) => element.type === "text" && element.autoSize !== false
  ? fitTextElementToContent({ ...element, autoSize: true })
  : element);

/** A complete, editable acquisition funnel based on the five growth stages. */
export function createAcquisitionFunnelTemplate(): DrawElement[] {
  const elements: DrawElement[] = [];
  const stages = [
    ["TRÁFEGO INDIRETO", "Conteúdo", 80], ["TRÁFEGO DIRETO", "Oferta", 350],
    ["ENGAJAMENTO", "Objeção", 620], ["CONVERSÃO", "Fechamento", 890], ["MONETIZAÇÃO", "Upsell", 1160],
  ] as const;
  stages.forEach(([title, subtitle, x]) => {
    elements.push(base("rectangle", x, 70, 230, 100, 2, { fillColor: "#15120d", strokeColor: "#6f4a14", strokeWidth: 1 }));
    elements.push(base("text", x + 14, 86, 202, 55, 3, { text: `${title}\n${subtitle}`, strokeColor: "#f1c76b", fontSize: 17, fontFamily: "Inter" }));
  });
  const nodes = [
    ["Instagram / YouTube\nConteúdo e autoridade", 105, 270], ["Anúncios / Busca\nOferta e intenção", 380, 270],
    ["Landing page\nLead magnet", 650, 270], ["Checkout / Comercial\nFechamento", 920, 270], ["Pós-venda\nUpsell e indicação", 1190, 270],
  ] as const;
  for (let index = 0; index < nodes.length - 1; index++) {
    elements.push(base("arrow", nodes[index][1] + 190, 330, 80, 0, 0, { strokeColor: "#b57a20", strokeWidth: 3 }));
  }
  nodes.forEach(([text, x, y]) => elements.push(base("sticky", x, y, 190, 120, 2, { text, fillColor: "#d9ee54", strokeColor: "#a8bd30", strokeWidth: 2, fontSize: 16, fontFamily: "Inter" })));
  elements.push(base("text", 100, 470, 1240, 45, 3, { text: "Atenção  →  Interesse  →  Desejo  →  Compra  →  Expansão", strokeColor: "#f1c76b", fontSize: 22, fontFamily: "Inter" }));
  elements.push(base("sticky", 650, 560, 420, 110, 2, { text: "Próximo procedimento\nDefina uma meta por etapa, o responsável e a métrica de avanço.", fillColor: "#2d2412", strokeColor: "#b57a20", strokeWidth: 2, fontSize: 17, fontFamily: "Inter" }));
  return fitTemplateText(elements);
}

type SqlStage = {
  title: string;
  campaign: string;
  budget: string;
  audience: string;
  content: string;
  exit: string;
  color: string;
  fill: string;
};

const sqlStages: SqlStage[] = [
  { title: "STAGE 1 · TOPO DE FUNIL", campaign: "CAMPANHA 1 — RECONHECIMENTO", budget: "ThruPlay · 25–30% do budget", audience: "Advantage+ amplo ou interesse + semelhante 1–3%", content: "Vídeo de reconhecimento · autoridade e dor", exit: "Avança: assistiu 25% do vídeo", color: "#6f9cff", fill: "#12223f" },
  { title: "STAGE 2 · MEIO DE FUNIL", campaign: "CAMPANHA 2 — QUALIFICAÇÃO", budget: "ThruPlay · 35–40% do budget", audience: "Viu 25% da Campanha 1", content: "Conteúdo educacional + quebra de objeção", exit: "Avança: assistiu 50% do vídeo", color: "#bb7dff", fill: "#251739" },
  { title: "STAGE 3 · FUNDO DE FUNIL", campaign: "CAMPANHA 3 — CAPTAÇÃO (LEAD)", budget: "Conversão · 20–25% do budget", audience: "Viu 50% da Campanha 2", content: "Formulário: procedimento, orçamento e prazo", exit: "SQL: respondeu orçamento + prazo", color: "#ff9a3d", fill: "#3a2412" },
  { title: "STAGE 4 · REMARKETING", campaign: "CAMPANHA 4 — RECUPERAÇÃO", budget: "Conversão · 10–15% do budget", audience: "Viu 50% e ainda não converteu", content: "Prova social, casos, oferta e decisão", exit: "Comercial: lead pronto para contato", color: "#77d98b", fill: "#12301d" },
];

/** Editable four-stage paid-media funnel for MQL/SQL qualification. */
export function createSqlTrafficFunnelTemplate(): DrawElement[] {
  const elements: DrawElement[] = [];
  const stageX = [70, 390, 710, 1030];
  // Reserve a clear header band so the board title never competes with the
  // stage headers below it. Explicitly sized text stays on one line and is
  // not collapsed by the content-fit pass used by regular labels.
  elements.push(base("rectangle", 70, 20, 1220, 104, 0, { fillColor: "#0d1118", strokeColor: "#2c384a", strokeWidth: 1 }));
  elements.push(base("text", 92, 34, 320, 18, 4, { text: "QUALIFICAÇÃO MQL / SQL", strokeColor: "#91b4ee", fontSize: 12, fontFamily: "Inter", autoSize: false }));
  elements.push(base("text", 92, 55, 1140, 32, 4, { text: "FUNIL DE TRÁFEGO PAGO", strokeColor: "#f5f5f5", fontSize: 24, fontFamily: "Inter", autoSize: false }));
  elements.push(base("text", 92, 92, 1140, 22, 4, { text: "Advantage+ · público amplo · avanço por intenção e comportamento", strokeColor: "#b8c2d1", fontSize: 14, fontFamily: "Inter", autoSize: false }));

  sqlStages.forEach((stage, index) => {
    const x = stageX[index];
    elements.push(base("rectangle", x, 180, 260, 465, 1, { fillColor: "#0c0c0d", strokeColor: stage.color, strokeWidth: 2 }));
    elements.push(base("rectangle", x + 18, 155, 224, 54, 3, { fillColor: stage.fill, strokeColor: stage.color, strokeWidth: 2 }));
    elements.push(base("text", x + 30, 168, 200, 36, 4, { text: stage.title, strokeColor: "#f7f7f7", fontSize: 13, fontFamily: "Inter", autoSize: false }));
    elements.push(base("text", x + 25, 238, 210, 48, 4, { text: stage.campaign, strokeColor: stage.color, fontSize: 17, fontFamily: "Inter", autoSize: false }));
    elements.push(base("text", x + 25, 300, 210, 36, 4, { text: stage.budget, strokeColor: "#eeeeee", fontSize: 13, fontFamily: "Inter", autoSize: false }));
    elements.push(base("sticky", x + 22, 354, 216, 78, 3, { text: `PÚBLICO\n${stage.audience}`, fillColor: stage.fill, strokeColor: stage.color, strokeWidth: 1, fontSize: 13, fontFamily: "Inter" }));
    elements.push(base("sticky", x + 22, 448, 216, 66, 3, { text: stage.content, fillColor: "#151515", strokeColor: "#5b5b5b", strokeWidth: 1, fontSize: 13, fontFamily: "Inter" }));
    elements.push(base("sticky", x + 22, 530, 216, 62, 3, { text: stage.exit, fillColor: "#1b1810", strokeColor: "#d7ae37", strokeWidth: 2, fontSize: 12, fontFamily: "Inter" }));
    if (index < sqlStages.length - 1) elements.push(base("arrow", x + 262, 393, 54, 0, 2, { strokeColor: "#d7ae37", strokeWidth: 3 }));
  });
  elements.push(base("rectangle", 70, 680, 1220, 72, 1, { fillColor: "#101010", strokeColor: "#d7ae37", strokeWidth: 2 }));
  elements.push(base("text", 98, 699, 235, 34, 4, { text: "DISTRIBUIÇÃO\nDO BUDGET", strokeColor: "#f3f3f3", fontSize: 14, fontFamily: "Inter", autoSize: false }));
  ["25–30%", "35–40%", "20–25%", "10–15%"].forEach((budget, index) => elements.push(base("text", 390 + index * 220, 700, 150, 32, 4, { text: budget, strokeColor: sqlStages[index].color, fontSize: 19, fontFamily: "Inter", autoSize: false })));
  elements.push(base("sticky", 300, 785, 760, 64, 3, { text: "COMERCIAL — recebe SQL com consciência alta: viu 25% + viu 50% + respondeu procedimento, orçamento e prazo.", fillColor: "#102419", strokeColor: "#65d47b", strokeWidth: 2, fontSize: 15, fontFamily: "Inter" }));
  return fitTemplateText(elements);
}

/**
 * Brings older saved SQL boards in line with the current visual hierarchy.
 * The migration is content-based so it keeps the user's element ids and copy
 * while only correcting the stock template geometry.
 */
export function normalizeSqlTrafficFunnelElements(elements: DrawElement[]): DrawElement[] {
  const title = elements.find((element) => element.type === "text" && element.text?.includes("FUNIL DE TRÁFEGO"));
  const subtitle = elements.find((element) => element.type === "text" && element.text?.includes("Advantage+"));
  if (!title || !subtitle) return elements;

  const stageX = [70, 390, 710, 1030];
  const stageByTitle = new Map(sqlStages.map((stage, index) => [stage.title, index]));
  const stageIndexFor = (element: DrawElement) => {
    const exact = stageX.findIndex((x) => Math.abs(element.x - x) < 8 || Math.abs(element.x - (x + 18)) < 8 || Math.abs(element.x - (x + 22)) < 8 || Math.abs(element.x - (x + 25)) < 8 || Math.abs(element.x - (x + 30)) < 8);
    return exact >= 0 ? exact : null;
  };
  const hasHeaderBand = elements.some((element) => element.type === "rectangle" && element.x === 70 && element.y <= 24 && element.width >= 1200);
  const normalized = elements.map((element) => {
    if (element.id === title.id) return { ...element, x: 92, y: 55, width: 1140, height: 32, text: "FUNIL DE TRÁFEGO PAGO", fontSize: 24, autoSize: false };
    if (element.id === subtitle.id) return { ...element, x: 92, y: 92, width: 1140, height: 22, fontSize: 14, autoSize: false };
    if (element.type === "rectangle" && element.width === 260) return { ...element, y: 180, height: 465 };
    if (element.type === "rectangle" && element.width === 224) return { ...element, y: 155, height: 54 };
    if (element.type === "arrow") {
      const index = stageX.findIndex((x) => Math.abs(element.x - (x + 262)) < 12);
      return index >= 0 ? { ...element, y: 393 } : element;
    }
    if (element.type === "text") {
      const stageTitleIndex = stageByTitle.get(element.text || "");
      if (stageTitleIndex !== undefined) return { ...element, x: stageX[stageTitleIndex] + 30, y: 168, width: 200, height: 36, fontSize: 13, autoSize: false };
      if (element.text?.startsWith("CAMPANHA")) {
        const index = stageIndexFor(element);
        return index === null ? element : { ...element, x: stageX[index] + 25, y: 238, width: 210, height: 48, fontSize: 17, autoSize: false };
      }
      if (element.text?.includes("budget")) {
        const index = stageIndexFor(element);
        return index === null ? element : { ...element, x: stageX[index] + 25, y: 300, width: 210, height: 36, fontSize: 13, autoSize: false };
      }
      if (element.text === "DISTRIBUIÇÃO DO BUDGET") return { ...element, x: 98, y: 699, width: 235, height: 34, fontSize: 14, autoSize: false };
      if (["25–30%", "35–40%", "20–25%", "10–15%"].includes(element.text || "")) {
        const index = ["25–30%", "35–40%", "20–25%", "10–15%"].indexOf(element.text || "");
        return { ...element, x: 390 + index * 220, y: 700, width: 150, height: 32, fontSize: 19, autoSize: false };
      }
    }
    if (element.type === "sticky") {
      const index = stageIndexFor(element);
      if (index !== null) {
        if (element.text?.startsWith("PÚBLICO")) return { ...element, x: stageX[index] + 22, y: 354, width: 216, height: 78, fontSize: 13 };
        if (element.text === sqlStages[index].content) return { ...element, x: stageX[index] + 22, y: 448, width: 216, height: 66, fontSize: 13 };
        if (element.text === sqlStages[index].exit) return { ...element, x: stageX[index] + 22, y: 530, width: 216, height: 62, fontSize: 12 };
      }
      if (element.text?.startsWith("COMERCIAL")) return { ...element, x: 300, y: 785, width: 760, height: 64, fontSize: 15 };
    }
    return element;
  });

  if (!hasHeaderBand) {
    normalized.push(base("rectangle", 70, 20, 1220, 104, 0, { fillColor: "#0d1118", strokeColor: "#2c384a", strokeWidth: 1 }));
    normalized.push(base("text", 92, 34, 320, 18, 4, { text: "QUALIFICAÇÃO MQL / SQL", strokeColor: "#91b4ee", fontSize: 12, fontFamily: "Inter", autoSize: false }));
  }
  return normalized;
}

/** Adds operational exclusions and launch rules to the SQL traffic template. */
export function createSqlTrafficDetailedTemplate(): DrawElement[] {
  const elements = createSqlTrafficFunnelTemplate();
  const offset = elements.length + 10;
  const notes = [
    [70, "REGRAS DE EXCLUSÃO\n• Campanha 1: excluir quem viu 50%\n• Campanha 2: excluir quem entrou na Campanha 3\n• Campanha 3: excluir quem já preencheu formulário\n• Campanha 4: excluir SQL / agendou"],
    [475, "CRITÉRIOS DE AVANÇO\n1. Campanha 1 libera Campanha 2 ao atingir 25% do vídeo\n2. Campanha 2 libera Campanha 3 ao atingir 50%\n3. Campanha 3 vira SQL ao responder orçamento + prazo\n4. Campanha 4 recupera indecisos"],
    [880, "REGRAS NEGOCIÁVEIS DA CONTA\n• Otimizar para lead qualificado\n• Criativos em vídeo vertical e variações\n• Métrica de avanço definida por campanha\n• Revisar públicos e exclusões semanalmente"],
  ] as const;
  notes.forEach(([x, text], index) => elements.push(base("sticky", x, 905, 340, 185, offset + index, { text, fillColor: index === 1 ? "#152318" : "#171717", strokeColor: index === 1 ? "#67d27c" : "#a9a9a9", strokeWidth: 2, fontSize: 15, fontFamily: "Inter" })));
  return fitTemplateText(elements);
}
