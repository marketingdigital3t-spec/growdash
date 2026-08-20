import { useEffect, useState } from "react";
import { Copy, Link2, RefreshCw, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const platforms = [
  ["hotmart", "Hotmart"], ["kiwify", "Kiwify"], ["cakto", "Cakto"], ["herospark", "HeroSpark"], ["themembers", "TheMembers"], ["generic", "Outra plataforma"],
] as const;

const providerInstructions: Record<(typeof platforms)[number][0], string> = {
  hotmart: "Na Hotmart, crie um webhook de transação e cole a URL completa abaixo.",
  kiwify: "Na Kiwify, abra as configurações de webhook e cole a URL completa abaixo.",
  cakto: "Na Cakto, crie um webhook de vendas e cole a URL completa abaixo.",
  herospark: "Na HeroSpark, adicione a URL no webhook do produto ou checkout.",
  themembers: "Na TheMembers, cadastre a URL no webhook do produto ou da oferta.",
  generic: "Na sua plataforma, configure um webhook POST e cole a URL completa abaixo.",
};

type Connection = { endpoint: string; secret?: string; header: string; active?: boolean; updated_at?: string };

export function SalesWebhookGatewayCard() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<(typeof platforms)[number][0]>("hotmart");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.functions.invoke("sales-webhook-config", { body: { action: "list", provider } });
      if (!active || error || data?.error) return;
      setConnection(data.connection ?? null);
    };
    void load();
    return () => { active = false; };
  }, [provider]);
  const create = async () => {
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sales-webhook-config", { body: { action: "create", provider } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Não foi possível criar o webhook.");
      setConnection(data.connection);
      toast({ title: "Webhook criado", description: "Copie a URL e o segredo para a plataforma de vendas." });
    } catch (error) { toast({ title: "Falha ao criar webhook", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setPending(false); }
  };
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast({ title: `${label} copiado` }); };
  return <details className="gd-panel overflow-hidden" open>
    <summary className="flex cursor-pointer list-none flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Webhook className="h-5 w-5" /></span><div className="grow"><h2 className="font-black">Webhooks de vendas</h2><p className="text-xs text-muted-foreground">Receba vendas, reembolsos e chargebacks em tempo real sem duplicar faturamento.</p></div><span className="text-xs font-semibold text-primary">Mostrar / recolher</span></summary>
    <div className="space-y-4 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="text-sm font-semibold" htmlFor="sales-webhook-provider">Plataforma</label><select id="sales-webhook-provider" value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)} className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:min-w-56">{platforms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><Button className="sm:ml-auto" onClick={create} disabled={pending}>{pending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}{connection ? "Gerar nova URL segura" : "Gerar webhook"}</Button></div>
      <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground"><b className="text-foreground">Como conectar:</b> {providerInstructions[provider]} Selecione os eventos de compra aprovada, reembolso e chargeback e informe o cabeçalho secreto abaixo. O segredo não é enviado na URL, evitando vazamento em logs.</div>
      {connection && <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/[.04] p-4 text-xs"><p className="font-semibold">1. Copie a URL. 2. Cadastre o cabeçalho secreto. 3. Salve e envie um evento de teste pela própria plataforma.</p><CopyValue label="URL do webhook" value={connection.endpoint} onCopy={copy} /><CopyValue label={`Cabeçalho ${connection.header}`} value={connection.secret || "Segredo mantido; gere uma nova conexão para visualizá-lo."} onCopy={copy} /><p className="text-muted-foreground">O segredo é exibido apenas quando criado ou rotacionado. Guarde-o em local seguro.</p></div>}
    </div>
  </details>;
}
function CopyValue({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string, label: string) => void }) { return <div><span className="font-semibold">{label}</span><div className="mt-1 flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-background/70 p-2 text-[11px]">{value}</code><Button type="button" size="icon" variant="outline" onClick={() => onCopy(value, label)} aria-label={`Copiar ${label}`}><Copy className="h-3.5 w-3.5" /></Button></div></div>; }
