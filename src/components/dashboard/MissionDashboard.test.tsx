// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MissionDashboard } from "./MissionDashboard";

vi.mock("@/hooks/usePhaseStore", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePhaseStore")>("@/hooks/usePhaseStore");
  return {
    ...actual,
    useEffectivePhase: () => "terra" as const,
    usePhaseStore: (selector: (state: { monthlyRevenue: number }) => unknown) =>
      selector({ monthlyRevenue: 32_000 }),
  };
});

describe("MissionDashboard — render real (regressão de crash)", () => {
  it("renderiza sem lançar exceção a visão da missão completa", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <MissionDashboard
            metrics={{
              spend: 45_000,
              leads: 1_582,
              cpl: 28.45,
              sales: 142,
              revenue: 49_700,
            }}
          />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it("renderiza os quatro KPIs solicitados, o funil orbital e o radar", () => {
    render(
      <MemoryRouter>
        <MissionDashboard
          metrics={{
            spend: 45_000,
            leads: 1_582,
            cpl: 28.45,
            sales: 142,
            revenue: 49_700,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Investimento")).toBeTruthy();
    expect(screen.getByText("Leads")).toBeTruthy();
    expect(screen.getByText("CPL")).toBeTruthy();
    expect(screen.getByText("Faturamento")).toBeTruthy();
    expect(screen.getByText("Funil Orbital da Missão")).toBeTruthy();
    expect(screen.getByText("Radar de Anomalias")).toBeTruthy();
  });

  it("nao quebra quando as metricas chegam invalidas ou vazias", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <MissionDashboard
            metrics={{ spend: 0, leads: 0, cpl: 0, sales: 0, revenue: 0 }}
          />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});
