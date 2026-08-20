import { describe, expect, it } from "vitest";
import { ensureDefaultDashboardContent } from "@/lib/dashboardViewDefaults";
import { DASHBOARD_CANONICAL_LAYOUT_VERSION, DEFAULT_VIEW } from "@/lib/widgetCatalog";

describe("ensureDefaultDashboardContent", () => {
  it("restaura o dashboard original e remove o catálogo duplicado de uma view legada", () => {
    const view = {
      id: "view-1",
      widgets: [{ id: "custom", type: "kpi", title: "KPI", config: {} }],
      layout: [{ i: "custom", x: 0, y: 2, w: 3, h: 2 }],
    };

    const restored = ensureDefaultDashboardContent(view);

    expect(restored.widgets.map((widget) => widget.id)).toEqual(DEFAULT_VIEW.widgets.map((widget) => widget.id));
    expect(restored.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(restored.layout).toEqual(DEFAULT_VIEW.layout);
  });

  it("migra uma vez o bloco legado e estabiliza a visualização", () => {
    const view = {
      id: "view-2",
      widgets: [{ id: "default", type: "default_block", title: "Padrão", config: {} }],
      layout: [{ i: "default", x: 0, y: 0, w: 12, h: 30 }],
    };

    const migrated = ensureDefaultDashboardContent(view);
    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(ensureDefaultDashboardContent(migrated)).toBe(migrated);
  });

  it("separa os KPIs do resumo em widgets redimensionáveis", () => {
    const migrated = ensureDefaultDashboardContent({
      id: "view-kpi-editor",
      widgets: [{ id: "default", type: "default_block", title: "Padrão", config: { canonicalLayoutVersion: 4 } }],
      layout: [{ i: "default", x: 0, y: 0, w: 12, h: 30 }],
    });
    const expectedIds = [
      "primary_revenue", "campaign_ctr", "campaign_conversion_rate",
    ];

    for (const id of expectedIds) {
      const widget = migrated.widgets.find((item) => item.id === id);
      const item = migrated.layout.find((entry) => entry.i === id);
      expect(widget?.type).toBe("kpi");
      expect(item).toMatchObject({ minW: 2, minH: 2 });
      expect(item?.w).toBeLessThan(12);
    }
  });

  it("migra uma visão v5 sem apagar os ajustes e separa a visão financeira em widgets", () => {
    const migrated = ensureDefaultDashboardContent({
      id: "view-financial-editor",
      widgets: [
        { id: "primary_revenue", type: "kpi", title: "Minha receita", config: { metric: "revenue_net" } },
        { id: "default", type: "default_block", title: "Padrão", config: { canonicalLayoutVersion: 5 } },
        { id: "custom", type: "kpi", title: "Meu KPI", config: { metric: "clicks" } },
      ],
      layout: [
        { i: "primary_revenue", x: 0, y: 0, w: 6, h: 3 },
        { i: "default", x: 0, y: 4, w: 12, h: 30 },
        { i: "custom", x: 6, y: 0, w: 3, h: 2 },
      ],
    });
    const expectedIds = [
      "payment_chart", "platform_distribution", "campaign_ctr", "campaign_conversion_rate",
    ];

    expect(migrated.widgets.find((widget) => widget.id === "primary_revenue")?.title).toBe("Minha receita");
    expect(migrated.widgets.find((widget) => widget.id === "custom")?.title).toBe("Meu KPI");
    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
      hideFinancialOverview: true,
    });
    for (const id of expectedIds) {
      expect(migrated.widgets.some((widget) => widget.id === id)).toBe(true);
      expect(migrated.layout.some((item) => item.i === id)).toBe(true);
    }

    const defaultLayout = migrated.layout.find((item) => item.i === "default")!;
    const highestEditableRow = migrated.layout
      .filter((item) => item.i !== "default")
      .reduce((max, item) => Math.max(max, item.y + item.h), 0);
    expect(defaultLayout.y).toBeGreaterThanOrEqual(highestEditableRow);
  });

  it("preserva widgets adicionados depois da migração canônica", () => {
    const view = {
      id: "view-3",
      widgets: [
        {
          id: "default",
          type: "default_block",
          title: "Padrão",
          config: { canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION },
        },
        { id: "custom", type: "kpi", title: "KPI", config: {} },
      ],
      layout: [
        { i: "default", x: 0, y: 0, w: 12, h: 30 },
        { i: "custom", x: 0, y: 31, w: 3, h: 2 },
      ],
    };

    expect(ensureDefaultDashboardContent(view)).toBe(view);
  });

  it("reduz uma visão v7 aos dois KPIs ao lado da distribuição por plataforma", () => {
    const migrated = ensureDefaultDashboardContent({
      id: "view-v6-layout",
      widgets: DEFAULT_VIEW.widgets.map((widget) => widget.id === "default"
        ? { ...widget, config: { ...widget.config, canonicalLayoutVersion: 7 } }
        : { ...widget }).concat([
          { id: "financial_ticket", type: "kpi", title: "Ticket Médio", config: {} },
          { id: "campaign_cpl", type: "kpi", title: "CPL", config: {} },
        ]),
      layout: DEFAULT_VIEW.layout.map((item) => ({ ...item, y: item.i === "default" ? 11 : item.y })).concat([
        { i: "financial_ticket", x: 0, y: 7, w: 3, h: 2 },
        { i: "campaign_cpl", x: 3, y: 7, w: 3, h: 2 },
      ]),
    });

    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(migrated.layout.find((item) => item.i === "platform_distribution")).toMatchObject({ x: 4, y: 2, w: 5, h: 5 });
    expect(migrated.layout.find((item) => item.i === "financial_margin")).toBeUndefined();
    expect(migrated.layout.find((item) => item.i === "campaign_ctr")).toMatchObject({ x: 9, y: 2, w: 3 });
    expect(migrated.widgets.some((widget) => widget.id === "financial_ticket")).toBe(false);
    expect(migrated.widgets.some((widget) => widget.id === "campaign_cpl")).toBe(false);
  });

  it("recompõe a coluna lateral incompleta de uma visualização v8", () => {
    const legacyV8 = {
      id: "view-v8-gap",
      widgets: DEFAULT_VIEW.widgets
        .filter((widget) => !["financial_margin", "financial_receivables"].includes(widget.id))
        .map((widget) => widget.id === "default"
          ? { ...widget, config: { ...widget.config, canonicalLayoutVersion: 8 } }
          : { ...widget }),
      layout: DEFAULT_VIEW.layout
        .filter((item) => !["financial_margin", "financial_receivables"].includes(item.i))
        .map((item) => ({ ...item, y: item.i === "default" ? 14 : item.y })),
    };

    const migrated = ensureDefaultDashboardContent(legacyV8);

    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(migrated.layout.find((item) => item.i === "payment_chart")).toMatchObject({ x: 0, y: 2, w: 4, h: 4 });
    expect(migrated.layout.find((item) => item.i === "platform_distribution")).toMatchObject({ x: 4, y: 2, w: 5, h: 5 });
    expect(migrated.layout.find((item) => item.i === "campaign_conversion_rate")).toMatchObject({ x: 9, y: 4, w: 3, h: 2 });
    expect(migrated.layout.find((item) => item.i === "financial_margin")).toBeUndefined();
    expect(migrated.layout.find((item) => item.i === "financial_receivables")).toBeUndefined();
    expect(migrated.layout.find((item) => item.i === "default")).toMatchObject({ x: 0, y: 7, w: 12 });
  });

  it("remove Margem e Recebíveis de uma visualização v9 e alinha a faixa", () => {
    const legacyV9 = {
      id: "view-v9-financial-kpis",
      widgets: [
        ...DEFAULT_VIEW.widgets,
        { id: "financial_margin", type: "kpi", title: "Margem", config: { metric: "profit_margin" } },
        { id: "financial_receivables", type: "kpi", title: "Recebíveis", config: { metric: "receivables" } },
      ].map((widget) => widget.id === "default"
        ? { ...widget, config: { ...widget.config, canonicalLayoutVersion: 9 } }
        : widget),
      layout: [
        ...DEFAULT_VIEW.layout.map((item) => ({ ...item, h: item.i === "payment_chart" || item.i === "platform_distribution" ? 8 : item.h, y: item.i === "default" ? 10 : item.y })),
        { i: "financial_margin", x: 9, y: 6, w: 3, h: 2 },
        { i: "financial_receivables", x: 9, y: 8, w: 3, h: 2 },
      ],
    };

    const migrated = ensureDefaultDashboardContent(legacyV9);

    expect(migrated.widgets.some((widget) => widget.id === "financial_margin")).toBe(false);
    expect(migrated.widgets.some((widget) => widget.id === "financial_receivables")).toBe(false);
    expect(migrated.layout.find((item) => item.i === "payment_chart")).toMatchObject({ y: 2, h: 4 });
    expect(migrated.layout.find((item) => item.i === "platform_distribution")).toMatchObject({ y: 2, h: 5 });
    expect(migrated.layout.find((item) => item.i === "default")).toMatchObject({ y: 7 });
  });

  it("realinha automaticamente a composição canônica v11", () => {
    const legacy = {
      id: "view-v11-alignment",
      widgets: DEFAULT_VIEW.widgets.map((widget) => widget.id === "default"
        ? { ...widget, config: { ...widget.config, canonicalLayoutVersion: 11 } }
        : widget),
      layout: DEFAULT_VIEW.layout.map((item) => ({
        ...item,
        h: item.i === "payment_chart" || item.i === "platform_distribution" ? 5 : item.h,
        y: item.i === "default" ? 7 : item.y,
      })),
    };

    const migrated = ensureDefaultDashboardContent(legacy);
    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(migrated.layout.find((item) => item.i === "payment_chart")).toMatchObject({ y: 2, h: 4 });
    expect(migrated.layout.find((item) => item.i === "platform_distribution")).toMatchObject({ y: 2, h: 5 });
    expect(migrated.layout.find((item) => item.i === "default")).toMatchObject({ y: 7 });
  });
});
