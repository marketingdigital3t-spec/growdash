import { getWidgetDef, type WidgetType } from "@/lib/widgetCatalog";

export interface DashboardGridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
  [key: string]: unknown;
}

interface DashboardWidget {
  id: string;
  type: string;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : minimum, minimum), maximum);

function sanitizeItem(item: DashboardGridItem, columns: number): DashboardGridItem {
  const width = clamp(Number(item.w), 1, columns);
  return {
    ...item,
    x: clamp(Number(item.x), 0, columns - width),
    y: Math.max(Number.isFinite(Number(item.y)) ? Number(item.y) : 0, 0),
    w: width,
    h: Math.max(Number.isFinite(Number(item.h)) ? Number(item.h) : 2, 1),
    minW: item.minW ? clamp(Number(item.minW), 1, width) : undefined,
    minH: item.minH ? Math.max(Number(item.minH), 1) : undefined,
  };
}

export function packDashboardLayout(items: DashboardGridItem[], columns: number): DashboardGridItem[] {
  let cursorX = 0;
  let rowY = 0;
  let rowHeight = 0;

  return items.map((rawItem) => {
    const item = sanitizeItem(rawItem, columns);
    if (cursorX > 0 && cursorX + item.w > columns) {
      rowY += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }

    const packed = { ...item, x: cursorX, y: rowY };
    cursorX += item.w;
    rowHeight = Math.max(rowHeight, item.h);

    if (cursorX >= columns) {
      rowY += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }

    return packed;
  });
}

function isSingleLaneLayout(items: DashboardGridItem[], columns: number) {
  const partialWidthItems = items.filter((item) => item.w < columns);
  return partialWidthItems.length >= 2 && partialWidthItems.every((item) => item.x === 0);
}

export function normalizeDesktopDashboardLayout(
  layout: DashboardGridItem[],
  widgets: DashboardWidget[],
  columns = 12,
): DashboardGridItem[] {
  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const ordered = layout
    .filter((item) => widgetById.has(item.i))
    .map((item) => sanitizeItem(item, columns))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (!isSingleLaneLayout(ordered, columns)) return ordered;

  const recovered = ordered.map((item) => {
    const widget = widgetById.get(item.i);
    const definition = widget ? getWidgetDef(widget.type as WidgetType) : undefined;
    const preferredWidth = widget?.type === "kpi"
      ? definition?.defaultLayout.w ?? 3
      : item.w;
    return sanitizeItem({ ...item, w: preferredWidth }, columns);
  });

  return packDashboardLayout(recovered, columns);
}

function responsiveWidth(item: DashboardGridItem, sourceColumns: number, targetColumns: number) {
  if (targetColumns >= sourceColumns) return clamp(item.w, 1, targetColumns);
  if (targetColumns === 8) return item.w <= 4 ? 4 : 8;
  if (targetColumns === 4) return item.w <= 3 ? 2 : 4;
  return targetColumns;
}

export function buildResponsiveDashboardLayout(
  desktopLayout: DashboardGridItem[],
  sourceColumns: number,
  targetColumns: number,
): DashboardGridItem[] {
  if (sourceColumns === targetColumns) {
    return desktopLayout.map((item) => sanitizeItem(item, targetColumns));
  }

  return packDashboardLayout(
    desktopLayout.map((item) => ({
      ...item,
      w: responsiveWidth(item, sourceColumns, targetColumns),
      minW: undefined,
    })),
    targetColumns,
  );
}

export function findDashboardSlot(
  existingLayout: DashboardGridItem[],
  width: number,
  height: number,
  columns = 12,
) {
  const items = existingLayout.map((item) => sanitizeItem(item, columns));
  const safeWidth = clamp(width, 1, columns);
  const safeHeight = Math.max(height, 1);
  const maxY = items.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= columns - safeWidth; x += 1) {
      const collides = items.some((item) =>
        x < item.x + item.w &&
        x + safeWidth > item.x &&
        y < item.y + item.h &&
        y + safeHeight > item.y,
      );
      if (!collides) return { x, y };
    }
  }

  return { x: 0, y: maxY };
}
