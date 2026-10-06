import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const norm = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const rawClassId = (raw: Record<string, unknown>) => String(raw.turma_id || raw.id_turma || raw.class_id || "").trim() || null;
const cents = (value: unknown) => {
  const raw = String(value ?? "").replace(/[^0-9,.-]/g, "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};
const dateValue = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const hashRow = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)))), (byte) => byte.toString(16).padStart(2, "0")).join("");
const mapped = (raw: Record<string, unknown>, mapping: Record<string, unknown>, field: string, aliases: string[] = []) => {
  const configured = mapping[field];
  if (typeof configured === "string" && configured.trim()) return raw[norm(configured)] ?? "";
  for (const alias of aliases) if (raw[norm(alias)] !== undefined) return raw[norm(alias)];
  return "";
};
const boolValue = (value: unknown) => /^(1|true|sim|yes|ok|assinado|confirmado)$/i.test(String(value ?? "").trim());
const integerValue = (value: unknown) => { const match = String(value ?? "").match(/\d+/); return match ? Number(match[0]) : null; };

async function freshToken(admin: ReturnType<typeof createClient>, integration: any) {
  const saved = JSON.parse(String(integration.api_token || "{}"));
  if (integration.token_expires_at && new Date(integration.token_expires_at).getTime() > Date.now() + 60_000) return saved.access_token;
  if (!saved.refresh_token) throw new Error("A autorização Google expirou. Conecte a conta novamente.");
  const body = new URLSearchParams({ client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "", client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "", refresh_token: saved.refresh_token, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const next = await response.json().catch(() => ({}));
  if (!response.ok || !next.access_token) throw new Error("O Google recusou a renovação da autorização.");
  saved.access_token = next.access_token;
  await admin.from("integrations").update({ api_token: JSON.stringify(saved), token_expires_at: new Date(Date.now() + Number(next.expires_in ?? 3600) * 1000).toISOString() }).eq("id", integration.id);
  return saved.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const base = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(base, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const admin = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const input = await req.json().catch(() => ({}));
    const connectionId = String(input.connection_id || "");
    if (!connectionId) return json({ error: "Informe a conexão da planilha." }, 400);
    const { data: connection, error: connectionError } = await admin.from("expert_sheet_connections").select("*").eq("id", connectionId).maybeSingle();
    if (connectionError || !connection) return json({ error: "Conexão de planilha não encontrada." }, 404);
    const { data: expert } = await admin.from("experts").select("id,workspace_id,nome").eq("id", connection.expert_id).maybeSingle();
    const { data: membership } = await admin.from("workspace_members").select("id").eq("workspace_id", expert?.workspace_id).eq("user_id", user.id).maybeSingle();
    if (!membership && expert?.workspace_id) return json({ error: "Sem permissão para este expert." }, 403);
    const { data: integration } = await admin.from("integrations").select("id,api_token,token_expires_at").eq("user_id", user.id).eq("provider", "google_workspace").eq("is_active", true).maybeSingle();
    if (!integration) return json({ error: "Conecte uma conta Google antes de sincronizar a planilha." }, 409);
    const token = await freshToken(admin, integration);
    const run = await admin.from("expert_sales_sync_runs").insert({ expert_id: connection.expert_id, sheet_connection_id: connection.id, status: "partial" }).select("id").single();
    const runId = run.data?.id;
    await admin.from("expert_sheet_connections").update({ status: "syncing", last_error: null, updated_at: new Date().toISOString() }).eq("id", connection.id);
    const range = encodeURIComponent(`${connection.worksheet_name}!A:ZZ`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(connection.spreadsheet_id)}/values/${range}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível ler a planilha Google Sheets.");
    const values = Array.isArray(payload.values) ? payload.values : [];
    if (!values.length) throw new Error("A aba da planilha está vazia.");
    const headers = values[0].map(norm);
    const rows = values.slice(1).filter((row: unknown[]) => row.some((cell) => String(cell ?? "").trim()));
    const { data: classes } = await admin.from("event_classes").select("id,title,expert_name,expert_id");
    const expertName = norm(expert?.nome);
    const classRows = (classes || []).filter((item: any) => item.expert_id === connection.expert_id || (Boolean(expertName) && norm(item.expert_name) === expertName));
    const classById = new Map(classRows.map((item: any) => [String(item.id), item]));
    const classByName = new Map<string, any[]>();
    for (const item of classRows) {
      const key = norm(item.title);
      if (!key) continue;
      classByName.set(key, [...(classByName.get(key) || []), item]);
    }
    const mapping = connection.column_mapping && typeof connection.column_mapping === "object" ? connection.column_mapping : {};
    let upserted = 0;
    const seenKeys: string[] = [];
    const syncErrors: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] as unknown[];
      const raw = Object.fromEntries(headers.map((header, column) => [header || `coluna_${column + 1}`, row[column] ?? ""]));
      const name = String(mapped(raw, mapping, "name", ["nome", "aluna", "aluno", "paciente"])).trim();
      if (!name) continue;
      const cpf = String(mapped(raw, mapping, "cpf", ["cpf", "cpf_aluna"])).replace(/\D/g, "") || null;
      const phone = String(mapped(raw, mapping, "phone", ["telefone", "celular", "whatsapp"])).trim() || null;
      const saleDate = dateValue(mapped(raw, mapping, "sale_date", ["data_pgto", "data_pagamento", "data_venda", "data"]));
      const classDate = dateValue(mapped(raw, mapping, "class_date", ["data_turma_presencial", "data_turma"]));
      const sourceClassId = String(mapped(raw, mapping, "turma_id", ["turma_id", "id_turma", "class_id"]) || input.source_class_id || "").trim() || null;
      const className = String(mapped(raw, mapping, "class_name", ["turma", "nome_da_turma"])).trim() || null;
      const direct = sourceClassId ? classById.get(sourceClassId) : null;
      const named = className ? classByName.get(norm(className)) || [] : [];
      const matchedClass = direct || (named.length === 1 ? named[0] : null);
      const classMatchStatus = matchedClass ? "matched" : (named.length > 1 ? "ambiguous" : "unmatched");
      if (!matchedClass && (sourceClassId || className)) syncErrors.push(`Linha ${index + 2}: turma ${className || sourceClassId} não foi vinculada (${classMatchStatus}).`);
      const sourceRowKey = cpf || `${norm(name)}|${sourceClassId || norm(className || "")}|${saleDate || ""}`;
      const rowHash = await hashRow(raw);
      seenKeys.push(sourceRowKey);
      const { error } = await admin.from("expert_sales").upsert({ expert_id: connection.expert_id, sheet_connection_id: connection.id, participant_type: connection.source_type === "sales" ? "student" : connection.participant_type, source_row_hash: rowHash, source_row_key: sourceRowKey, source_row_number: index + 2, name, cpf, phone, sale_date: saleDate, paid_at: saleDate, class_date: classDate, source_class_id: sourceClassId, event_class_id: matchedClass?.id || null, class_name: className, class_match_status: classMatchStatus, gross_amount_cents: cents(mapped(raw, mapping, "gross_amount", ["valor_bruto", "valor_da_venda", "valor", "valor_total"])), cash_received_cents: cents(mapped(raw, mapping, "cash_received", ["valor_recebido", "caixa_real_entrada", "caixa_real", "valor_pago", "pago"])), future_revenue_cents: cents(mapped(raw, mapping, "future_revenue", ["faturamento_futuro", "faturamento_futuro_e_estorno"])), installment_number: integerValue(mapped(raw, mapping, "installment_number", ["parcela", "parcelas"])), installment_condition: String(mapped(raw, mapping, "installment_condition", ["condicao", "condição"])).trim() || null, reconciliation_status: String(mapped(raw, mapping, "reconciliation_status", ["conciliacao_financeira", "conciliação_financeira"])).trim() || null, product: String(mapped(raw, mapping, "product", ["produto"])).trim() || null, contract_signed: boolValue(mapped(raw, mapping, "contract_signed", ["contrato_assinado"])), status: String(mapped(raw, mapping, "status", ["status"] ) || "confirmed").trim() || "confirmed", seller_name: String(mapped(raw, mapping, "seller_name", ["vendedor", "responsavel"])).trim() || null, payment_method: String(mapped(raw, mapping, "payment_method", ["forma_pagamento", "pagamento", "cartao_pix_boleto"])).trim() || null, utm_campaign: String(mapped(raw, mapping, "utm_campaign", ["utm_campaign", "campanha"])).trim() || null, utm_content: String(mapped(raw, mapping, "utm_content", ["utm_content", "criativo"])).trim() || null, notes: String(mapped(raw, mapping, "notes", ["observacoes", "obs"])).trim() || null, source_active: true, last_seen_at: new Date().toISOString(), raw_row: raw, source_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "sheet_connection_id,source_row_key" });
      if (error) throw error;
      upserted += 1;
    }
    if (seenKeys.length) await admin.from("expert_sales").update({ source_active: false }).eq("sheet_connection_id", connection.id).not("source_row_key", "in", `(${seenKeys.map((key) => `"${key.replaceAll('"', '""')}"`).join(",")})`);
    const finished = new Date().toISOString();
    const finalStatus = syncErrors.length ? "partial" : "success";
    await admin.from("expert_sheet_connections").update({ status: "fresh", last_sync_at: finished, last_valid_snapshot_at: finished, last_error: syncErrors.length ? syncErrors.slice(0, 20).join(" ") : null, last_header_signature: await hashRow(headers), updated_at: finished }).eq("id", connection.id);
    await admin.from("expert_sales_sync_runs").update({ status: finalStatus, rows_read: rows.length, rows_upserted: upserted, errors: syncErrors, finished_at: finished }).eq("id", runId);
    return json({ success: true, status: finalStatus, rows_read: rows.length, rows_upserted: upserted, errors: syncErrors, synced_at: finished });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar planilha.";
    return json({ success: false, status: "error", error: message }, 500);
  }
});
