import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EndpointResponse = {
  configured?: boolean;
  endpoint_url?: string;
  secret?: string | null;
  secret_hint?: string;
  one_time_secret?: boolean;
  received_count?: number;
  last_received_at?: string | null;
  message?: string;
};

async function functionError(error: unknown) {
  const response = (error as { context?: Response } | null)?.context;
  if (response?.clone) {
    try {
      const payload = await response.clone().json() as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      // Keep the generic message when the gateway returns a non-JSON body.
    }
  }
  return error instanceof Error ? error.message : "Não foi possível configurar o endpoint.";
}

export function CRMLeadWebhookCard() {
  const { data: workspace } = useWorkspace();
  const [endpoint, setEndpoint] = useState<EndpointResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const configure = async (rotate = false) => {
    if (!workspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("crm-lead-webhook-config", { body: { workspace_id: workspace.id, rotate } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setEndpoint(data as EndpointResponse);
    } catch (cause) {
      setError(await functionError(cause));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? null : current), 1600);
  };

  return <section className="gd-panel overflow-hidden">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Webhook className="h-5 w-5" /></span><div><h2 className="font-black">CRM próprio · entrada de leads</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Receba leads do site, formulários, Meta, Google, TikTok ou qualquer CRM via webhook. UTMs, identificadores de clique e payload original são preservados por workspace.</p></div></div>
      <Button onClick={() => void configure(false)} disabled={loading || !workspace?.id}>{loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}{endpoint?.endpoint_url ? "Verificar endpoint" : "Gerar endpoint"}</Button>
    </header>
    <div className="space-y-4 p-5">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>O endpoint usa segredo rotativo, idempotência por evento e limite de payload. Nunca coloque o segredo em código público ou parâmetros da URL.</span></div>
      {endpoint?.endpoint_url && <div className="grid gap-3">
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">URL do endpoint<div className="flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs normal-case text-foreground">{endpoint.endpoint_url}</code><Button variant="outline" size="icon" aria-label="Copiar URL do endpoint" onClick={() => void copy(endpoint.endpoint_url!, "url")}><>{copied === "url" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</></Button></div></label>
        {endpoint.secret ? <label className="grid gap-1 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Segredo exibido uma única vez<div className="flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs normal-case text-foreground">{endpoint.secret}</code><Button variant="outline" size="icon" aria-label="Copiar segredo do endpoint" onClick={() => void copy(endpoint.secret!, "secret")}><>{copied === "secret" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</></Button></div></label> : <p className="text-xs text-muted-foreground">Segredo atual: <b className="text-foreground">{endpoint.secret_hint || "não exibido"}</b>. Para trocar, gere uma nova credencial; o segredo anterior será revogado.</p>}
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" onClick={() => void configure(true)} disabled={loading}><RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />Rotacionar segredo</Button>{endpoint.received_count != null && <span className="text-[11px] text-muted-foreground">{endpoint.received_count} lead(s) recebido(s){endpoint.last_received_at ? ` · último ${new Date(endpoint.last_received_at).toLocaleString("pt-BR")}` : ""}</span>}</div>
      </div>}
      {endpoint?.message && <p className="text-xs text-muted-foreground">{endpoint.message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">Campos reconhecidos: <code>email</code>, <code>phone</code>, <code>name</code>, <code>status</code>, <code>utm_*</code>, <code>fbclid</code>, <code>gclid</code>, <code>ttclid</code>, IDs Meta e payload original.</p>
    </div>
  </section>;
}
