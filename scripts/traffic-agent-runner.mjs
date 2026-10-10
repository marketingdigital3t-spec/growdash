import { chromium } from "@playwright/test";
import os from "node:os";

const apiUrl = process.env.SUPABASE_URL;
const accessToken = process.env.TRAFFIC_AGENT_ACCESS_TOKEN;
const profileDir = process.env.TRAFFIC_AGENT_PROFILE || new URL("../work/traffic-agent-profile", import.meta.url).pathname;
const metaUrl = process.env.TRAFFIC_AGENT_META_URL || "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
const morning = process.env.TRAFFIC_AGENT_MORNING || "08:00";
const afternoon = process.env.TRAFFIC_AGENT_AFTERNOON || "14:00";
const intervalMs = 60_000;

if (!apiUrl || !accessToken) {
  console.error("Defina SUPABASE_URL e TRAFFIC_AGENT_ACCESS_TOKEN antes de iniciar o runner.");
  process.exitCode = 1;
  process.exit();
}

const browser = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: { width: 1440, height: 1000 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = browser.pages()[0] || await browser.newPage();
await page.goto(metaUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);

async function heartbeat(status = "online", error = null) {
  await fetch(`${apiUrl}/functions/v1/traffic-agent-heartbeat`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, browser_status: page.url().includes("facebook") ? "connected" : "error", computer_name: os.hostname(), last_error: error }) }).catch(() => undefined);
}

async function analyze(trigger = "scheduled") {
  await heartbeat("analyzing");
  const response = await fetch(`${apiUrl}/functions/v1/traffic-agent-analyze`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ trigger }) });
  if (!response.ok) throw new Error(`Análise HTTP ${response.status}`);
  return response.json();
}

async function executeApproved() {
  await fetch(`${apiUrl}/functions/v1/traffic-agent-execute-approved`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => undefined);
}

function brazilTime() { return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); }
function due(now, target) { return now === target; }

let lastScheduled = "";
await heartbeat();
setInterval(async () => {
  const now = brazilTime();
  const key = `${new Date().toISOString().slice(0, 10)}:${now}`;
  try {
    if ((due(now, morning) || due(now, afternoon)) && key !== lastScheduled) {
      lastScheduled = key;
      await analyze("scheduled");
    } else {
      await executeApproved();
      await heartbeat();
    }
  } catch (error) {
    await heartbeat("error", error instanceof Error ? error.message : "RUNNER_ERROR");
  }
}, intervalMs);

console.log(`Traffic Agent online em ${os.hostname()}. Análises: ${morning} e ${afternoon}.`);
