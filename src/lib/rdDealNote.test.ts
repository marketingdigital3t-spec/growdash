import { describe, expect, it } from "vitest";
import { buildRDDealNote, isNoteAutomationFunnel } from "../../supabase/functions/_shared/rdDealNote";

describe("RD deal note", () => {
  it("renders the exact 16-line template with RD values taking priority", () => {
    const note = buildRDDealNote({
      deal: {
        contact_name: "Dr. Kaique Chamone | Médico",
        contact_email: "ka.chamone20@gmail.com",
        contact_phone: "+55 38 98406-3822",
        lead_city: "Janaúba",
        lead_state: "MG",
        lead_created_at: "2026-09-12T12:11:04.000Z",
        custom_fields: { contact_area_de_atuacao: "Outras", contact_faturamento_atual: "De R$ 30 mil a R$ 50 mil por mês", contact_plataforma: "Instagram" },
        raw: { status: "Complete", created_at: "2026-09-12T12:11:04.000Z" },
      },
      meta: { name: "Meta name", platform: "Facebook", is_organic: false },
    });
    expect(note.split("\n")).toHaveLength(16);
    expect(note).toContain("Nome: Dr. Kaique Chamone | Médico");
    expect(note).toContain("Plataforma: Instagram");
    expect(note).toContain("Orgânico: Não");
    expect(note).toContain("Status: Complete");
    expect(note).toContain("Data/hora do lead: 12/09/2026 às 09:11:04");
  });

  it("keeps every line when fields are missing and gates the first funnel", () => {
    const note = buildRDDealNote({ deal: {} });
    expect(note.split("\n")).toHaveLength(16);
    expect(note).toContain("Área de atuação: Não informado");
    expect(note).toContain("Formulário: Não informado");
    expect(isNoteAutomationFunnel("Dra. Ste Andrade – Aluna")).toBe(true);
    expect(isNoteAutomationFunnel("Outro funil")).toBe(false);
  });

  it("uses Meta only for fields that RD did not provide", () => {
    const note = buildRDDealNote({
      deal: { contact_name: "Nome RD", custom_fields: { plataforma: "Instagram" } },
      meta: { name: "Nome Meta", platform: "Facebook", campaign_name: "Campanha Meta" },
    });
    expect(note).toContain("Nome: Nome RD");
    expect(note).toContain("Plataforma: Instagram");
    expect(note).toContain("Campanha: Campanha Meta");
  });
});
