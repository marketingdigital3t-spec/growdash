import type { DrawElement } from "../types";
import { createId } from "./geometry";

const now = () => new Date().toISOString();
const base = (type: DrawElement["type"], x: number, y: number, width: number, height: number, layerIndex: number, patch: Partial<DrawElement> = {}): DrawElement => ({
  id: createId("flow"), type, x, y, width, height, layerIndex, rotation: 0, opacity: 1,
  fillColor: "#1b1710", strokeColor: "#b57a20", strokeWidth: 2, locked: false,
  createdAt: now(), updatedAt: now(), ...patch,
});

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
  return elements;
}
