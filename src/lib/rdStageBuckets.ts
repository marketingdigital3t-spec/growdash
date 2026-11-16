/**
 * Mapeamento puro e testável de uma etapa do RD Station para o grupo de exibição
 * do Resumo de Performance.
 *
 * Cada etapa do RD mantém seu nome original. As colunas do funil são agrupadas
 * por `rd_stage_id` do funil selecionado, então este mapeamento recebe o nome
 * normalizado da etapa e retorna o grupo único a que ela pertence. Uma etapa
 * nunca é atribuída a dois grupos; a ordem de avaliação abaixo é fixa.
 *
 * Grupos:
 *  - novo-lead: etapa cujo nome normalizado contém `lead novo`, `novo lead` ou `novo`
 *  - sem-conversa: `sem contato`, `sem conversa`, `nao atendeu`, `no show`, `sem resposta`, `tentativa`, `stand by`, `espera`
 *  - conversa: `em conversa`, `conversa`, `atendimento`, `em contato`, `whatsapp`
 *  - oportunidade: `oportunidade`, `proposta`, `negociacao`
 *  - vendas: negócio ganho (`win`) ou etapa de venda
 *  - perdidas: `perdido`, `perda`, `lost`, `desqualificado`
 *  - etapa-propria: qualquer outra etapa do RD, exibida com o nome original
 */

export type RDStageBucket =
  | "novo-lead"
  | "sem-conversa"
  | "conversa"
  | "oportunidade"
  | "vendas"
  | "perdidas"
  | "etapa-propria";

export interface RDStageBucketResult {
  bucket: RDStageBucket;
  label: string;
}

const BUCKET_LABELS: Record<RDStageBucket, string> = {
  "novo-lead": "Novo Lead",
  "sem-conversa": "Sem Conversa",
  conversa: "Conversa",
  oportunidade: "Oportunidade",
  vendas: "Vendas",
  perdidas: "Perdidas",
  "etapa-propria": "Etapa própria",
};

function normalizeStageName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/**
 * Resolve o grupo de exibição de uma etapa do RD Station.
 *
 * Quando `won` ou `lost` são informados (vindos da tabela `rd_funnel_stages`
 * ou do payload do RD), eles têm precedência sobre a inferência por nome,
 * porque o RD pode discordar do booleano técnico `is_won` enquanto mantém o
 * rótulo terminal.
 */
export function bucketRDStage({
  stageName,
  won = false,
  lost = false,
}: {
  stageName: string | null | undefined;
  won?: boolean;
  lost?: boolean;
}): RDStageBucketResult {
  const name = normalizeStageName(stageName);

  if (!name) return { bucket: "etapa-propria", label: BUCKET_LABELS["etapa-propria"] };

  // Vendas ganhas: rótulo terminal tem precedência.
  if (won || /^(venda|vendas|sale|sales)$/.test(name) || /\b(vendid[oa]s?|vendas? realizadas?|vendas? concluidas?|vendas? ganhas?|fechado ganho|ganho|won|cliente)\b/.test(name)) {
    return { bucket: "vendas", label: BUCKET_LABELS.vendas };
  }

  // Perdidas.
  if (lost || /\b(perdid[oa]s?|perda|lost|desqualificad[oa]s?)\b/.test(name)) {
    return { bucket: "perdidas", label: BUCKET_LABELS.perdidas };
  }

  // Pré-venda não é terminal: segue para os grupos operacionais abaixo.
  if (/\b(pre|pos) venda\b/.test(name)) {
    // "Pré-venda" se comporta como conversa/qualificação operacional.
    return { bucket: "conversa", label: BUCKET_LABELS.conversa };
  }

  // Novo Lead.
  if (/\b(lead novo|novo lead)\b/.test(name) || /\bnovo\b/.test(name)) {
    return { bucket: "novo-lead", label: BUCKET_LABELS["novo-lead"] };
  }

  // Sem Conversa.
  if (
    /\b(sem contato|sem conversa|nao atendeu|no show|sem resposta|tentativa|stand by|espera)\b/.test(name)
  ) {
    return { bucket: "sem-conversa", label: BUCKET_LABELS["sem-conversa"] };
  }

  // Conversa.
  if (/\b(em conversa|conversa|atendimento|em contato|whatsapp)\b/.test(name)) {
    return { bucket: "conversa", label: BUCKET_LABELS.conversa };
  }

  // Oportunidade.
  if (/\b(oportunidade|proposta|negociacao|negociação)\b/.test(name)) {
    return { bucket: "oportunidade", label: BUCKET_LABELS.oportunidade };
  }

  // Qualquer outra etapa do RD: exibida com o nome original, nunca somida.
  return { bucket: "etapa-propria", label: String(stageName || "").trim() || BUCKET_LABELS["etapa-propria"] };
}
