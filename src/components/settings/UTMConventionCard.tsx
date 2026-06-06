import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UTM_STRING = "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{ad.id}}";

export function UTMConventionCard() {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(UTM_STRING);
    toast({ title: "UTM padrão copiada!" });
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
        <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{UTM_STRING}</pre>
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
      </CardContent>
    </Card>
  );
}
