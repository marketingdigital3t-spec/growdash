import { DASHBOARD_CANONICAL_LAYOUT_VERSION, DEFAULT_VIEW } from "@/lib/widgetCatalog";
import { findDashboardSlot } from "@/lib/responsiveDashboardLayout";

interface DashboardViewShape {
  layout: any[];
  widgets: any[];
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

  if (currentVersion >= DASHBOARD_CANONICAL_LAYOUT_VERSION) {
    if (hasDefaultLayout) return view;

    return {
      ...view,
      layout: [{ ...defaultLayout, i: defaultId }, ...layout.filter((item) => item.i !== defaultId)],
    };
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
      "financial_ticket", "financial_profit", "campaign_leads", "campaign_cpl", "campaign_cost_per_link",
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
