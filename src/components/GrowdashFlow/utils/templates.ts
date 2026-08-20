import type { DrawElement } from "../types";
import { createId, fitTextElementToContent } from "./geometry";

const now = () => new Date().toISOString();
const base = (type: DrawElement["type"], x: number, y: number, width: number, height: number, layerIndex: number, patch: Partial<DrawElement> = {}): DrawElement => ({
  id: createId("flow"), type, x, y, width, height, layerIndex, rotation: 0, opacity: 1,
  fillColor: "#1b1710", strokeColor: "#b57a20", strokeWidth: 2, locked: false,
  createdAt: now(), updatedAt: now(), ...patch,
});

const fitTemplateText = (elements: DrawElement[]) => elements.map((element) => element.type === "text"
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
  elements.push(base("text", 70, 30, 1180, 42, 4, { text: "FUNIL DE TRÁFEGO PAGO — QUALIFICAÇÃO MQL / SQL", strokeColor: "#f5f5f5", fontSize: 26, fontFamily: "Inter" }));
  elements.push(base("text", 70, 75, 1180, 28, 4, { text: "Advantage+ · público amplo · avanço por intenção e comportamento", strokeColor: "#b8b8b8", fontSize: 15, fontFamily: "Inter" }));

  sqlStages.forEach((stage, index) => {
    const x = stageX[index];
    elements.push(base("rectangle", x, 145, 260, 470, 1, { fillColor: "#0c0c0d", strokeColor: stage.color, strokeWidth: 2 }));
    elements.push(base("rectangle", x + 18, 128, 224, 54, 3, { fillColor: stage.fill, strokeColor: stage.color, strokeWidth: 2 }));
    elements.push(base("text", x + 30, 143, 200, 24, 4, { text: stage.title, strokeColor: "#f7f7f7", fontSize: 15, fontFamily: "Inter" }));
    elements.push(base("text", x + 25, 208, 210, 55, 4, { text: stage.campaign, strokeColor: stage.color, fontSize: 18, fontFamily: "Inter" }));
    elements.push(base("text", x + 25, 275, 210, 36, 4, { text: stage.budget, strokeColor: "#eeeeee", fontSize: 14, fontFamily: "Inter" }));
    elements.push(base("sticky", x + 22, 338, 216, 88, 3, { text: `PÚBLICO\n${stage.audience}`, fillColor: stage.fill, strokeColor: stage.color, strokeWidth: 1, fontSize: 14, fontFamily: "Inter" }));
    elements.push(base("sticky", x + 22, 442, 216, 72, 3, { text: stage.content, fillColor: "#151515", strokeColor: "#5b5b5b", strokeWidth: 1, fontSize: 14, fontFamily: "Inter" }));
    elements.push(base("sticky", x + 22, 532, 216, 58, 3, { text: stage.exit, fillColor: "#1b1810", strokeColor: "#d7ae37", strokeWidth: 2, fontSize: 13, fontFamily: "Inter" }));
    if (index < sqlStages.length - 1) elements.push(base("arrow", x + 262, 380, 54, 0, 2, { strokeColor: "#d7ae37", strokeWidth: 3 }));
  });
  elements.push(base("rectangle", 70, 660, 1220, 82, 1, { fillColor: "#101010", strokeColor: "#d7ae37", strokeWidth: 2 }));
  elements.push(base("text", 98, 680, 235, 25, 4, { text: "DISTRIBUIÇÃO DO BUDGET", strokeColor: "#f3f3f3", fontSize: 16, fontFamily: "Inter" }));
  ["25–30%", "35–40%", "20–25%", "10–15%"].forEach((budget, index) => elements.push(base("text", 390 + index * 220, 683, 150, 28, 4, { text: budget, strokeColor: sqlStages[index].color, fontSize: 22, fontFamily: "Inter" })));
  elements.push(base("sticky", 300, 775, 760, 70, 3, { text: "COMERCIAL — recebe SQL com consciência alta: viu 25% + viu 50% + respondeu procedimento, orçamento e prazo.", fillColor: "#102419", strokeColor: "#65d47b", strokeWidth: 2, fontSize: 16, fontFamily: "Inter" }));
  return fitTemplateText(elements);
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
