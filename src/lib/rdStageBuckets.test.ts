/**
 * Testes unitários para src/lib/rdStageBuckets.ts.
 *
 * Comportamento sob teste: bucketRDStage() mapeia cada etapa do RD Station
 * para exatamente um grupo de exibição (novo-lead, sem-conversa, conversa,
 * oportunidade, vendas, perdidas, etapa-propria), sem que uma etapa pertença
 * a dois grupos. Rótulos terminais (venda/perdida) têm precedência sobre o
 * nome. Pré-venda não é terminal. Etapas desconhecidas viram "etapa-propria"
 * com o nome original preservado.
 *
 * Não existe nenhum arquivo de teste anterior para rdStageBuckets — este é o
 * primeiro. O módulo fonte (rdStageBuckets.ts) foi criado no Ataque 2 do
 * plano de auditoria e já é usado por PerformanceSummaryDashboard.tsx.
 *
 * Instrução verbatim do usuário: "vamos corrigir tudo montando um prompt para
 * atacar um por 1" — este teste sustenta o Ataque 7 (deals sem estado) e a
   * renderização correta do funil no Resumo de Performance.
 */

import { describe, expect, it } from "vitest";
import { bucketRDStage, RDStageBucket } from "./rdStageBuckets";

const won = (name: string) => bucketRDStage({ stageName: name, won: true });
const lost = (name: string) => bucketRDStage({ stageName: name, lost: true });
const plain = (name: string) => bucketRDStage({ stageName: name });

describe("bucketRDStage — mapeamento de etapa RD para grupo de exibição", () => {
  describe("Vendas (rótulo terminal tem precedência)", () => {
    it("Venda", () => expect(plain("Venda").bucket).toBe("vendas"));
    it("Vendas", () => expect(plain("Vendas").bucket).toBe("vendas"));
    it("Sale/Sales", () => {
      expect(plain("Sale").bucket).toBe("vendas");
      expect(plain("Sales").bucket).toBe("vendas");
    });
    it("Vendido/Vendida", () => {
      expect(plain("Vendido").bucket).toBe("vendas");
      expect(plain("Vendida").bucket).toBe("vendas");
    });
    it("Venda realizada/concluída/ganha", () => {
      expect(plain("Venda Realizada").bucket).toBe("vendas");
      expect(plain("Venda Concluída").bucket).toBe("vendas");
      expect(plain("Venda Ganha").bucket).toBe("vendas");
    });
    it("Fechado ganho / ganho / won / cliente", () => {
      expect(plain("Fechado Ganho").bucket).toBe("vendas");
      expect(plain("Ganho").bucket).toBe("vendas");
      expect(plain("Won").bucket).toBe("vendas");
      expect(plain("Cliente").bucket).toBe("vendas");
    });
  });

  describe("Perdidas", () => {
    it("Perdido/Perda/Lost/Desqualificado", () => {
      expect(plain("Perdido").bucket).toBe("perdidas");
      expect(plain("Perda").bucket).toBe("perdidas");
      expect(plain("Lost").bucket).toBe("perdidas");
      expect(plain("Desqualificado").bucket).toBe("perdidas");
    });
  });

  describe("Pré-venda (não é terminal)", () => {
    it("Pré-venda e Pós-venda mapeiam para Conversa", () => {
      expect(plain("Pré-venda").bucket).toBe("conversa");
      expect(plain("Pós-venda").bucket).toBe("conversa");
    });
  });

  describe("Novo Lead", () => {
    it("Lead Novo / Novo Lead", () => {
      expect(plain("Lead Novo").bucket).toBe("novo-lead");
      expect(plain("Novo Lead").bucket).toBe("novo-lead");
    });
    it("Novo sozinho", () => {
      expect(plain("Novo").bucket).toBe("novo-lead");
      expect(plain("Novos").bucket).toBe("novo-lead");
    });
  });

  describe("Sem Conversa", () => {
    it("Sem contato / Sem conversa / Não atendeu / No show / Sem resposta / Tentativa / Stand By / Espera", () => {
      expect(plain("Sem Contato").bucket).toBe("sem-conversa");
      expect(plain("Sem Conversa").bucket).toBe("sem-conversa");
      expect(plain("Não Atendeu").bucket).toBe("sem-conversa");
      expect(plain("No Show").bucket).toBe("sem-conversa");
      expect(plain("Sem Resposta").bucket).toBe("sem-conversa");
      expect(plain("Tentativa").bucket).toBe("sem-conversa");
      expect(plain("Stand By").bucket).toBe("sem-conversa");
      expect(plain("Espera").bucket).toBe("sem-conversa");
    });
  });

  describe("Conversa", () => {
    it("Em conversa / Conversa / Atendimento / Em contato / WhatsApp", () => {
      expect(plain("Em Conversa").bucket).toBe("conversa");
      expect(plain("Conversa").bucket).toBe("conversa");
      expect(plain("Atendimento").bucket).toBe("conversa");
      expect(plain("Em Contato").bucket).toBe("conversa");
      expect(plain("WhatsApp").bucket).toBe("conversa");
    });
  });

  describe("Oportunidade", () => {
    it("Oportunidade / Proposta / Negociação", () => {
      expect(plain("Oportunidade").bucket).toBe("oportunidade");
      expect(plain("Proposta").bucket).toBe("oportunidade");
      expect(plain("Negociação").bucket).toBe("oportunidade");
    });
  });

  describe("Etapa própria (nunca somida)", () => {
    it("Etapa desconhecida", () => {
      expect(plain("Etapa Misteriosa").bucket).toBe("etapa-propria");
      expect(plain("Etapa Misteriosa").label).toBe("Etapa Misteriosa");
    });
    it("Vazio/undefined", () => {
      expect(plain("").bucket).toBe("etapa-propria");
      expect(plain(null as any).bucket).toBe("etapa-propria");
      expect(plain(undefined as any).bucket).toBe("etapa-propria");
    });
  });

  describe("Precedência: won sobrepõe nome (fonte da verdade do RD)", () => {
    it("won=true vence mesmo com nome de perdido (RD diz que foi vendido)", () => {
      expect(won("Perdido").bucket).toBe("vendas");
    });
    it("lost com nome neutro conta como perdida", () => {
      expect(lost("Etapa de Perda").bucket).toBe("perdidas");
    });
  });

  describe("Case insensitive e acentos", () => {
    it("normaliza MAIÚSCULAS e acentos", () => {
      expect(plain("VENDA").bucket).toBe("vendas");
      expect(plain("PÉRDIDA").bucket).toBe("perdidas");
      expect(plain("LEAD NOVO").bucket).toBe("novo-lead");
    });
  });

  describe("Retorna nome original para etapa própria", () => {
    it("label preserva o nome da etapa", () => {
      const r = plain("Fase Especial");
      expect(r.label).toBe("Fase Especial");
    });
  });
});
