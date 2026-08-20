import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const valueAt = (source: any, paths: string[]) => paths.map((path) => path.split(".").reduce((current, key) => current?.[key], source)).find((value) => value !== undefined && value !== null && value !== "");
const numberValue = (value: unknown) => Number(String(value ?? 0).replace(",", ".")) || 0;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const requestUrl = new URL(req.url);
    const publicId = requestUrl.pathname.split("/").filter(Boolean).at(-1);
    if (!publicId) return json({ error: "Conexão não informada" }, 404);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integration } = await admin.from("integrations").select("id,user_id,provider,webhook_secret,is_active").like("provider", "sales_webhook_%").eq("provider_account_id", publicId).eq("is_active", true).maybeSingle();
    const secret = req.headers.get("x-growdash-webhook-secret")?.trim() || requestUrl.searchParams.get("token")?.trim();
    if (!integration || !secret || secret !== integration.webhook_secret) return json({ error: "Não autorizado" }, 401);
    const raw = await req.text();
    const payload = JSON.parse(raw || "{}");
    const eventType = stringValue(valueAt(payload, ["event", "event_type", "type", "data.event", "order_status", "data.status"])).toLowerCase();
    const recordId = stringValue(valueAt(payload, ["id", "event_id", "transaction", "transaction_id", "order_id", "data.id", "data.order_id", "purchase.transaction", "data.transaction_id"]));
    if (!recordId) return json({ error: "Evento sem identificador de pedido" }, 422);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const { error: eventError } = await admin.from("sales_webhook_events").insert({ integration_id: integration.id, provider_event_id: recordId, event_type: eventType || null, payload_sha256: digest });
    if (eventError?.code === "23505") return json({ ok: true, duplicate: true });
    if (eventError) throw eventError;
    const normalized = normalize(payload, eventType);
    const sourceProvider = String(integration.provider).replace("sales_webhook_", "");
    const { data: existing } = await admin.from("sales").select("id").eq("user_id", integration.user_id).eq("source_provider", sourceProvider).eq("source_record_id", recordId).maybeSingle();
    const sale = { user_id: integration.user_id, sale_date: normalized.saleDate, gross_revenue: normalized.gross, net_revenue: normalized.net, tax_amount: 0, refund_amount: normalized.refunded ? normalized.gross : 0, chargeback_amount: normalized.chargeback ? normalized.gross : 0, payment_method: normalized.payment, payment_method_source: "webhook", status: normalized.status, quantity: normalized.quantity, contact_name: normalized.name || null, contact_email: normalized.email || null, contact_phone: normalized.phone || null, rd_product_name: normalized.product || null, source_provider: sourceProvider, source_record_id: recordId, source_closed_at: new Date().toISOString(), notes: `Webhook ${sourceProvider}` };
    const result = existing ? await admin.from("sales").update(sale).eq("id", existing.id) : await admin.from("sales").insert(sale);
    if (result.error) throw result.error;
    await admin.from("sales_webhook_events").update({ processed_at: new Date().toISOString() }).eq("integration_id", integration.id).eq("provider_event_id", recordId);
    return json({ ok: true, sale_status: normalized.status });
  } catch (error) { console.error("sales-webhook", error); return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500); }
});

function normalize(payload: any, eventType: string) {
  const statusText = `${eventType} ${stringValue(valueAt(payload, ["status", "data.status", "order_status", "purchase.status"]))}`.toLowerCase();
  const refunded = /refund|reembols|devolv/.test(statusText); const chargeback = /chargeback|disput/.test(statusText);
  const status = refunded ? "refunded" : chargeback ? "chargeback" : /cancel|recus|fail/.test(statusText) ? "cancelled" : /pending|aguard|boleto/.test(statusText) ? "pending" : "confirmed";
  const gross = numberValue(valueAt(payload, ["amount", "value", "total", "data.amount", "data.total", "data.value", "purchase.price.value", "order.total"]));
  const date = stringValue(valueAt(payload, ["approved_date", "created_at", "date", "data.created_at", "purchase.approved_date"]));
  return { status, refunded, chargeback, gross, net: gross, payment: stringValue(valueAt(payload, ["payment_method", "payment.type", "data.payment_method", "purchase.payment.type"])) || "outros", quantity: Math.max(1, numberValue(valueAt(payload, ["quantity", "data.quantity", "purchase.quantity"]))), saleDate: date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), name: stringValue(valueAt(payload, ["buyer.name", "customer.name", "data.customer.name", "name"])), email: stringValue(valueAt(payload, ["buyer.email", "customer.email", "data.customer.email", "email"])), phone: stringValue(valueAt(payload, ["buyer.phone", "customer.phone", "data.customer.phone", "phone"])), product: stringValue(valueAt(payload, ["product.name", "data.product.name", "purchase.product.name", "product_name"])) };
}
