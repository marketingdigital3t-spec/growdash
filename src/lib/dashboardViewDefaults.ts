import { DASHBOARD_CANONICAL_LAYOUT_VERSION, DEFAULT_VIEW } from "@/lib/widgetCatalog";
import { findDashboardSlot } from "@/lib/responsiveDashboardLayout";

interface DashboardViewShape {
  layout: any[];
  widgets: any[];
}

/**
 * Corrige somente a lacuna de uma composição padrão intacta. O bloco de
 * conteúdo é estático no grid e, por isso, não participa da compactação
 * vertical automática do react-grid-layout.
 */
export function alignCanonicalDefaultBlock(layout: any[], defaultId: string) {
  const defaultLayout = DEFAULT_VIEW.layout.find((item) => item.i === "default")!;
  const canonicalItems = DEFAULT_VIEW.layout.filter((item) => item.i !== "default");
  const hasCanonicalAnalyticRow = canonicalItems.every((expected) => {
    const actual = layout.find((item) => item.i === expected.i);
    return actual
      && actual.x === expected.x
      && actual.y === expected.y
      && actual.w === expected.w
      && actual.h === expected.h;
  });

  if (!hasCanonicalAnalyticRow) return layout;

  return layout.map((item) => item.i === defaultId
    ? { ...item, x: defaultLayout.x, y: defaultLayout.y, w: defaultLayout.w, minW: defaultLayout.minW, minH: defaultLayout.minH }
    : item);
}

/** Remove apenas uma pequena lacuna acidental antes do bloco estático padrão. */
export function anchorDefaultBlockAfterPreviousWidgets(layout: any[], defaultId: string) {
  const defaultItem = layout.find((item) => item.i === defaultId);
  if (!defaultItem || Number(defaultItem.w) !== 12) return layout;

  const previousEnd = layout
    .filter((item) => item.i !== defaultId && Number(item.y) < Number(defaultItem.y))
    .reduce((maximum, item) => Math.max(maximum, Number(item.y) + Number(item.h)), 0);
  const gap = Number(defaultItem.y) - previousEnd;

  // Uma folga de até três linhas é resíduo das versões anteriores do grid;
  // posições com afastamento maior são consideradas uma escolha de layout.
  if (previousEnd <= 0 || gap <= 0 || gap > 3) return layout;
  return layout.map((item) => item.i === defaultId ? { ...item, y: previousEnd } : item);
}

/**
 * Restores the original Growdash dashboard once for legacy saved views.
 *
 * Some saved views received the complete widget catalog in addition to the
 * standard dashboard, producing duplicated metrics and broken spacing. The
 * version marker lets us clean those views once while still preserving any
 * widgets that the user deliberately adds after the migration.
 */
export function ensureDefaultDashboardContent<T extends DashboardViewShape>(view: T): T {
  const defaultWidget = DEFAULT_VIEW.widgets.find((widget) => widget.type === "default_block")!;
  const defaultLayout = DEFAULT_VIEW.layout.find((item) => item.i === defaultWidget.id)!;
  const widgets = Array.isArray(view.widgets) ? view.widgets : [];
  const layout = Array.isArray(view.layout) ? view.layout : [];
  const existingDefault = widgets.find((widget) => widget.id === defaultWidget.id || widget.type === "default_block");
  const currentVersion = Number(existingDefault?.config?.canonicalLayoutVersion || 0);
  const defaultId = existingDefault?.id || defaultWidget.id;
  const hasDefaultLayout = layout.some((item) => item.i === defaultId);

  // O primeiro KPI canônico representa faturamento bruto. A correção é
  // propositalmente estreita: só alcança a combinação legada exata, sem
  // sobrescrever um cartão que o usuário tenha personalizado.
  const hasLegacyPrimaryRevenue = widgets.some((widget) => (
    widget.id === "primary_revenue"
    && widget.title === "Faturamento Líquido"
    && widget.config?.metric === "revenue_net"
  ));
  const hasLegacyPrimaryProfit = widgets.some((widget) => (
    widget.id === "primary_profit"
    && widget.title === "Lucro Líquido"
    && widget.config?.metric === "profit"
  ));
  if (hasLegacyPrimaryRevenue || hasLegacyPrimaryProfit) {
    return {
      ...view,
      widgets: widgets.map((widget) => {
        if (widget.id === "primary_revenue" && widget.title === "Faturamento Líquido" && widget.config?.metric === "revenue_net") {
          return { ...widget, title: "Faturamento Bruto", config: { ...widget.config, metric: "revenue_gross" } };
        }
        if (widget.id === "primary_profit" && widget.title === "Lucro Líquido" && widget.config?.metric === "profit") {
          return { ...widget, title: "Lucro" };
        }
        if (widget.id === defaultId) {
          return { ...widget, config: { ...widget.config, ...defaultWidget.config } };
        }
        return widget;
      }),
    };
  }

  // Algumas visualizações já canônicas foram gravadas com o bloco estático
  // abaixo da faixa analítica. Como o bloco é estático, o compactador do grid
  // não consegue ocupar as três linhas vazias. Reancoramos apenas quando toda
  // a faixa padrão ainda corresponde exatamente ao layout canônico; qualquer
  // rearranjo manual do usuário permanece preservado.
  if (currentVersion >= 14 && currentVersion < DASHBOARD_CANONICAL_LAYOUT_VERSION && existingDefault) {
    const canonicalLayout = alignCanonicalDefaultBlock(layout, defaultId);
    const alignedLayout = canonicalLayout === layout
      ? layout
      : anchorDefaultBlockAfterPreviousWidgets(canonicalLayout, defaultId);

    return {
      ...view,
      widgets: widgets.map((widget) => widget.id === defaultId
        ? { ...widget, config: { ...widget.config, ...defaultWidget.config } }
        : widget),
      layout: alignedLayout,
    };
  }

  if (currentVersion >= DASHBOARD_CANONICAL_LAYOUT_VERSION) {
    if (hasDefaultLayout) return view;

    return {
      ...view,
      layout: [{ ...defaultLayout, i: defaultId }, ...layout.filter((item) => item.i !== defaultId)],
    };
  }

  // A versão 14 equaliza a altura da faixa analítica. A atualização reposiciona
  // somente os widgets padrão e mantém qualquer conteúdo adicionado pelo usuário
  // abaixo deles, sem deixar uma faixa vazia sob o gráfico de pagamento.
  if (currentVersion === 13 && existingDefault) {
    const canonicalIds = new Set([...DEFAULT_VIEW.widgets.map((widget) => widget.id), defaultId]);
    const canonicalLayout = DEFAULT_VIEW.layout.map((item) => ({ ...item, i: item.i === "default" ? defaultId : item.i }));
    const customWidgets = widgets.filter((widget) => !canonicalIds.has(widget.id));
    const customLayout = layout.filter((item) => !canonicalIds.has(item.i));
    const canonicalWidgets = DEFAULT_VIEW.widgets.map((widget) => {
      const existing = widget.type === "default_block"
        ? existingDefault
        : widgets.find((candidate) => candidate.id === widget.id);
      return existing
        ? (widget.type === "default_block"
          ? { ...existing, id: defaultId, config: { ...existing.config, ...defaultWidget.config } }
          : existing)
        : { ...widget, config: { ...widget.config } };
    });
    const firstFreeRow = canonicalLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const safeCustomLayout = customLayout.map((item) => ({ ...item, y: Math.max(Number(item.y || 0), firstFreeRow) }));
    return { ...view, widgets: [...canonicalWidgets, ...customWidgets], layout: [...canonicalLayout, ...safeCustomLayout] };
  }

  // A versão 12 corrige o desalinhamento da faixa analítica: os gráficos
  // passam a terminar junto da coluna CTR/conversão, sem uma lacuna visual.
  // Apenas os widgets canônicos são reposicionados; widgets adicionados pelo
  // usuário continuam disponíveis logo após a composição padrão.
  if (currentVersion === 11 && existingDefault) {
    const canonicalIds = new Set([...DEFAULT_VIEW.widgets.map((widget) => widget.id), defaultId]);
    const canonicalLayout = DEFAULT_VIEW.layout.map((item) => ({ ...item, i: item.i === "default" ? defaultId : item.i }));
    const customWidgets = widgets.filter((widget) => !canonicalIds.has(widget.id));
    const customLayout = layout.filter((item) => !canonicalIds.has(item.i));
    const canonicalWidgets = DEFAULT_VIEW.widgets.map((widget) => {
      const existing = widget.type === "default_block"
        ? existingDefault
        : widgets.find((candidate) => candidate.id === widget.id);
      return existing
        ? (widget.type === "default_block"
          ? { ...existing, id: defaultId, config: { ...existing.config, ...defaultWidget.config } }
          : existing)
        : { ...widget, config: { ...widget.config } };
    });
    const firstFreeRow = canonicalLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const safeCustomLayout = customLayout.map((item) => ({ ...item, y: Math.max(Number(item.y || 0), firstFreeRow) }));
    return { ...view, widgets: [...canonicalWidgets, ...customWidgets], layout: [...canonicalLayout, ...safeCustomLayout] };
  }

  // A versão 10 retira Margem e Recebíveis da faixa inicial e reduz os dois
  // gráficos para a altura exata dos dois KPIs restantes. Só são removidos os
  // IDs padrão; cards financeiros adicionados manualmente pelo usuário ficam
  // intactos porque possuem identificadores próprios.
  if (currentVersion >= 9 && existingDefault) {
    const retiredIds = new Set(["financial_margin", "financial_receivables"]);
    const hasRetiredStandardWidget = widgets.some((widget) => retiredIds.has(widget.id));
    if (!hasRetiredStandardWidget) {
      return {
        ...view,
        widgets: widgets.map((widget) => widget.id === defaultId
          ? { ...widget, config: { ...widget.config, ...defaultWidget.config } }
          : widget),
      };
    }

    const canonicalIds = new Set([...DEFAULT_VIEW.widgets.map((widget) => widget.id), defaultId]);
    const canonicalLayout = DEFAULT_VIEW.layout.map((item) => ({ ...item, i: item.i === "default" ? defaultId : item.i }));
    const customWidgets = widgets.filter((widget) => !canonicalIds.has(widget.id) && !retiredIds.has(widget.id));
    const canonicalWidgets = DEFAULT_VIEW.widgets.map((widget) => {
      const existing = widget.type === "default_block"
        ? existingDefault
        : widgets.find((candidate) => candidate.id === widget.id);
      if (!existing) return { ...widget, config: { ...widget.config } };
      return widget.type === "default_block"
        ? { ...existing, id: defaultId, config: { ...existing.config, ...defaultWidget.config } }
        : existing;
    });
    let customY = canonicalLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const customLayout = layout
      .filter((item) => !canonicalIds.has(item.i) && !retiredIds.has(item.i))
      .map((item) => {
        const next = { ...item, x: 0, y: customY, w: Math.min(12, Math.max(2, item.w || 3)) };
        customY += Math.max(2, item.h || 2);
        return next;
      });
    return { ...view, widgets: [...canonicalWidgets, ...customWidgets], layout: [...canonicalLayout, ...customLayout] };
  }

  // Algumas views v8 foram gravadas antes de os quatro cards laterais serem
  // inseridos. Elas conservavam CTR e Taxa de Conversão, mas não Margem nem
  // Recebíveis; o bloco padrão ficava abaixo de uma área vazia. Como faltam
  // widgets canônicos (e não é apenas uma preferência de posição), é seguro
  // reconstruir somente a faixa inicial, preservando widgets personalizados.
  if (currentVersion >= 8 && existingDefault) {
    const requiredSecondaryIds = [
      "campaign_ctr",
      "campaign_conversion_rate",
      "financial_margin",
      "financial_receivables",
    ];
    const hasIncompleteSecondaryColumn = requiredSecondaryIds.some(
      (id) => !widgets.some((widget) => widget.id === id),
    );

    if (!hasIncompleteSecondaryColumn) {
      return {
        ...view,
        widgets: widgets.map((widget) => widget.id === defaultId
          ? { ...widget, config: { ...widget.config, ...defaultWidget.config } }
          : widget),
      };
    }

    const canonicalIds = new Set([...DEFAULT_VIEW.widgets.map((widget) => widget.id), defaultId]);
    const canonicalLayout = DEFAULT_VIEW.layout.map((item) => ({ ...item, i: item.i === "default" ? defaultId : item.i }));
    const customWidgets = widgets.filter((widget) => !canonicalIds.has(widget.id));
    const canonicalWidgets = DEFAULT_VIEW.widgets.map((widget) => {
      const existing = widget.type === "default_block"
        ? existingDefault
        : widgets.find((candidate) => candidate.id === widget.id);
      if (!existing) return { ...widget, config: { ...widget.config } };
      return widget.type === "default_block"
        ? { ...existing, id: defaultId, config: { ...existing.config, ...defaultWidget.config } }
        : existing;
    });
    let customY = canonicalLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const customLayout = layout
      .filter((item) => !canonicalIds.has(item.i))
      .map((item) => {
        const next = { ...item, x: 0, y: customY, w: Math.min(12, Math.max(2, item.w || 3)) };
        customY += Math.max(2, item.h || 2);
        return next;
      });
    return { ...view, widgets: [...canonicalWidgets, ...customWidgets], layout: [...canonicalLayout, ...customLayout] };
  }

  // Version 8 keeps only the four actionable secondary KPIs beside platform
  // distribution. Remove redundant cards from the standard view once, while
  // preserving widgets deliberately added by the user below it.
  if (currentVersion === 7 && existingDefault) {
    const retiredIds = new Set([
      "financial_ticket", "financial_profit", "financial_margin", "financial_receivables", "campaign_leads", "campaign_cpl", "campaign_cost_per_link",
    ]);
    const canonicalIds = new Set([...DEFAULT_VIEW.widgets.map((widget) => widget.id), defaultId]);
    const canonicalLayout = DEFAULT_VIEW.layout.map((item) => ({ ...item, i: item.i === "default" ? defaultId : item.i }));
    const customWidgets = widgets.filter((widget) => !canonicalIds.has(widget.id) && !retiredIds.has(widget.id));
    const canonicalWidgets = DEFAULT_VIEW.widgets.map((widget) => {
      const existing = widget.type === "default_block"
        ? existingDefault
        : widgets.find((candidate) => candidate.id === widget.id);
      if (!existing) return { ...widget, config: { ...widget.config } };
      return widget.type === "default_block"
        ? { ...existing, id: defaultId, config: { ...existing.config, ...defaultWidget.config } }
        : existing;
    });
    let customY = canonicalLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const customLayout = layout
      .filter((item) => !canonicalIds.has(item.i) && !retiredIds.has(item.i))
      .map((item) => {
        const next = { ...item, x: 0, y: customY, w: Math.min(12, Math.max(2, item.w || 3)) };
        customY += Math.max(2, item.h || 2);
        return next;
      });
    return { ...view, widgets: [...canonicalWidgets, ...customWidgets], layout: [...canonicalLayout, ...customLayout] };
  }

  // Version 6 separates the two financial charts and every financial KPI from
  // the static default block. Upgrade version 5 views additively: placements
  // already edited by the user are kept, missing widgets receive free slots,
  // and the default block is moved below them to prevent overlap.
  if (currentVersion >= 5 && existingDefault) {
    const canonicalWidgets = DEFAULT_VIEW.widgets.filter((widget) => widget.type !== "default_block");
    const existingIds = new Set(widgets.map((widget) => widget.id));
    const nextWidgets = widgets
      .map((widget) => widget.id !== existingDefault.id ? widget : {
        ...widget,
        config: { ...widget.config, ...defaultWidget.config },
      });
    const nextLayout = layout.filter((item) => item.i !== defaultId);

    for (const canonicalWidget of canonicalWidgets) {
      if (existingIds.has(canonicalWidget.id)) continue;
      const canonicalLayout = DEFAULT_VIEW.layout.find((item) => item.i === canonicalWidget.id)!;
      const slot = findDashboardSlot(nextLayout, canonicalLayout.w, canonicalLayout.h, 12);
      nextWidgets.push({ ...canonicalWidget, config: { ...canonicalWidget.config } });
      nextLayout.push({ ...canonicalLayout, x: slot.x, y: slot.y });
    }

    const maxY = nextLayout.reduce((maximum, item) => Math.max(maximum, Number(item.y || 0) + Number(item.h || 1)), 0);
    nextLayout.push({ ...defaultLayout, i: defaultId, y: Math.max(defaultLayout.y, maxY) });
    return { ...view, widgets: nextWidgets, layout: nextLayout };
  }

  return {
    ...view,
    widgets: DEFAULT_VIEW.widgets.map((widget) => ({ ...widget, config: { ...widget.config } })),
    layout: DEFAULT_VIEW.layout.map((item) => ({ ...item })),
  };
}
