import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileDown, FileText, Printer, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Sale } from "@/hooks/useSales";

type Company = { id: string; name: string; legal_name?: string | null; expert_name?: string | null };
type InvoiceData = Record<"number" | "issueDate" | "issuerName" | "issuerDocument" | "issuerAddress" | "customerName" | "customerDocument" | "customerEmail" | "customerAddress" | "description" | "serviceCode" | "amount" | "taxRate" | "notes", string>;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const initialInvoice = (): InvoiceData => ({
  number: `GD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-001`, issueDate: today(),
  issuerName: "", issuerDocument: "", issuerAddress: "", customerName: "", customerDocument: "", customerEmail: "", customerAddress: "",
  description: "Prestação de serviços", serviceCode: "", amount: "", taxRate: "", notes: "",
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function InvoicePdfStudio({ companies, sales }: { companies: Company[]; sales: Sale[] }) {
  const [invoice, setInvoice] = useState<InvoiceData>(initialInvoice);
  const [companyId, setCompanyId] = useState<string>("");
  const [saleId, setSaleId] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const confirmedSales = useMemo(() => sales.filter((sale) => sale.status === "confirmed"), [sales]);
  const amount = Number(invoice.amount.replace(",", ".")) || 0;
  const taxRate = Number(invoice.taxRate.replace(",", ".")) || 0;
  const tax = amount * taxRate / 100;
  const total = amount + tax;

  useEffect(() => {
    if (companyId) return;
    const first = companies[0];
    if (!first) return;
    setCompanyId(first.id);
    setInvoice((current) => ({ ...current, issuerName: first.legal_name || first.name }));
  }, [companies, companyId]);

  function update<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) {
    setInvoice((current) => ({ ...current, [key]: value }));
  }

  function selectCompany(id: string) {
    setCompanyId(id);
    const company = companies.find((item) => item.id === id);
    if (company) update("issuerName", company.legal_name || company.name);
  }

  function selectSale(id: string) {
    setSaleId(id);
    const sale = confirmedSales.find((item) => item.id === id);
    if (!sale) return;
    setInvoice((current) => ({
      ...current,
      customerName: sale.contact_name || current.customerName,
      customerEmail: sale.contact_email || current.customerEmail,
      customerAddress: [sale.lead_city, sale.lead_state].filter(Boolean).join(" — ") || current.customerAddress,
      customerDocument: sale.custom_fields?.cpf_cnpj || sale.custom_fields?.document || current.customerDocument,
      description: sale.rd_product_name || sale.notes || current.description,
      amount: String(sale.gross_revenue || sale.net_revenue || ""),
    }));
  }

  function printPdf() {
    const popup = window.open("", "growdash-invoice-pdf", "width=860,height=900");
    if (!popup) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Nota fiscal — ${escapeHtml(invoice.number)}</title><style>
      *{box-sizing:border-box} body{margin:0;background:#f4f1e9;color:#201a10;font-family:Arial,sans-serif;font-size:13px;line-height:1.45}.page{max-width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:48px}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #b98522;padding-bottom:22px}.eyebrow{color:#9c6815;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}.title{margin:5px 0;font-size:27px}.badge{border:1px solid #b98522;border-radius:12px;padding:12px;text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.card{border:1px solid #dfd7c8;border-radius:12px;padding:16px}.label{color:#796e5d;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase}.value{margin-top:5px;font-weight:600;white-space:pre-wrap}.service{margin-top:16px;border:1px solid #dfd7c8;border-radius:12px;padding:16px}.totals{margin:20px 0 0 auto;width:290px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #eee5d6;padding:8px 0}.total{font-size:18px;font-weight:800;color:#8b5c11}.notice{margin-top:34px;border-left:3px solid #b98522;background:#fff8e9;padding:12px;color:#6c5329;font-size:11px}@media print{body{background:#fff}.page{margin:0;min-height:0}.notice{break-inside:avoid}}</style></head><body><main class="page"><div class="top"><div><div class="eyebrow">Growdash · documento financeiro</div><h1 class="title">Nota fiscal de serviços</h1><div>Prévia para conferência e exportação em PDF</div></div><div class="badge"><div class="label">Número</div><b>${escapeHtml(invoice.number || "—")}</b><div class="label" style="margin-top:8px">Emissão</div><b>${escapeHtml(formatDate(invoice.issueDate))}</b></div></div><section class="grid"><div class="card"><div class="label">Emitente</div><div class="value">${escapeHtml(invoice.issuerName || "Não informado")}<br>${escapeHtml(invoice.issuerDocument || "Documento não informado")}<br>${escapeHtml(invoice.issuerAddress || "Endereço não informado")}</div></div><div class="card"><div class="label">Tomador do serviço</div><div class="value">${escapeHtml(invoice.customerName || "Não informado")}<br>${escapeHtml(invoice.customerDocument || "Documento não informado")}<br>${escapeHtml(invoice.customerEmail || "E-mail não informado")}<br>${escapeHtml(invoice.customerAddress || "Endereço não informado")}</div></div></section><section class="service"><div class="label">Serviço</div><div class="value">${escapeHtml(invoice.description || "Prestação de serviços")}</div><div class="label" style="margin-top:16px">Código do serviço municipal</div><div class="value">${escapeHtml(invoice.serviceCode || "Não informado")}</div><div class="label" style="margin-top:16px">Observações</div><div class="value">${escapeHtml(invoice.notes || "—")}</div></section><section class="totals"><div class="row"><span>Valor dos serviços</span><b>${money.format(amount)}</b></div><div class="row"><span>Tributos (${taxRate.toLocaleString("pt-BR")}% )</span><b>${money.format(tax)}</b></div><div class="row total"><span>Total</span><span>${money.format(total)}</span></div></section><div class="notice"><b>Importante:</b> esta é uma prévia em PDF, não uma NFS-e autorizada. A emissão fiscal válida exige integração com o município/provedor fiscal, credenciais e autorização tributária da empresa emitente.</div></main><script>window.onload=()=>window.print()</script></body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  return <section className="gd-panel overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><div><h2 className="font-black">Nota em PDF</h2><p className="mt-1 text-xs text-muted-foreground">Preencha os dados básicos e salve uma prévia em PDF.</p></div></div><Button onClick={printPdf}><Printer className="mr-2 h-4 w-4" />Gerar PDF</Button></div>
    <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Empresa emitente (opcional)"><Select value={companyId} onValueChange={selectCompany}><SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger><SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.legal_name || company.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Preencher de uma venda (opcional)"><Select value={saleId} onValueChange={selectSale}><SelectTrigger><SelectValue placeholder="Selecionar venda" /></SelectTrigger><SelectContent>{confirmedSales.map((sale) => <SelectItem key={sale.id} value={sale.id}>{sale.contact_name || sale.rd_product_name || "Venda sem contato"} · {money.format(sale.gross_revenue || sale.net_revenue)}</SelectItem>)}</SelectContent></Select></Field><Field label="Nome / razão social emitente"><Input value={invoice.issuerName} onChange={(event) => update("issuerName", event.target.value)} placeholder="Sua empresa" /></Field><Field label="Nome do cliente"><Input value={invoice.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="Quem receberá a nota" /></Field><div className="sm:col-span-2"><Field label="Descrição do serviço"><Textarea value={invoice.description} onChange={(event) => update("description", event.target.value)} placeholder="Ex.: Consultoria de marketing — agosto/2026" /></Field></div><Field label="Valor dos serviços"><Input inputMode="decimal" value={invoice.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0,00" /></Field><Field label="Data de emissão"><Input type="date" value={invoice.issueDate} onChange={(event) => update("issueDate", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Observações"><Textarea value={invoice.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Informações complementares (opcional)" /></Field></div></div><Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-xl border border-border bg-muted/15"><CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left text-xs font-bold">Mais dados fiscais e identificação <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></CollapsibleTrigger><CollapsibleContent className="grid gap-4 border-t border-border p-4 sm:grid-cols-2"><Field label="Número"><Input value={invoice.number} onChange={(event) => update("number", event.target.value)} /></Field><Field label="CNPJ ou CPF do emitente"><Input value={invoice.issuerDocument} onChange={(event) => update("issuerDocument", event.target.value)} placeholder="00.000.000/0000-00" /></Field><div className="sm:col-span-2"><Field label="Endereço do emitente"><Input value={invoice.issuerAddress} onChange={(event) => update("issuerAddress", event.target.value)} /></Field></div><Field label="CPF ou CNPJ do cliente"><Input value={invoice.customerDocument} onChange={(event) => update("customerDocument", event.target.value)} /></Field><Field label="E-mail do cliente"><Input type="email" value={invoice.customerEmail} onChange={(event) => update("customerEmail", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Endereço do cliente"><Input value={invoice.customerAddress} onChange={(event) => update("customerAddress", event.target.value)} /></Field></div><Field label="Código de serviço municipal"><Input value={invoice.serviceCode} onChange={(event) => update("serviceCode", event.target.value)} /></Field><Field label="Alíquota de tributos (%)"><Input inputMode="decimal" value={invoice.taxRate} onChange={(event) => update("taxRate", event.target.value)} placeholder="0,00" /></Field></CollapsibleContent></Collapsible></div><aside className="rounded-2xl border border-primary/20 bg-primary/[.045] p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Resumo da prévia</p><p className="mt-4 text-xs text-muted-foreground">Valor dos serviços</p><p className="text-xl font-black">{money.format(amount)}</p><p className="mt-3 text-xs text-muted-foreground">Tributos estimados</p><p className="font-bold">{money.format(tax)}</p><div className="mt-4 border-t border-primary/20 pt-4"><p className="text-xs text-muted-foreground">Total do documento</p><p className="text-2xl font-black text-primary">{money.format(total)}</p></div><div className="mt-5 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.08] p-3 text-[11px] leading-relaxed text-muted-foreground"><ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />Prévia em PDF. A NFS-e oficial requer integração fiscal e autorização tributária.</div><Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { setCompanyId(""); setSaleId(""); setInvoice(initialInvoice()); }}><RotateCcw className="mr-2 h-3.5 w-3.5" />Limpar campos</Button><Button className="mt-2 w-full" onClick={printPdf}><FileDown className="mr-2 h-4 w-4" />Salvar como PDF</Button></aside></div>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
