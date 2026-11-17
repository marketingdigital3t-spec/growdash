// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceSummaryDashboard } from "./PerformanceSummaryDashboard";

describe("PerformanceSummaryDashboard — fidelidade à referência solicitada", () => {
  const defaultProps = {
    accountTitle: "Aluna",
    totalSpend: 2515.42,
    accountsSpend: [
      { id: "ca1", name: "Investimento CA01", spend: 2099.1 },
      { id: "ca2", name: "Investimento CA02", spend: 416.32 },
    ],
    salesCount: 4,
    totalLeads: 91,
    deals: [],
  };

  it("renderiza o cabeçalho Resumo de Performance com a conta e subtítulo", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText(/Resumo de Performance/i)).toBeTruthy();
    expect(screen.getByText(/Consolidado de investimento, leads e vendas/i)).toBeTruthy();
  });

  it("renderiza os investimentos individuais e o Investimento Total em destaque", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("Investimentos e resultado")).toBeTruthy();
    expect(screen.getByText("Investimento CA01")).toBeTruthy();
    expect(screen.getByText("Investimento CA02")).toBeTruthy();
    expect(screen.getByText("Investimento Total")).toBeTruthy();
  });

  it("renderiza os blocos de Vendas e CAC com a nota explicativa", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getAllByText("Vendas")[0]).toBeTruthy();
    expect(screen.getByText("CAC")).toBeTruthy();
    expect(screen.getByText(/CAC calculado com/i)).toBeTruthy();
  });

  it("renderiza os blocos de Leads Totais e Taxa de Conversão", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("Leads Totais")).toBeTruthy();
    expect(screen.getByText("Taxa de conversão")).toBeTruthy();
    // Taxa: (4 / 91) * 100 = 4.40%
    expect(screen.getByText("4,40%")).toBeTruthy();
  });

  it("renderiza o Pipeline / Funil de leads com as 6 etapas solicitadas", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("Pipeline / Funil de leads")).toBeTruthy();
    expect(screen.getByText("Novo Lead")).toBeTruthy();
    expect(screen.getByText("Sem Conversa")).toBeTruthy();
    expect(screen.getByText("Conversa")).toBeTruthy();
    expect(screen.getByText("Oportunidade")).toBeTruthy();
    // Vendas aparece duas vezes: no card superior e no funil
    expect(screen.getAllByText("Vendas").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Perdidas")).toBeTruthy();
  });

  it("renderiza o rodapé de dados consolidados da campanha", () => {
    render(<PerformanceSummaryDashboard {...defaultProps} />);
    expect(screen.getByText("Dados consolidados da campanha")).toBeTruthy();
  });

  it("não quebra quando os dados estão zerados", () => {
    expect(() =>
      render(
        <PerformanceSummaryDashboard
          totalSpend={0}
          accountsSpend={[]}
          salesCount={0}
          totalLeads={0}
          deals={[]}
        />,
      ),
    ).not.toThrow();
  });
});
