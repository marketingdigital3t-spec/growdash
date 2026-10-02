import type { Sale } from "@/hooks/useSales";

export function canonicalSaleKey(sale: Pick<Sale, "id" | "rd_deal_id" | "source_provider" | "source_record_id">) {
  if (sale.rd_deal_id?.trim()) return `rd:${sale.rd_deal_id.trim()}`;
  if (sale.source_provider?.trim() && sale.source_record_id?.trim()) {
    return `source:${sale.source_provider.trim().toLowerCase()}:${sale.source_record_id.trim()}`;
  }
  return `sale:${sale.id}`;
}

export function dedupeCanonicalSales<T extends Sale>(rows: T[]) {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = canonicalSaleKey(row);
    const rowTime = new Date(row.updated_at || row.created_at || 0).getTime();
    const current = unique.get(key);
    const currentTime = current ? new Date(current.updated_at || current.created_at || 0).getTime() : -Infinity;
    if (!current || rowTime >= currentTime) unique.set(key, row);
  }
  return Array.from(unique.values());
}
