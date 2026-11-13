// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceSummaryDashboard } from "./PerformanceSummaryDashboard";

describe("PerformanceSummaryDashboard — conta selecionada e funil CRM", () => {
  const defaultProps = {
    accountTitle: "DRA RANNIELY SILVA [GRUPO ZNTT]",
    totalSpend: 2515.42,
    salesCount: 4,
    totalLeads: 91,
    deals: [
      { rd_stage_name: "Novo Lead", win: false },
      { rd_stage_name: "Conversa", win: false },
      { rd_stage_name: "Oportunidade", win: false },
      { rd_stage_name: "Vendas", win: true },
      { rd_stage_name: "Perdida", win: false, lost_reason: "Sem retorno" },
    ],
  };

  it("renderiza o resumo da conta selecionada sem cards de investimento por CA", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText(/Resumo de Performance/i)).toBeTruthy();
    expect(screen.getByText("DRA RANNIELY SILVA [GRUPO ZNTT]")).toBeTruthy();
    expect(screen.getByText("Investimento total")).toBeTruthy();
    expect(screen.queryByText("Investimento CA01")).toBeNull();
    expect(screen.queryByText("Investimento CA02")).toBeNull();
  });

  it("renderiza uma fileira com os seis KPIs pedidos", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    for (const label of ["Investimento total", "Leads", "CPL", "Vendas", "CAC", "Taxa de conversão"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("calcula CPL, CAC e taxa usando os números reais do escopo", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("R$ 27,64")).toBeTruthy();
    expect(screen.getByText("R$ 628,86")).toBeTruthy();
    expect(screen.getByText("4,40%")).toBeTruthy();
  });

  it("renderiza o Funil CRM abaixo com as seis etapas observadas", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("Funil CRM")).toBeTruthy();
    for (const label of ["Novo Lead", "Sem Conversa", "Conversa", "Oportunidade", "Vendas", "Perdidas"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("não inventa contagens de pipeline quando o CRM não devolve negócios", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} deals={[]} />);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5);
  });

  it("não quebra com o escopo zerado", () => {
    expect(() =>
      render(
        <PerformanceSummaryDashboard
          totalSpend={0}
          salesCount={0}
          totalLeads={0}
          deals={[]}
        />,
      ),
    ).not.toThrow();
  });
});
