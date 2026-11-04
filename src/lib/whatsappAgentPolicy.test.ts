import { describe, expect, it } from "vitest";
import { buildRannielyFallbackReply, buildRannielyIdentityContext, buildRannielyMediaHandoffSummary, containsRannielyLeadEcho, containsRannielySchedulingIntent, getRannielyGreeting, getRannielyNextQuestionIndex, isRannielyAgentContext, isWhatsAppImage, needsRannielyReplyCorrection, RANNIELY_FUNNEL_QUESTIONS, RANNIELY_POLICY, splitWhatsAppReply } from "../../supabase/functions/_shared/whatsappAgentPolicy";

describe("WhatsApp agent media policy", () => {
  it("detects image messages from provider type or MIME metadata", () => {
    expect(isWhatsAppImage("image", {})).toBe(true);
    expect(isWhatsAppImage("text", { mimetype: "image/jpeg" })).toBe(true);
    expect(isWhatsAppImage("text", { _data: { mimeType: "image/png" } })).toBe(true);
    expect(isWhatsAppImage("text", { mimetype: "application/pdf" })).toBe(false);
  });

  it("splits only explicit long replies into at most two WhatsApp messages", () => {
    expect(splitWhatsAppReply("Uma mensagem curta")).toEqual(["Uma mensagem curta"]);
    expect(splitWhatsAppReply("Primeira parte [BREAK] Segunda parte [BREAK] Excesso")).toEqual(["Primeira parte", "Segunda parte Excesso"]);
  });

  it("uses the Sao Paulo greeting for the current local time", () => {
    expect(getRannielyGreeting(new Date("2026-11-03T11:00:00Z"))).toBe("Bom dia");
    expect(getRannielyGreeting(new Date("2026-11-03T15:00:00Z"))).toBe("Boa tarde");
    expect(getRannielyGreeting(new Date("2026-11-03T21:00:00Z"))).toBe("Boa noite");
  });

  it("keeps the configured agent name separate from the customer name", () => {
    expect(isRannielyAgentContext("Mariana", "atendimento comercial", "Paciente Modelo de Harmonização de Glúteos")).toBe(true);
    expect(buildRannielyIdentityContext("Mariana")).toContain("aqui é Mariana, do atendimento da Dra. Ranniely");
    expect(buildRannielyIdentityContext("Janaína")).toContain("aqui é Mariana, do atendimento da Dra. Ranniely");
    expect(buildRannielyIdentityContext("Janaína")).not.toContain("Janaína");
    expect(buildRannielyIdentityContext("Mariana")).toContain("Nunca use o nome da cliente");
    expect(isRannielyAgentContext("Mariana", "atendimento comercial", "produto sem relação")).toBe(false);
  });

  it("defines the fixed qualification funnel and authorized prices", () => {
    const positions = RANNIELY_FUNNEL_QUESTIONS.map((question) => RANNIELY_POLICY.indexOf(question));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(RANNIELY_POLICY).toContain("50 ml ficam em R$ 6.000 e 100 ml ficam em R$ 12.000");
    expect(RANNIELY_POLICY.indexOf("50 ml ficam em R$ 6.000 e 100 ml ficam em R$ 12.000")).toBeGreaterThan(positions[4]);
    expect(RANNIELY_POLICY.indexOf("Confirme se esse investimento faz sentido")).toBeGreaterThan(positions[4]);
    expect(RANNIELY_POLICY.indexOf("peça duas fotos reais")).toBeGreaterThan(RANNIELY_POLICY.indexOf("Confirme se esse investimento faz sentido"));
    expect(RANNIELY_POLICY).toContain("não gere imagem alterada");
    expect(RANNIELY_POLICY).not.toContain("quando você gostaria de realizar a Harmonização de Glúteos?");
  });

  it("blocks scheduling language without blocking ordinary greetings", () => {
    expect(containsRannielySchedulingIntent("Vou consultar a agenda e te digo o melhor horário.")).toBe(true);
    expect(containsRannielySchedulingIntent("Qualquer dia da semana funciona para você?")).toBe(true);
    expect(containsRannielySchedulingIntent("Qual o melhor dia e período para você?")).toBe(true);
    expect(containsRannielySchedulingIntent("Qual período costuma ser melhor para você: manhã ou tarde?")).toBe(true);
    expect(containsRannielySchedulingIntent("Vou passar nossa conversa para o consultor combinar o melhor horário com você.")).toBe(true);
    expect(containsRannielySchedulingIntent("Boa tarde! O que você mais busca melhorar?")).toBe(false);
    expect(containsRannielySchedulingIntent("Se for aprovada, você consegue comparecer presencialmente na data combinada?")).toBe(false);
  });

  it("calculates the next unanswered question from a repeated legacy conversation", () => {
    const history = [
      { role: "assistant" as const, content: "Quando puder, me conta o que você gostaria de melhorar na região dos glúteos para eu dar sequência à sua pré-avaliação." },
      { role: "user" as const, content: "Sim" },
      { role: "assistant" as const, content: "O que você gostaria de melhorar na região dos glúteos?" },
      { role: "user" as const, content: "Aumentar o glúteo" },
      { role: "assistant" as const, content: "Em qual cidade e estado você está?" },
      { role: "user" as const, content: "Osasco" },
      { role: "assistant" as const, content: "Qual o melhor dia e período para você?" },
      { role: "user" as const, content: "Sábado" },
      { role: "assistant" as const, content: "Qual período costuma ser melhor para você: manhã ou tarde?" },
      { role: "user" as const, content: "Tarde" },
    ];
    expect(getRannielyNextQuestionIndex(history)).toBe(1);
    expect(containsRannielyLeadEcho("Entendi, você quer aumentar o glúteo. Em que momento você está em relação à próxima turma de paciente modelo?", "Aumentar o glúteo")).toBe(true);
    expect(needsRannielyReplyCorrection("Não consegui consultar a agenda agora. Qual dia funciona?", "Tarde", 1)).toBe(true);
    expect(needsRannielyReplyCorrection("Entendi. Em que momento você está em relação à próxima turma de paciente modelo?", "Tarde", 1)).toBe(false);
    expect(buildRannielyFallbackReply(1)).toBe("Entendi. Em que momento você está em relação à próxima turma de paciente modelo?");
  });

  it("keeps the Ranniely flow focused on consent, authorized negotiation and human evaluation", () => {
    expect(RANNIELY_POLICY).toContain("FUNIL DE QUALIFICAÇÃO — OBRIGATÓRIO ANTES DE MENCIONAR OU PEDIR FOTO");
    expect(RANNIELY_POLICY).toContain("O que você mais busca melhorar com a Harmonização de Glúteos?");
    expect(RANNIELY_POLICY).toContain("Em que momento você está em relação à próxima turma de paciente modelo?");
    expect(RANNIELY_POLICY).toContain("Qual faixa representa melhor seu faturamento mensal?");
    expect(RANNIELY_POLICY).toContain("Se for aprovada, você consegue comparecer presencialmente na data combinada?");
    expect(RANNIELY_POLICY).toContain("Você sabe que o procedimento envolve investimento?");
    expect(RANNIELY_POLICY).toContain("Não apresente uma lista nem diga que está aplicando um formulário");
    expect(RANNIELY_POLICY).toContain("Evite “pergunta 1”");
    expect(RANNIELY_POLICY).toContain("qualificação, interesse e consentimento");
    expect(RANNIELY_POLICY).toContain("50 ml por R$ 6.000 e 100 ml por R$ 12.000");
    expect(RANNIELY_POLICY).toContain("Não dê preço antes das cinco perguntas");
    expect(RANNIELY_POLICY).toContain("no máximo duas tentativas humanas e curtas");
    expect(RANNIELY_POLICY).toContain("a Dra. não recebe comissão");
    expect(RANNIELY_POLICY).toContain("Se a cliente recusar de forma clara");
    expect(RANNIELY_POLICY).toContain("NUNCA: agende ligação");
    expect(RANNIELY_POLICY).toContain("O atendimento acontece nesta conversa");
    expect(RANNIELY_POLICY).toContain("responda primeiro ao que a cliente acabou de dizer");
    expect(RANNIELY_POLICY).toContain("nunca a cliente");
    expect(RANNIELY_POLICY).toContain("Nunca diga “sou a [nome da cliente]”");
    expect(RANNIELY_POLICY).toContain("somente para chamá-la, nunca para se identificar");
    expect(RANNIELY_POLICY).toContain("[BREAK]");
    expect(RANNIELY_POLICY).toContain("avançar nas cinco respostas do funil");
    expect(RANNIELY_POLICY).toContain("quantidade, condição e validade");
    expect(RANNIELY_POLICY).toContain("não faça elogios físicos");
    expect(RANNIELY_POLICY).toContain("Não prometa prazo de retorno");
    expect(RANNIELY_POLICY).toContain("Os valores são fixos e autorizados");
    expect(RANNIELY_POLICY).toContain("05:00–11:59 “Bom dia”");
    expect(RANNIELY_POLICY).not.toContain("qual sua disponibilidade de dias e horários para conversarmos");
    expect(RANNIELY_POLICY).toContain("[HANDOFF]");
  });

  it("creates an actionable internal handoff summary for a received photo", () => {
    const summary = buildRannielyMediaHandoffSummary("wamid-123");
    expect(summary).toContain("ENCAMINHAMENTO PARA DRA. RANNIELY");
    expect(summary).toContain("mensagem wamid-123");
    expect(summary).toContain("não confirmação de compra");
    expect(summary).toContain("Dra. Ranniely avaliar profissionalmente");
  });
});
