import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function matches(field: string, value: number, minimum: number, maximum: number) {
  return field.split(",").some((part) => {
    const [base, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    const candidate = base === "*" ? `${minimum}-${maximum}` : base;
    const [startText, endText] = candidate.split("-");
    const start = startText === "*" ? minimum : Number(startText);
    const end = endText === undefined ? start : Number(endText);
    return Number.isInteger(start) && Number.isInteger(end) && value >= start && value <= end && (value - start) % step === 0;
  });
}

function nextOccurrence(expression: string, timezone: string, from: Date) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("A expressão cron precisa de cinco campos.");
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, minute: "2-digit", hour: "2-digit", day: "2-digit", month: "2-digit", weekday: "short", hourCycle: "h23" });
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (let minute = 1; minute <= 366 * 24 * 60; minute += 1) {
    const candidate = new Date(from.getTime() + minute * 60_000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
    const month = Number(parts.month); const day = Number(parts.day); const hour = Number(parts.hour); const minuteValue = Number(parts.minute); const weekday = weekdayMap[parts.weekday];
    const dayMatches = matches(fields[2], day, 1, 31) && matches(fields[4], weekday, 0, 6);
    if (matches(fields[0], minuteValue, 0, 59) && matches(fields[1], hour, 0, 23) && dayMatches && matches(fields[3], month, 1, 12)) return candidate.toISOString();
  }
  throw new Error("Não foi possível calcular a próxima execução do agendamento.");
}

async function validCron(req: Request) {
  const supplied = req.headers.get("x-cron-secret") || "";
  const configured = Deno.env.get("WORKFLOW_SCHEDULER_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  if (configured && supplied === configured) return true;
  const { data } = await admin.schema("private").from("daily_incremental_sync_config").select("cron_secret").eq("singleton", true).maybeSingle();
  return Boolean(data?.cron_secret && supplied === data.cron_secret);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!(await validCron(req))) return json({ error: "Não autorizado" }, 401);
  const now = new Date();
  const { data: schedules, error } = await admin.from("growdash_workflow_schedules").select("id,workflow_id,workspace_id,cron_expression,timezone,next_run_at").eq("status", "active").or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`).order("next_run_at", { ascending: true, nullsFirst: true }).limit(50);
  if (error) return json({ error: error.message }, 500);
  const results: Array<Record<string, unknown>> = [];
  for (const schedule of schedules || []) {
    try {
      const nextRunAt = nextOccurrence(schedule.cron_expression, schedule.timezone || "America/Sao_Paulo", now);
      const { error: claimError } = await admin.from("growdash_workflow_schedules").update({ next_run_at: nextRunAt, last_run_at: now.toISOString() }).eq("id", schedule.id).eq("status", "active");
      if (claimError) throw claimError;
      const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "";
      if (internalSecret.length < 24) throw new Error("AUTOMATION_INTERNAL_SECRET não configurado");
      const response = await fetch(`${url}/functions/v1/workflow-execute`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ workflow_id: schedule.workflow_id, mode: "schedule", input: { source: "schedule", scheduled_at: now.toISOString(), schedule_id: schedule.id }, idempotency_key: `schedule:${schedule.id}:${now.toISOString().slice(0, 16)}` }) });
      const payload = await response.json().catch(() => ({}));
      results.push({ workflow_id: schedule.workflow_id, status: response.ok ? payload.status || "success" : "error", next_run_at: nextRunAt });
    } catch (scheduleError) {
      await admin.from("growdash_workflow_schedules").update({ status: "error" }).eq("id", schedule.id);
      results.push({ workflow_id: schedule.workflow_id, status: "error", error: scheduleError instanceof Error ? scheduleError.message : "Falha no agendamento" });
    }
  }
  return json({ ok: results.every((item) => item.status !== "error"), processed: results.length, results });
});
