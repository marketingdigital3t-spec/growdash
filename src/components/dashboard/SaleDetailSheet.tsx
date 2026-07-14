import { useState } from "react";
import { parseISO, format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { useUpdateSale, type Sale } from "@/hooks/useSales";
import { EditableIfEmpty } from "@/components/EditableIfEmpty";
import { ManualAttributionDialog } from "@/components/dashboard/ManualAttributionDialog";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return "—"; }
};

const PAYMENTS = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "outros", label: "Outros" },
];

const PLATFORMS = [
  { value: "__auto", label: "Automático" },
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "organic:link_bio", label: "Orgânico · Link Bio" },
  { value: "organic:stories", label: "Orgânico · Stories" },
  { value: "organic:dm", label: "Orgânico · Direct/DM" },
  { value: "organic:comentario", label: "Orgânico · Comentário" },
  { value: "organic:outros", label: "Orgânico · Outros" },
];

interface Props {
  sale: Sale | null;
  onClose: () => void;
}

export function SaleDetailSheet({ sale, onClose }: Props) {
  return (
    <Sheet open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {sale && <SaleDetail sale={sale} />}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value || "—"}</span>
    </div>
  );
}

function SaleDetail({ sale }: { sale: Sale }) {
  const update = useUpdateSale();
  const [attrOpen, setAttrOpen] = useState(false);
  const save = (field: keyof Sale) => async (v: string) => {
    await update.mutateAsync({ id: sale.id, [field]: v } as any);
  };
  const hasManual = (sale as any).manual_override;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{sale.contact_name || "Lead"}</SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-5">
        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Negociação</h4>
          <Row label="Valor bruto" value={fmtMoney(sale.gross_revenue)} />
          <Row label="Valor líquido" value={fmtMoney(sale.net_revenue)} />
          <Row label="Data de entrada" value={fmtDate(sale.lead_entry_date)} />
          <Row label="Data de fechamento" value={fmtDate(sale.sale_date)} />
          <Row label="Produto" value={sale.rd_product_name} />
          <div className="flex justify-between items-center gap-4 py-2 border-b">
            <span className="text-xs text-muted-foreground">Forma de pagamento</span>
            <Select
              value={sale.payment_method}
              onValueChange={(v) => update.mutate({ id: sale.id, payment_method: v })}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Localização</h4>
          <Row label="Estado" value={<EditableIfEmpty value={sale.lead_state} onSave={save("lead_state")} type="uf" />} />
          <Row label="Cidade" value={<EditableIfEmpty value={sale.lead_city} onSave={save("lead_city")} placeholder="Adicionar cidade" />} />
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Origem</h4>
          <div className="flex justify-between items-center gap-4 py-2 border-b">
            <span className="text-xs text-muted-foreground">Plataforma (manual)</span>
            <Select
              value={sale.manual_platform ?? "__auto"}
              onValueChange={(v) => update.mutate({ id: sale.id, manual_platform: v === "__auto" ? null : v })}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Row label="Campanha (RD)" value={sale.rd_campaign_name} />
          <Row label="utm_source"   value={<EditableIfEmpty value={sale.utm_source}   onSave={save("utm_source")} />} />
          <Row label="utm_medium"   value={<EditableIfEmpty value={sale.utm_medium}   onSave={save("utm_medium")} />} />
          <Row label="utm_campaign" value={<EditableIfEmpty value={sale.utm_campaign} onSave={save("utm_campaign")} />} />
          <Row label="utm_term"     value={<EditableIfEmpty value={sale.utm_term}     onSave={save("utm_term")} />} />
          <Row label="utm_content"  value={<EditableIfEmpty value={sale.utm_content}  onSave={save("utm_content")} />} />

          <div className="flex justify-between items-center gap-4 py-3 mt-2 border-t">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">Atribuição</span>
              {hasManual && <Badge variant="secondary" className="text-[10px]">Manual</Badge>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setAttrOpen(true)}>
              {hasManual ? "Editar" : "Atribuir manualmente"}
            </Button>
          </div>
        </div>

        {sale.notes && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Observações</h4>
            <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}
      </div>

      <ManualAttributionDialog sale={sale} open={attrOpen} onClose={() => setAttrOpen(false)} />
    </>
  );
}
