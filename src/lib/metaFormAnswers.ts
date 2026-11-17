/**
 * Extração determinística das respostas de um formulário nativo da Meta
 * (Lead Ads) a partir do `field_data` cru.
 *
 * Por que este módulo existe: o `field_data` do Graph API é um array livre de
 * `{ name, values }` e não existe coluna no banco para cada pergunta. Sem
 * esta etapa, as respostas do questionário nunca chegam aos campos
 * personalizados da negociação no RD Station — elas ficam presas no JSON.
 *
 * O mapeamento é por ALIAS (normalizado), não por posição: a Meta devolve as
 * perguntas na ordem em que o formulário foi criado, e essa ordem muda
 * quando o anunciante edita o formulário. Um aliasstable sobrevive a
 * reordenação, a mudança de texto e a troca de um formulário por outro.
 *
 * Cada pergunta do formulário recebe uma chave estável (`answer_key`) que
 * atravessa webhook → `meta_leads` → `rd_deals` → campo customizado do RD.
 */

export type MetaFormAnswer = {
  /** Chave estável da pergunta, independente do texto exibido. */
  answer_key: string;
  /** Rótulo original da pergunta, como veio da Meta. */
  question: string;
  /** Valor da resposta, já normalizado para texto simples. */
  value: string;
};

/**
 * Perguntas do funil de formação médica (ninfoplastia e afins).
 *
 * `answer_key` é o contrato com o `rd_field_configs.rd_field_aliases`: o
 * mesmo valor precisa aparecer em ambos os lados para o preenchimento
 * automático encontrar o campo certo no RD Station.
 */
export const FORM_ANSWER_DEFINITIONS = [
  {
    answer_key: "situacao_profissional",
    question_label: "Situação profissional",
    aliases: [
      "situacao profissional",
      "qual e a sua situacao profissional",
      "sua situacao profissional",
      "situacao profissional",
      "situacao",
    ],
  },
  {
    answer_key: "especialidade",
    question_label: "Especialidade ou área de atuação",
    aliases: [
      "especialidade ou area de atuacao",
      "qual e a sua especialidade ou area de atuacao",
      "sua especialidade",
      "especialidade",
      "area de atuacao",
      "area de atuacao",
    ],
  },
  {
    answer_key: "faturamento",
    question_label: "Faixa de faturamento líquido mensal",
    aliases: [
      "qual e a sua faixa de faturamento liquido mensal na atividade medica",
      "faixa de faturamento liquido mensal na atividade medica",
      "faixa de faturamento liquido mensal",
      "faturamento liquido mensal",
      "faturamento",
      "faturamento mensal",
    ],
  },
  {
    answer_key: "urgencia",
    question_label: "Urgência para iniciar a formação",
    aliases: [
      "qual e sua urgencia para iniciar uma formacao em ninfoplastia",
      "qual e a sua urgencia para iniciar uma formacao",
      "urgencia para iniciar uma formacao",
      "urgencia",
    ],
  },
  {
    answer_key: "objetivo",
    question_label: "Principal objetivo ao aprender Ninfoplastia",
    aliases: [
      "qual e seu principal objetivo ao aprender ninfoplastia",
      "qual e o seu principal objetivo ao aprender ninfoplastia",
      "principal objetivo ao aprender ninfoplastia",
      "principal objetivo",
      "objetivo",
      "objetivo principal",
    ],
  },
] as const;

/** Normaliza rótulos para comparação: sem acento, sem pontuação, minúsculo. */
export function normalizeAnswerKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Remove o prefixo `[GTM]` e marcadores internos que o RD usa nos rótulos
 * dos campos customizados, para comparar com o texto da pergunta da Meta.
 */
export function stripInternalMarkers(value: unknown): string {
  return String(value ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readFieldValue(entry: any): string | null {
  const raw = entry?.values ?? entry?.value ?? null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;
  if (typeof value === "object") {
    const nested = value.label ?? value.value ?? value.name ?? null;
    return nested == null ? null : String(nested).trim() || null;
  }
  const text = String(value).trim();
  return text || null;
}

function readFieldQuestion(entry: any): string {
  return String(entry?.name ?? entry?.label ?? entry?.title ?? "").trim();
}

/**
 * Casa a pergunta com uma definição do catálogo.
 *
 * A comparação ignora prefixos `[GTM]`, acentos e pontuação, e aceita tanto
 * igualdade quanto "a pergunta contém o alias" — esta última cobre perguntas
 * que a Meta devolve com texto livre acrescentado pelo anunciante.
 */
export function matchAnswerDefinition(question: string): (typeof FORM_ANSWER_DEFINITIONS)[number] | null {
  const normalized = normalizeAnswerKey(stripInternalMarkers(question));
  if (!normalized) return null;
  let best: (typeof FORM_ANSWER_DEFINITIONS)[number] | null = null;
  let bestLength = 0;
  for (const definition of FORM_ANSWER_DEFINITIONS) {
    for (const alias of definition.aliases) {
      const normalizedAlias = normalizeAnswerKey(alias);
      if (!normalizedAlias) continue;
      const exact = normalized === normalizedAlias;
      const contains = normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
      if (!exact && !contains) continue;
      // O alias mais específico vence: "situacao profissional" precisa ganhar
      // de "situacao" quando a pergunta for a completa.
      if (normalizedAlias.length > bestLength) {
        best = definition;
        bestLength = normalizedAlias.length;
      }
    }
  }
  return best;
}

/**
 * Extrai as respostas conhecidas do `field_data` da Meta.
 *
 * Perguntas sem correspondência no catálogo são ignoradas aqui: elas ficam no
 * `field_data` original e não devem virar coluna dedicada. Retorna também o
 * mapa `{ answer_key: value }` para o uso mais simples.
 */
export function extractMetaFormAnswers(fieldData: unknown): {
  answers: MetaFormAnswer[];
  byKey: Record<string, string>;
} {
  const byKey: Record<string, string> = {};
  const answers: MetaFormAnswer[] = [];
  if (!Array.isArray(fieldData)) return { answers, byKey };

  for (const entry of fieldData as any[]) {
    const question = readFieldQuestion(entry);
    const value = readFieldValue(entry);
    if (!question || !value) continue;
    const definition = matchAnswerDefinition(question);
    if (!definition) continue;
    if (byKey[definition.answer_key]) continue;
    byKey[definition.answer_key] = value;
    answers.push({
      answer_key: definition.answer_key,
      question,
      value,
    });
  }
  return { answers, byKey };
}

/** Colunas de `meta_leads` derivadas de cada `answer_key`. */
export const FORM_ANSWER_COLUMN_BY_KEY: Record<string, string> = {
  situacao_profissional: "lead_situacao_profissional",
  especialidade: "lead_especialidade",
  faturamento: "lead_faturamento",
  urgencia: "lead_urgencia",
  objetivo: "lead_objetivo",
};

/** Monta o patch das colunas derivadas a partir do `field_data`. */
export function buildFormAnswerColumns(fieldData: unknown): Record<string, string | null> {
  const { byKey } = extractMetaFormAnswers(fieldData);
  const patch: Record<string, string | null> = {};
  for (const [answerKey, column] of Object.entries(FORM_ANSWER_COLUMN_BY_KEY)) {
    patch[column] = byKey[answerKey] ?? null;
  }
  return patch;
}
