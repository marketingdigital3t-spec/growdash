import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, MessageCircle, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildMetaConversationTrackingLink, buildMetaConversationTrackingPreview, META_UTM_TEMPLATE } from "@/lib/metaConversationTrackingLink";

export function UTMConventionCard() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [greeting, setGreeting] = useState("Olá! Quero mais informações.");
  const trackingLink = useMemo(() => buildMetaConversationTrackingLink(phone, greeting), [greeting, phone]);
  const messagePreview = useMemo(() => buildMetaConversationTrackingPreview(greeting), [greeting]);
  const copy = () => {
    navigator.clipboard.writeText(META_UTM_TEMPLATE);
    toast({ title: "UTM padrão copiada!" });
  };
  const copyTrackingLink = () => {
    if (!trackingLink) return;
    navigator.clipboard.writeText(trackingLink);
    toast({ title: "Link de conversa copiado!", description: "A campanha, conjunto e anúncio seguirão no texto inicial do WhatsApp." });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Padrão de UTMs</CardTitle>
        <CardDescription>
          Cole esta string no campo <strong>"Parâmetros de URL"</strong> de TODAS as suas campanhas Meta. Ela é o que permite a conciliação automática venda↔anúncio (Custo por Venda, atribuição, drill-down).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{META_UTM_TEMPLATE}</pre>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="h-4 w-4 mr-2" /> Copiar UTM padrão
        </Button>
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Onde colar no Meta:</strong> Gerenciador de Anúncios → editar Anúncio → seção "URL do site" → "Parâmetros de URL".</p>
          <p><strong>O que cada campo faz:</strong></p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><code>utm_source=meta</code> — identifica a plataforma</li>
            <li><code>utm_campaign / term / content</code> — casamento textual com nome da campanha/conjunto/anúncio</li>
            <li><code>utm_id={'{{ad.id}}'}</code> — ID nativo do anúncio (match exato e mais confiável)</li>
          </ul>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /><b className="text-sm">Link padrão para conversa no WhatsApp</b></div>
          <p className="text-xs text-muted-foreground">Use um único link nos anúncios que abrem o WhatsApp. A mensagem inicial leva os identificadores dinâmicos da Meta para o atendimento, RD ou automação — sem depender do nome manual da campanha.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold">WhatsApp com DDI<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" inputMode="tel" placeholder="5561999990000" /></label>
            <label className="text-xs font-semibold">Mensagem inicial<input value={greeting} onChange={(event) => setGreeting(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" placeholder="Olá! Quero mais informações." /></label>
          </div>
          {trackingLink ? <><pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{trackingLink}</pre><Button type="button" variant="outline" size="sm" onClick={copyTrackingLink}><Copy className="mr-2 h-4 w-4" />Copiar link de conversa</Button></> : <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Informe o WhatsApp com DDI para gerar o link.</p>}
          <details className="rounded-md border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Prévia do marcador enviado na conversa</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{messagePreview}</pre></details>
          <p className="text-[11px] leading-relaxed text-muted-foreground"><b className="text-foreground">Importante:</b> o link preserva a atribuição na mensagem recebida. A métrica de <i>conversa iniciada</i> na Growdash continua sendo validada pelo evento oficial da Meta, por campanha/conjunto/anúncio; abrir o WhatsApp sem enviar mensagem não conta como conversa iniciada.</p>
        </div>
      </CardContent>
    </Card>
  );
}
