import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { executeRDWrite, RDWriteError } from "../_shared/rdWrite.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED_FIELDS = new Set(["name", "emails", "phones", "birthday", "facebook", "linkedin", "website", "legal_bases", "contact_custom_fields", "deal_ids"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const normalizeIdentifier = (value: unknown) => String(value || "").trim().toLowerCase().replace(/\s+/g, "");

function contactIdentifier(contact: any) {
  const email = Array.isArray(contact?.emails) ? contact.emails[0]?.email : contact?.email;
  const phone = Array.isArray(contact?.phones) ? contact.phones[0]?.phone || contact.phones[0]?.whatsapp_full_internacional : contact?.phone;
  return { email: normalizeIdentifier(email), phone: normalizeIdentifier(phone).replace(/[^0-9+]/g, "") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);
    const body = await req.json().catch(() => ({}));
    const operation = body?.operation === "update" ? "update" : body?.operation === "create" ? "create" : "";
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    const rdDealId = typeof body?.rd_deal_id === "string" ? body.rd_deal_id : "";
    const suppliedContactId = typeof body?.contact_id === "string" ? body.contact_id : "";
    const fields = body?.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : null;
    const correlationId = typeof body?.correlation_id === "string" && body.correlation_id ? body.correlation_id : crypto.randomUUID();
    if (!operation || !connectionId || !rdDealId || !fields || !Object.keys(fields).length) return json({ error: "operation, rd_connection_id, rd_deal_id e fields são obrigatórios" }, 400);
    const unknown = Object.keys(fields).filter((field) => !ALLOWED_FIELDS.has(field));
    if (unknown.length) return json({ error: `Campos de contato não permitidos: ${unknown.join(", ")}`, code: "RD_CONTACT_FIELD_NOT_ALLOWED" }, 422);
    if ("name" in fields && typeof fields.name !== "string") return json({ error: "name deve ser texto" }, 422);
    if ("emails" in fields && !Array.isArray(fields.emails)) return json({ error: "emails deve ser uma lista" }, 422);
    if ("phones" in fields && !Array.isArray(fields.phones)) return json({ error: "phones deve ser uma lista" }, 422);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: deal, error: dealError } = await admin.from("rd_deals").select("id,rd_connection_id,rd_deal_id,raw,contact_name,contact_email,contact_phone").eq("rd_connection_id", connectionId).eq("rd_deal_id", rdDealId).maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);
    const raw = deal.raw && typeof deal.raw === "object" ? deal.raw as Record<string, any> : {};
    const contacts = Array.isArray(raw._contacts) ? raw._contacts : Array.isArray(raw.contacts) ? raw.contacts : [];
    const current = contacts[0] || {};
    const requested = contactIdentifier({ emails: fields.emails, phones: fields.phones });
    const currentId = suppliedContactId || current.id || current._id || "";
    const matching = contacts.find((contact: any) => {
      const identifier = contactIdentifier(contact);
      return (requested.email && requested.email === identifier.email) || (requested.phone && requested.phone === identifier.phone);
    });
    if (operation === "create" && matching) return json({ ok: true, noop: true, reason: "Contato já vinculado à negociação", contact_id: matching.id || matching._id || null, deal_id: deal.id });
    if (operation === "update" && !currentId) return json({ error: "Nenhum contato sincronizado foi encontrado para atualizar" }, 422);
    const providerFields = { ...fields } as Record<string, unknown>;
    if (operation === "create") providerFields.deal_ids = Array.from(new Set([...(Array.isArray(fields.deal_ids) ? fields.deal_ids : []), rdDealId]));
    const before = { ...current };
    const after = { ...current, ...providerFields };
    const result = await executeRDWrite({
      admin,
      userId,
      connectionId,
      action: operation === "create" ? "create_contact" : "update_contact",
      target: { rd_deal_id: rdDealId, rd_contact_id: currentId || null },
      before,
      after,
      correlationId,
      method: operation === "create" ? "POST" : "PUT",
      path: operation === "create" ? "/contacts" : `/contacts/${encodeURIComponent(currentId)}`,
      body: { contact: providerFields },
    });
    const providerContact = result.providerBody && typeof result.providerBody === "object" ? result.providerBody as Record<string, any> : {};
    const providerId = providerContact.id || providerContact._id || providerContact.contact?.id || providerContact.contact?._id || currentId;
    const nextContact = { ...after, id: providerId || undefined, _id: providerId || undefined };
    const nextContacts = contacts.length ? [nextContact, ...contacts.slice(1)] : [nextContact];
    const nextRaw = { ...raw, _contacts: nextContacts };
    const email = Array.isArray(providerFields.emails) ? (providerFields.emails[0] as any)?.email || null : deal.contact_email;
    const phone = Array.isArray(providerFields.phones) ? (providerFields.phones[0] as any)?.phone || (providerFields.phones[0] as any)?.whatsapp_full_internacional || null : deal.contact_phone;
    const { error: mirrorError } = await admin.from("rd_deals").update({ raw: nextRaw, contact_name: typeof providerFields.name === "string" ? providerFields.name : deal.contact_name, contact_email: email, contact_phone: phone, updated_at: new Date().toISOString() }).eq("id", deal.id).eq("rd_connection_id", connectionId);
    if (mirrorError) return json({ ok: true, partial: true, audit_id: result.auditId, error: "O contato foi alterado no RD, mas o espelho local aguarda reconciliação." }, 202);
    return json({ ok: true, audit_id: result.auditId, skipped: result.skipped, deal_id: deal.id, contact_id: providerId || null });
  } catch (error) {
    if (error instanceof RDWriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("rd-contact-write", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
