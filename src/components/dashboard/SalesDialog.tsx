import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useProducts } from "@/hooks/useProducts";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAdsets } from "@/hooks/useAdsets";
import { useAds } from "@/hooks/useAds";
import { useCreateSale, useUpdateSale, Sale } from "@/hooks/useSales";
import { toast } from "sonner";
import { format } from "date-fns";

interface SalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSale?: Sale | null;
}

const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const FORMATIONS = [
  { value: "biomedicina", label: "Biomedicina" },
  { value: "medicina", label: "Medicina" },
  { value: "odontologia", label: "Odontologia" },
  { value: "enfermagem", label: "Enfermagem" },
  { value: "esteticista", label: "Esteticista" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "outro", label: "Outro" },
];

export function SalesDialog({ open, onOpenChange, editingSale }: SalesDialogProps) {
  const { data: products = [] } = useProducts();
  const { data: adAccounts = [] } = useAdAccounts();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();

  const [productId, setProductId] = useState<string>("none");
  const [quantity, setQuantity] = useState(1);
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [status, setStatus] = useState("confirmed");
  const [refundAmount, setRefundAmount] = useState(0);
  const [chargebackAmount, setChargebackAmount] = useState(0);
  const [adAccountId, setAdAccountId] = useState("none");
  const [selectedCampaignId, setSelectedCampaignId] = useState("none");
  const [selectedAdsetId, setSelectedAdsetId] = useState("none");
  const [selectedAdId, setSelectedAdId] = useState("none");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [leadState, setLeadState] = useState("none");
  const [leadFormation, setLeadFormation] = useState("none");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [leadCity, setLeadCity] = useState("");

  const { data: campaigns = [] } = useCampaigns(adAccountId === "none" ? undefined : adAccountId);
  const { data: adsets = [] } = useAdsets(selectedCampaignId === "none" ? undefined : selectedCampaignId);
  const { data: ads = [] } = useAds(selectedAdsetId === "none" ? undefined : selectedAdsetId);

  const selectedProduct = products.find((p) => p.id === productId);

  // Fill form when editing
  useEffect(() => {
    if (editingSale) {
      setProductId(editingSale.product_id || "none");
      // For RD sales, show rd_product_name as fallback display but keep product_id for the select
      setGrossRevenue(editingSale.gross_revenue);
      setTaxAmount(editingSale.tax_amount);
      setPaymentMethod(editingSale.payment_method);
      setStatus(editingSale.status);
      setRefundAmount(editingSale.refund_amount);
      setChargebackAmount(editingSale.chargeback_amount);
      setAdAccountId(editingSale.ad_account_id || "none");
      setSelectedCampaignId(editingSale.campaign_ids?.[0] || "none");
      setSelectedAdsetId(editingSale.adset_id || "none");
      setSelectedAdId(editingSale.ad_id || "none");
      setSaleDate(editingSale.sale_date);
      setNotes(editingSale.notes || "");
      setLeadState(editingSale.lead_state || "none");
      setLeadFormation(editingSale.lead_formation || "none");
      setContactName(editingSale.contact_name || "");
      setContactPhone(editingSale.contact_phone || "");
      setLeadCity(editingSale.lead_city || "");
    } else {
      resetForm();
    }
  }, [editingSale, open]);

  useEffect(() => {
    if (selectedProduct && !editingSale) {
      setGrossRevenue(selectedProduct.price * quantity);
      setTaxAmount(selectedProduct.price * quantity * (selectedProduct.tax_rate / 100));
    }
  }, [selectedProduct, quantity, editingSale]);

  // Reset cascade when parent changes
  useEffect(() => {
    if (!editingSale) {
      setSelectedCampaignId("none");
      setSelectedAdsetId("none");
      setSelectedAdId("none");
    }
  }, [adAccountId, editingSale]);

  useEffect(() => {
    if (!editingSale) {
      setSelectedAdsetId("none");
      setSelectedAdId("none");
    }
  }, [selectedCampaignId, editingSale]);

  useEffect(() => {
    if (!editingSale) {
      setSelectedAdId("none");
    }
  }, [selectedAdsetId, editingSale]);

  const netRevenue = grossRevenue - taxAmount;

  const handleSubmit = async () => {
    const campaignIds = selectedCampaignId !== "none" ? [selectedCampaignId] : [];
    const payload = {
      product_id: productId === "none" ? null : productId,
      ad_account_id: adAccountId === "none" ? null : adAccountId,
      campaign_ids: campaignIds,
      adset_id: selectedAdsetId === "none" ? null : selectedAdsetId,
      ad_id: selectedAdId === "none" ? null : selectedAdId,
      sale_date: saleDate,
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      tax_amount: taxAmount,
      refund_amount: status === "refunded" ? refundAmount : 0,
      chargeback_amount: status === "chargeback" ? chargebackAmount : 0,
      payment_method: paymentMethod,
      status,
      quantity,
      notes: notes || undefined,
      lead_state: leadState === "none" ? null : leadState,
      lead_formation: leadFormation === "none" ? null : leadFormation,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      lead_city: leadCity || null,
    };

    try {
      if (editingSale) {
        await updateSale.mutateAsync({ id: editingSale.id, ...payload });
        toast.success("Venda atualizada com sucesso!");
      } else {
        await createSale.mutateAsync(payload);
        toast.success("Venda registrada com sucesso!");
      }
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error("Erro ao salvar venda");
    }
  };

  const resetForm = () => {
    setProductId("none");
    setQuantity(1);
    setGrossRevenue(0);
    setTaxAmount(0);
    setPaymentMethod("pix");
    setStatus("confirmed");
    setRefundAmount(0);
    setChargebackAmount(0);
    setAdAccountId("none");
    setSelectedCampaignId("none");
    setSelectedAdsetId("none");
    setSelectedAdId("none");
    setSaleDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
    setLeadState("none");
    setLeadFormation("none");
    setContactName("");
    setContactPhone("");
    setLeadCity("");
  };

  const isPending = createSale.isPending || updateSale.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSale ? "Editar Venda" : "Registrar Venda"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* RD CRM info banner */}
          {editingSale?.rd_deal_id && (
            <div className="rounded-md bg-muted/50 border p-3 space-y-1 text-sm">
              {editingSale.rd_product_name && (
                <div><span className="text-muted-foreground">Produto (RD):</span> <span className="font-medium">{editingSale.rd_product_name}</span></div>
              )}
              {editingSale.rd_campaign_name && (
                <div><span className="text-muted-foreground">Campanha/Região (RD):</span> <span className="font-medium">{editingSale.rd_campaign_name}</span></div>
              )}
            </div>
          )}

          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem produto</SelectItem>
                 {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Data da Venda</Label>
              <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            <div>
              <Label>Valor Bruto (R$)</Label>
              <CurrencyInput value={grossRevenue} onChange={setGrossRevenue} />
            </div>
            <div>
              <Label>Imposto (R$)</Label>
              <CurrencyInput value={taxAmount} onChange={setTaxAmount} />
            </div>
            <div>
              <Label>Líquido (R$)</Label>
              <CurrencyInput value={netRevenue} onChange={() => {}} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="refunded">Reembolsada</SelectItem>
                  <SelectItem value="chargeback">Chargeback</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "refunded" && (
            <div>
              <Label>Valor do Reembolso (R$)</Label>
              <CurrencyInput value={refundAmount} onChange={setRefundAmount} />
            </div>
          )}

          {status === "chargeback" && (
            <div>
              <Label>Valor do Chargeback (R$)</Label>
              <CurrencyInput value={chargebackAmount} onChange={setChargebackAmount} />
            </div>
          )}


          {/* Informações do Lead */}
          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Informações do Lead (opcional)</h3>
            <div>
              <Label>Nome do Contato</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
              <div>
                <Label>Cidade</Label>
                <Input value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder="Cidade" />
              </div>
              <div>
                <Label>Estado (UF)</Label>
                <Select value={leadState} onValueChange={setLeadState}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {BRAZIL_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Formação</Label>
                <Select value={leadFormation} onValueChange={setLeadFormation}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {FORMATIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre a venda..." />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Salvando..." : editingSale ? "Salvar Alterações" : "Registrar Venda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
