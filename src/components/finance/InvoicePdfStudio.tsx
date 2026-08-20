import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Copy,
  ExternalLink,
  History,
  Link2,
  ChevronDown,
  Eye,
  FileDown,
  FileText,
  Printer,
  RotateCcw,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Sale } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Company = { id: string; name: string; legal_name?: string | null };
type DocumentType =
  | "invoice"
  | "purchase_request"
  | "investment_request"
  | "supplier_quote"
  | "stock_replenishment"
  | "software_request"
  | "service_request"
  | "asset_request"
  | "travel_request"
  | "reimbursement_request"
  | "custom_request";
type DocumentData = Record<
  | "number"
  | "issueDate"
  | "issuerName"
  | "customerName"
  | "description"
  | "amount"
  | "notes"
  | "requester"
  | "department"
  | "category"
  | "paymentMethod"
  | "pixKey"
  | "authorization"
  | "issuerDocument"
  | "customerDocument"
  | "customerEmail"
  | "issuerAddress"
  | "customerAddress"
  | "serviceCode"
  | "taxRate"
  | "customDocumentType"
  | "attachmentPath"
  | "attachmentName",
  string
>;
type HistoryAction = "generated" | "share_created" | "submitted";
type HistoryItem = {
  id: string;
  action: HistoryAction;
  document_type: string;
  document_number: string | null;
  amount: number | null;
  share_token: string | null;
  share_expires_at: string | null;
  submitted_at: string | null;
  created_at: string;
  document: Partial<DocumentData>;
};
type PdfSaveTarget = {
  createWritable: () => Promise<{ write: (data: File) => Promise<void>; close: () => Promise<void> }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const freshDocument = (): DocumentData => ({
  number: `GD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-001`,
  issueDate: today(),
  issuerName: "",
  customerName: "",
  description: "",
  amount: "",
  notes: "",
  requester: "",
  department: "",
  category: "",
  paymentMethod: "",
  pixKey: "",
  authorization: "Não autorizado",
  issuerDocument: "",
  customerDocument: "",
  customerEmail: "",
  issuerAddress: "",
  customerAddress: "",
  serviceCode: "",
  taxRate: "",
  customDocumentType: "",
  attachmentPath: "",
  attachmentName: "",
});
const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: "purchase_request", label: "Solicitação de compra" },
  { value: "investment_request", label: "Solicitação de investimento" },
  { value: "supplier_quote", label: "Cotação de fornecedor" },
  { value: "stock_replenishment", label: "Reposição de estoque" },
  { value: "software_request", label: "Aquisição de software / plataforma" },
  { value: "service_request", label: "Contratação de serviço" },
  { value: "asset_request", label: "Aquisição de equipamento / ativo" },
  { value: "travel_request", label: "Solicitação de viagem / deslocamento" },
  { value: "reimbursement_request", label: "Solicitação de reembolso" },
  { value: "custom_request", label: "Outro tipo (personalizado)" },
  { value: "invoice", label: "Nota fiscal (prévia)" },
];
const documentTitle = (type: DocumentType, customTitle = "") =>
  type === "custom_request"
    ? customTitle.trim() || "Documento personalizado"
    : DOCUMENT_TYPES.find((item) => item.value === type)?.label || "Documento financeiro";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char,
  );
}
function formatDate(value: string) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
}

export function InvoicePdfStudio({
  companies,
  sales,
  workspaceId,
  userId,
}: {
  companies: Company[];
  sales: Sale[];
  workspaceId?: string;
  userId?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [document, setDocument] = useState<DocumentData>(freshDocument);
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [companyId, setCompanyId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [generatedPdfReady, setGeneratedPdfReady] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const confirmedSales = useMemo(
    () => sales.filter((sale) => sale.status === "confirmed"),
    [sales],
  );
  const amount = Number(document.amount.replace(",", ".")) || 0;
  const currentDocumentTitle = documentTitle(documentType, document.customDocumentType);
  const history = useQuery({
    queryKey: ["financial-document-history", workspaceId],
    enabled: !!workspaceId && !workspaceId.startsWith("legacy-"),
    queryFn: async (): Promise<HistoryItem[]> => {
      const { data, error } = await (supabase as any)
        .from("financial_document_history")
        .select(
          "id,action,document_type,document_number,amount,share_token,share_expires_at,submitted_at,created_at,document",
        )
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
  const visibleHistory = useMemo(
    () =>
      (history.data ?? []).filter((item) => {
        const haystack =
          `${item.document_number || ""} ${item.document.customerName || ""} ${item.document.issuerName || ""} ${item.document_type}`.toLowerCase();
        const matchesSearch =
          !historySearch.trim() || haystack.includes(historySearch.trim().toLowerCase());
        const matchesDate = !historyDate || item.created_at.slice(0, 10) === historyDate;
        return matchesSearch && matchesDate;
      }),
    [history.data, historyDate, historySearch],
  );
  const selectedVisibleCount = visibleHistory.filter((item) => selectedHistoryIds.includes(item.id)).length;
  const allVisibleSelected = visibleHistory.length > 0 && selectedVisibleCount === visibleHistory.length;

  useEffect(() => {
    if (!workspaceId || workspaceId.startsWith("legacy-")) return;
    const channel = supabase
      .channel(`finance-document-history-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_document_history",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () =>
          void queryClient.invalidateQueries({
            queryKey: ["financial-document-history", workspaceId],
          }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [queryClient, workspaceId]);

  const update = <K extends keyof DocumentData>(key: K, value: DocumentData[K]) =>
    setDocument((current) => ({ ...current, [key]: value }));
  const selectCompany = (id: string) => {
    setCompanyId(id);
    const company = companies.find((item) => item.id === id);
    if (company) update("issuerName", company.legal_name || company.name);
  };
  const selectSale = (id: string) => {
    setSaleId(id);
    const sale = confirmedSales.find((item) => item.id === id);
    if (!sale) return;
    setDocument((current) => ({
      ...current,
      customerName: sale.contact_name || current.customerName,
      customerEmail: sale.contact_email || current.customerEmail,
      customerAddress:
        [sale.lead_city, sale.lead_state].filter(Boolean).join(" — ") || current.customerAddress,
      customerDocument:
        sale.custom_fields?.cpf_cnpj || sale.custom_fields?.document || current.customerDocument,
      description: sale.rd_product_name || sale.notes || current.description,
      amount: String(sale.gross_revenue || sale.net_revenue || ""),
    }));
  };

  const currentPayload = () => ({ ...document });
  async function track(
    action: Exclude<HistoryAction, "submitted">,
    extra: Record<string, unknown> = {},
  ) {
    if (!workspaceId || workspaceId.startsWith("legacy-") || !userId)
      throw new Error("Workspace financeiro não carregado.");
    const { data, error } = await (supabase as any)
      .from("financial_document_history")
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        action,
        document_type: documentType,
        document_number: document.number || null,
        amount,
        document: currentPayload(),
        ...extra,
      })
      .select("id,share_token")
      .single();
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["financial-document-history", workspaceId] });
    return data as { id: string; share_token?: string | null };
  }

  async function copyInvoiceFormLink() {
    if (documentType !== "invoice") {
      toast({
        title: "Selecione “Nota fiscal (prévia)”",
        description: "O link público é destinado ao preenchimento dos dados de uma nota fiscal.",
        variant: "destructive",
      });
      return;
    }
    try {
      const row = await track("share_created", {
        share_token: crypto.randomUUID(),
        share_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const url = `${window.location.origin}/nota-fiscal/${row.share_token}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado",
        description: "Válido por 14 dias ou até o envio do formulário.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível criar o link",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  async function deleteHistoryItem(item: HistoryItem) {
    if (
      !workspaceId ||
      !window.confirm("Excluir este documento do histórico? Esta ação não pode ser desfeita.")
    )
      return;
    setDeletingHistoryId(item.id);
    try {
      if (item.document.attachmentPath) {
        const { error: attachmentError } = await supabase.storage
          .from("invoice-attachments")
          .remove([item.document.attachmentPath]);
        if (attachmentError) throw attachmentError;
      }
      const { error } = await (supabase as any)
        .from("financial_document_history")
        .delete()
        .eq("id", item.id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      await queryClient.invalidateQueries({
        queryKey: ["financial-document-history", workspaceId],
      });
      toast({ title: "Documento excluído do histórico" });
    } catch (error) {
      toast({
        title: "Não foi possível excluir o documento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingHistoryId(null);
    }
  }

  function toggleHistoryItem(id: string, checked: boolean) {
    setSelectedHistoryIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((itemId) => itemId !== id),
    );
  }

  function toggleVisibleHistory(checked: boolean) {
    const visibleIds = visibleHistory.map((item) => item.id);
    setSelectedHistoryIds((current) =>
      checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  async function deleteHistoryBulk(mode: "selected" | "all_invoices") {
    if (!workspaceId) return;
    const count = mode === "selected" ? selectedHistoryIds.length : (history.data ?? []).filter((item) => item.document_type === "invoice").length;
    if (count === 0) return;
    const prompt = mode === "selected"
      ? `Excluir ${count} documento(s) selecionado(s)? Esta ação não pode ser desfeita.`
      : `Excluir todo o histórico de notas fiscais (${count} registro(s))? Esta ação não pode ser desfeita.`;
    if (!window.confirm(prompt)) return;

    setIsBulkDeleting(true);
    try {
      const { data, error } = await (supabase as any).rpc("delete_financial_document_history", {
        p_workspace_id: workspaceId,
        p_ids: mode === "selected" ? selectedHistoryIds : null,
        p_delete_all_invoices: mode === "all_invoices",
      });
      if (error) throw error;
      setSelectedHistoryIds([]);
      await queryClient.invalidateQueries({ queryKey: ["financial-document-history", workspaceId] });
      toast({ title: `${Number(data || count)} documento(s) excluído(s) do histórico` });
    } catch (error) {
      toast({ title: "Não foi possível excluir os documentos", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function openAttachment(item: HistoryItem) {
    if (!item.document.attachmentPath) return;
    const { data, error } = await supabase.storage
      .from("invoice-attachments")
      .createSignedUrl(item.document.attachmentPath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Não foi possível abrir o anexo",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function printPdf(registerGeneration = true) {
    const popup = window.open("", "growdash-finance-document", "width=860,height=900");
    if (!popup) return;
    if (registerGeneration) {
      try {
        await track("generated");
      } catch (error) {
        popup.close();
        toast({
          title: "PDF não registrado",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
        return;
      }
    }
    const isRequest = documentType !== "invoice";
    const tax = (amount * (Number(document.taxRate.replace(",", ".")) || 0)) / 100;
    const requestHtml = `<section class="request"><p><b>Nº Solicitação:</b> ${escapeHtml(document.number || "Não informado")}</p><p><b>Data:</b> ${escapeHtml(formatDate(document.issueDate))}</p><p><b>Tipo:</b> ${escapeHtml(currentDocumentTitle)}</p><p><b>Categoria:</b> ${escapeHtml(document.category || "Não informada")}</p><p><b>Solicitante:</b> ${escapeHtml(document.requester || "Não informado")}</p><p><b>Setor:</b> ${escapeHtml(document.department || "Não informado")}</p><p><b>Descrição:</b> ${escapeHtml(document.description || "Não informada")}</p><p><b>Pagamento:</b> ${escapeHtml(document.paymentMethod || "Não informado")}</p><p><b>Chave PIX:</b> ${escapeHtml(document.pixKey || "Não informada")}</p><p class="amount"><b>Valor total:</b> ${money.format(amount)}</p><p><b>Autorizado por:</b> ${escapeHtml(document.authorization || "Não autorizado")}</p><p><b>Data de autorização:</b> Não informada</p>${document.notes ? `<p><b>Observações:</b> ${escapeHtml(document.notes)}</p>` : ""}</section>`;
    const invoiceHtml = `<section class="grid"><div class="card"><div class="label">Emitente</div><div class="value">${escapeHtml(document.issuerName || "Não informado")}<br>${escapeHtml(document.issuerDocument || "Documento não informado")}<br>${escapeHtml(document.issuerAddress || "Endereço não informado")}</div></div><div class="card"><div class="label">Solicitante</div><div class="value">${escapeHtml(document.customerName || "Não informado")}<br>${escapeHtml(document.customerDocument || "Documento não informado")}<br>${escapeHtml(document.customerAddress || "Endereço não informado")}</div></div></section><section class="service"><div class="label">Serviço</div><div class="value">${escapeHtml(document.description || "Prestação de serviços")}</div><div class="label" style="margin-top:16px">Autorizado por</div><div class="value">${escapeHtml(document.authorization || "Não informado")}</div><div class="label" style="margin-top:16px">Código do serviço municipal</div><div class="value">${escapeHtml(document.serviceCode || "Não informado")}</div><div class="label" style="margin-top:16px">Observações</div><div class="value">${escapeHtml(document.notes || "—")}</div></section><section class="totals"><div class="row"><span>Valor dos serviços</span><b>${money.format(amount)}</b></div><div class="row"><span>Tributos</span><b>${money.format(tax)}</b></div><div class="row total"><span>Total</span><span>${money.format(amount + tax)}</span></div></section><div class="notice"><b>Importante:</b> esta é uma prévia em PDF, não uma NFS-e autorizada. A emissão fiscal válida exige integração fiscal e autorização tributária.</div>`;
    const brandIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="silver" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#050505"/><stop offset=".52" stop-color="#555"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path fill="url(#silver)" d="M8 31 32 7l24 24-8 8-16-16-16 16z"/><path fill="url(#silver)" d="m32 31 12 12-12 12-12-12z"/></svg>`;
    popup.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(currentDocumentTitle)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f4f4;color:#111;font-family:Arial,sans-serif;font-size:13px;line-height:1.45}.page{max-width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:48px}.top{border-bottom:2px solid #151515;padding-bottom:22px}.brand{display:flex;align-items:center;gap:8px;color:#0b0b0b;font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase}.brand svg{width:25px;height:25px}.eyebrow{color:#555;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}.title{margin:9px 0 5px;font-size:30px;text-transform:uppercase;color:#151515}.badge{margin-top:16px;border:1px solid #777;border-radius:10px;padding:10px;width:210px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.card,.service{border:1px solid #ddd;border-radius:12px;padding:16px}.service{margin-top:16px}.label{color:#555;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase}.value{margin-top:5px;font-weight:600;white-space:pre-wrap}.totals{margin:20px 0 0 auto;width:290px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e6e6e6;padding:8px 0}.total{font-size:18px;font-weight:800;color:#111}.notice{margin-top:34px;border-left:3px solid #222;background:#f3f3f3;padding:12px;color:#333;font-size:11px}.request{font-size:18px;line-height:1.35;margin-top:34px}.request p{margin:13px 0}.request .amount{font-size:25px;margin:28px 0}@media print{body{background:#fff}.page{margin:0;min-height:0}}</style></head><body><main class="page"><div class="top"><div class="brand">${brandIcon}<span>Growdash</span></div><div class="eyebrow" style="margin-top:12px">Documento financeiro</div><h1 class="title">${escapeHtml(currentDocumentTitle)}</h1><div>${isRequest ? "Solicitação para conferência e autorização" : "Prévia para conferência e exportação em PDF"}</div><div class="badge"><b>Número:</b> ${escapeHtml(document.number || "—")}<br><b>Data:</b> ${escapeHtml(formatDate(document.issueDate))}</div></div>${isRequest ? requestHtml : invoiceHtml}</main><script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
    if (registerGeneration) {
      setGeneratedPdfReady(true);
      toast({
        title: "Nota pronta e registrada no histórico",
        description: "Use a janela do PDF para baixar no computador ou compartilhar pelo celular/WhatsApp.",
      });
    }
  }

  async function createPdfFile() {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0.06, 0.06, 0.06);
    const muted = rgb(0.35, 0.35, 0.35);
    const border = rgb(0.84, 0.84, 0.84);
    const width = page.getWidth();
    const margin = 44;
    const tax = (amount * (Number(document.taxRate.replace(",", ".")) || 0)) / 100;
    const wrap = (text: string, maxWidth: number, font = regular, size = 10) => {
      const lines: string[] = [];
      let current = "";
      for (const word of text.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(current);
          current = word;
        } else current = candidate;
      }
      if (current) lines.push(current);
      return lines;
    };
    const writeBlock = (label: string, content: string, x: number, top: number, blockWidth: number, maxLines = 4) => {
      page.drawText(label.toUpperCase(), { x, y: top - 18, font: bold, size: 7, color: muted });
      let y = top - 36;
      const lines = content.split(/\r?\n/).flatMap((value) => wrap(value || " ", blockWidth - 24));
      for (const line of lines.slice(0, maxLines)) {
        page.drawText(line, { x, y, font: regular, size: 10, color: black });
        y -= 14;
      }
    };

    if (!requestMode) {
      page.drawRectangle({ x: margin, y: 792, width: width - margin * 2, height: 2, color: black });
      page.drawText("GROWDASH", { x: margin, y: 768, font: bold, size: 10, color: black });
      page.drawText(currentDocumentTitle.toUpperCase(), { x: margin, y: 726, font: bold, size: 22, color: black });
      page.drawText(`Número: ${document.number || "-"}`, { x: margin, y: 686, font: bold, size: 10, color: black });
      page.drawText(`Data: ${formatDate(document.issueDate)}`, { x: margin, y: 668, font: regular, size: 10, color: black });
    }

    const cardTop = 632;
    const cardWidth = (width - margin * 2 - 16) / 2;
    if (requestMode) {
      // Keep the operational request visually identical to the approved
      // reference: a clear header, document badge, divider and a single
      // readable sequence of information (rather than dashboard-style cards).
      page.drawRectangle({ x: margin, y: 604, width: 18, height: 18, color: black });
      page.drawText("GROWDASH", { x: margin + 27, y: 607, font: bold, size: 10, color: black });
      page.drawText("DOCUMENTO FINANCEIRO", { x: margin, y: 570, font: bold, size: 9, color: muted });
      page.drawText(currentDocumentTitle.toUpperCase(), { x: margin, y: 522, font: bold, size: 27, color: black });
      page.drawText("Solicitação para conferência e autorização", { x: margin, y: 490, font: regular, size: 12, color: black });
      page.drawRectangle({ x: margin, y: 420, width: 185, height: 52, borderColor: muted, borderWidth: 1 });
      page.drawText(`Número: ${document.number || "-"}`, { x: margin + 10, y: 453, font: bold, size: 11, color: black });
      page.drawText(`Data: ${formatDate(document.issueDate)}`, { x: margin + 10, y: 435, font: bold, size: 11, color: black });
      page.drawLine({ start: { x: margin, y: 394 }, end: { x: width - margin, y: 394 }, thickness: 1.5, color: black });
      const labelValue = (label: string, value: string, y: number, size = 12) => {
        const labelWidth = bold.widthOfTextAtSize(`${label}: `, size);
        page.drawText(`${label}:`, { x: margin, y, font: bold, size, color: black });
        const lines = wrap(value || "Não informado", width - margin * 2 - labelWidth, regular, size);
        page.drawText(lines[0] || "Não informado", { x: margin + labelWidth, y, font: regular, size, color: black });
        let nextY = y - (size + 7);
        for (const line of lines.slice(1, 3)) {
          page.drawText(line, { x: margin, y: nextY, font: regular, size, color: black });
          nextY -= size + 4;
        }
        return nextY;
      };
      let y = 350;
      y = labelValue("Nº Solicitação", document.number || "-", y);
      y = labelValue("Data", formatDate(document.issueDate), y);
      y = labelValue("Tipo", currentDocumentTitle, y);
      y = labelValue("Categoria", document.category || "Não informada", y);
      y = labelValue("Solicitante", document.requester || "Não informado", y);
      y = labelValue("Setor", document.department || "Não informado", y);
      y = labelValue("Descrição", document.description || "Não informada", y);
      y = labelValue("Pagamento", document.paymentMethod || "Não informado", y);
      y = labelValue("Chave PIX", document.pixKey || "Não informada", y);
      y -= 10;
      y = labelValue("Valor total", money.format(amount + tax), y, 18);
      y -= 4;
      y = labelValue("Autorizado por", document.authorization || "Não autorizado", y);
      labelValue("Data de autorização", "Não informada", y);
    } else {
      page.drawRectangle({ x: margin, y: cardTop - 112, width: cardWidth, height: 112, borderColor: border, borderWidth: 1 });
      page.drawRectangle({ x: margin + cardWidth + 16, y: cardTop - 112, width: cardWidth, height: 112, borderColor: border, borderWidth: 1 });
      writeBlock("Emitente", `${document.issuerName || "Não informado"}\n${document.issuerDocument || "Documento não informado"}`, margin + 12, cardTop, cardWidth);
      writeBlock("Solicitante", `${document.customerName || "Não informado"}\n${document.customerDocument || "Documento não informado"}`, margin + cardWidth + 28, cardTop, cardWidth);
      page.drawRectangle({ x: margin, y: 384, width: width - margin * 2, height: 112, borderColor: border, borderWidth: 1 });
      writeBlock("Descrição", document.description || "Prestação de serviços", margin + 12, 496, width - margin * 2);
      writeBlock("Autorizado por", document.authorization || "Não informado", margin + 12, 438, width - margin * 2);
    }
    if (!requestMode) {
      page.drawLine({ start: { x: width - margin - 220, y: 212 }, end: { x: width - margin, y: 212 }, thickness: 1.5, color: black });
      page.drawText("TOTAL", { x: width - margin - 220, y: 192, font: bold, size: 13, color: black });
      page.drawText(money.format(amount + tax), { x: width - margin - 118, y: 192, font: bold, size: 13, color: black });
      if (document.notes) writeBlock("Observações", document.notes, margin, 172, width - margin * 2, 3);
      page.drawText("Esta é uma prévia em PDF, não uma NFS-e autorizada.", { x: margin, y: 42, font: regular, size: 8, color: muted });
    }
    const bytes = await pdf.save();
    const safeNumber = (document.number || "growdash").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new File([bytes], `documento-${safeNumber}.pdf`, { type: "application/pdf" });
  }

  function downloadPdfFile(file: File) {
    const url = URL.createObjectURL(file);
    // `document` is also the form state in this component; access the DOM
    // explicitly so a generated PDF can always be downloaded in-app.
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.style.display = "none";
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function choosePdfDestination(): Promise<PdfSaveTarget | null | "cancelled"> {
    const pickerWindow = window as Window & {
      showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<PdfSaveTarget>;
    };
    if (!pickerWindow.showSaveFilePicker) return null;
    try {
      return await pickerWindow.showSaveFilePicker({
        suggestedName: `documento-${(document.number || "growdash").replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`,
        types: [{ description: "Documento PDF", accept: { "application/pdf": [".pdf"] } }],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }

  async function saveToDestination(file: File, target: PdfSaveTarget | null) {
    if (!target) return false;
    const writable = await target.createWritable();
    await writable.write(file);
    await writable.close();
    toast({ title: "PDF salvo", description: "O documento foi salvo no local escolhido." });
    return true;
  }

  async function deliverPdf(file: File, previewWindow?: Window | null) {
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      downloadPdfFile(file);
      toast({ title: "PDF baixado", description: "O arquivo foi salvo nos downloads deste dispositivo." });
      return;
    }
    if (!previewWindow) {
      downloadPdfFile(file);
      toast({ title: "PDF baixado", description: "Abra Arquivos/Downloads para compartilhar o documento." });
      return;
    }
    previewWindow.opener = null;
    const url = URL.createObjectURL(file);
    previewWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    toast({ title: "PDF pronto", description: "Use o menu nativo para salvar ou compartilhar o arquivo." });
  }

  async function generatePdf() {
    const previewWindow = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? window.open("", "_blank") : null;
    setGeneratingPdf(true);
    try {
      const destination = await choosePdfDestination();
      if (destination === "cancelled") return;
      const file = await createPdfFile();
      await track("generated");
      setGeneratedPdfReady(true);
      if (!(await saveToDestination(file, destination))) await deliverPdf(file, previewWindow);
    } catch (error) {
      previewWindow?.close();
      toast({ title: "Não foi possível gerar o PDF", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function downloadPdf() {
    const previewWindow = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? window.open("", "_blank") : null;
    try {
      const destination = await choosePdfDestination();
      if (destination === "cancelled") return;
      const file = await createPdfFile();
      if (!(await saveToDestination(file, destination))) await deliverPdf(file, previewWindow);
    } catch (error) {
      previewWindow?.close();
      toast({ title: "Não foi possível baixar o PDF", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  }

  async function previewPdf() {
    const previewWindow = window.open("", "_blank");
    try {
      const file = await createPdfFile();
      if (!previewWindow) {
        downloadPdfFile(file);
        toast({ title: "Prévia bloqueada", description: "O PDF foi baixado para você abrir no local desejado." });
        return;
      }
      previewWindow.opener = null;
      const url = URL.createObjectURL(file);
      previewWindow.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (error) {
      previewWindow?.close();
      toast({ title: "Não foi possível pré-visualizar o PDF", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  }

  async function sharePdf() {
    try {
      const file = await createPdfFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: currentDocumentTitle });
        return;
      }
      downloadPdfFile(file);
      toast({ title: "PDF baixado", description: "Este navegador não oferece compartilhamento de arquivos." });
    } catch (error) {
      toast({ title: "Não foi possível compartilhar o PDF", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  }

  const requestMode = documentType !== "invoice";
  const actionLabel = (action: HistoryAction) =>
    action === "generated"
      ? "PDF gerado"
      : action === "share_created"
        ? "Link enviado"
        : "Dados preenchidos";
  return (
    <section className="gd-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black">Documentos financeiros</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie uma solicitação ou uma prévia de nota, sem depender de empresa ou venda.
            </p>
          </div>
        </div>
        <Button onClick={() => void generatePdf()} disabled={generatingPdf}>
          <Printer className="mr-2 h-4 w-4" />
          {generatingPdf ? "Gerando PDF…" : "Gerar nota em PDF"}
        </Button>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de documento">
              <Select
                value={documentType}
                onValueChange={(value) => setDocumentType(value as DocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {documentType === "custom_request" && (
              <Field label="Tipo de documento personalizado">
                <Input
                  value={document.customDocumentType}
                  onChange={(event) => update("customDocumentType", event.target.value)}
                  placeholder="Ex.: solicitação de contratação, contrato, recibo"
                />
              </Field>
            )}
            <Field label={requestMode ? "Nº da solicitação" : "Número da nota"}>
              <Input
                value={document.number}
                onChange={(event) => update("number", event.target.value)}
              />
            </Field>
            <Field label="Data">
              <Input
                type="date"
                value={document.issueDate}
                onChange={(event) => update("issueDate", event.target.value)}
              />
            </Field>
            {requestMode ? (
              <Field label="Solicitante">
                <Input
                  value={document.requester}
                  onChange={(event) => update("requester", event.target.value)}
                  placeholder="Nome de quem solicita"
                />
              </Field>
            ) : (
              <Field label="Nome / razão social emitente">
                <Input
                  value={document.issuerName}
                  onChange={(event) => update("issuerName", event.target.value)}
                  placeholder="Sua empresa"
                />
              </Field>
            )}{" "}
            {!requestMode && (
              <Field label="CNPJ da empresa emitente">
                <Input
                  inputMode="numeric"
                  maxLength={18}
                  value={document.issuerDocument}
                  onChange={(event) => update("issuerDocument", event.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </Field>
            )}
            {requestMode ? (
              <Field label="Setor">
                <Input
                  value={document.department}
                  onChange={(event) => update("department", event.target.value)}
                  placeholder="Ex.: Operações, Tráfego, Comercial"
                />
              </Field>
            ) : (
              <Field label="Nome do solicitante">
                <Input
                  value={document.customerName}
                  onChange={(event) => update("customerName", event.target.value)}
                  placeholder="Quem receberá a nota"
                />
              </Field>
            )}
            {requestMode && (
              <Field label="Categoria da despesa">
                <Select
                  value={customCategory ? "__custom__" : document.category}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setCustomCategory(true);
                      update("category", "");
                      return;
                    }
                    setCustomCategory(false);
                    update("category", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Higiene e limpeza">Higiene e limpeza</SelectItem>
                    <SelectItem value="Software e plataformas">Software e plataformas</SelectItem>
                    <SelectItem value="Mídia e anúncios">Mídia e anúncios</SelectItem>
                    <SelectItem value="Equipamentos e tecnologia">
                      Equipamentos e tecnologia
                    </SelectItem>
                    <SelectItem value="Móveis e escritório">Móveis e escritório</SelectItem>
                    <SelectItem value="Serviços terceirizados">Serviços terceirizados</SelectItem>
                    <SelectItem value="Estoque e insumos">Estoque e insumos</SelectItem>
                    <SelectItem value="Viagem e deslocamento">Viagem e deslocamento</SelectItem>
                    <SelectItem value="Treinamento e eventos">Treinamento e eventos</SelectItem>
                    <SelectItem value="__custom__">Outra categoria (personalizada)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {requestMode && customCategory && (
              <Field label="Categoria personalizada">
                <Input
                  value={document.category}
                  onChange={(event) => update("category", event.target.value)}
                  placeholder="Ex.: manutenção, brindes, honorários"
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={document.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder={
                    requestMode
                      ? "Ex.: materiais de higiene, licença de plataforma, equipamento, serviço ou insumo"
                      : "Ex.: Consultoria de marketing — agosto/2026"
                  }
                />
              </Field>
            </div>
            <Field label="Valor total">
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span><Input inputMode="decimal" className="pl-10" value={document.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0,00" /></div>
            </Field>
            {requestMode && (
              <Field label="Forma de pagamento">
                <Input
                  value={document.paymentMethod}
                  onChange={(event) => update("paymentMethod", event.target.value)}
                  placeholder="Ex.: À vista (PIX), cartão, boleto"
                />
              </Field>
            )}
            {requestMode && (
              <>
                <Field label="Chave PIX (opcional)">
                  <Input
                    value={document.pixKey}
                    onChange={(event) => update("pixKey", event.target.value)}
                    placeholder="Não informada"
                  />
                </Field>
                <Field label="Autorizado por">
                  <Input
                    value={document.authorization}
                    onChange={(event) => update("authorization", event.target.value)}
                    placeholder="Não autorizado"
                  />
                </Field>
              </>
            )}
            {!requestMode && (
              <Field label="Autorizado por">
                <Input
                  value={document.authorization}
                  onChange={(event) => update("authorization", event.target.value)}
                  placeholder="Nome de quem autorizou a nota"
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Observações">
                <Textarea
                  value={document.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Informações complementares (opcional)"
                />
              </Field>
            </div>
          </div>
          <Collapsible
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
            className="rounded-xl border border-border bg-muted/15"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left text-xs font-bold">
              Preencher a partir de empresa ou venda (opcional){" "}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Empresa">
                  <Select value={companyId} onValueChange={selectCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.legal_name || company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Venda">
                  <Select value={saleId} onValueChange={selectSale}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar venda" />
                    </SelectTrigger>
                    <SelectContent>
                      {confirmedSales.map((sale) => (
                        <SelectItem key={sale.id} value={sale.id}>
                          {sale.contact_name || sale.rd_product_name || "Venda sem contato"} ·{" "}
                          {money.format(sale.gross_revenue || sale.net_revenue)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {!requestMode && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="CPF/CNPJ cliente">
                    <Input
                      value={document.customerDocument}
                      onChange={(event) => update("customerDocument", event.target.value)}
                    />
                  </Field>
                  <Field label="Código de serviço">
                    <Input
                      value={document.serviceCode}
                      onChange={(event) => update("serviceCode", event.target.value)}
                    />
                  </Field>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
        <aside className="rounded-2xl border border-primary/20 bg-primary/[.045] p-4">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Resumo</p>
          <p className="mt-4 text-xs text-muted-foreground">{currentDocumentTitle}</p>
          <p className="mt-1 text-lg font-black">{document.number}</p>
          <p className="mt-4 text-xs text-muted-foreground">Valor total</p>
          <p className="text-2xl font-black text-primary">{money.format(amount)}</p>
          <p className="mt-4 text-xs text-muted-foreground">Status</p>
          <p className="font-bold">
            {requestMode ? document.authorization || "Não autorizado" : "Prévia em PDF"}
          </p>
          <div className="mt-5 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.08] p-3 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            {requestMode
              ? "Documento operacional para solicitação e autorização."
              : "Prévia em PDF. A NFS-e oficial requer integração fiscal."}
          </div>
          {documentType === "invoice" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => void copyInvoiceFormLink()}
            >
              <Link2 className="mr-2 h-3.5 w-3.5" />
              Copiar link do formulário web da NF
            </Button>
          )}
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => void previewPdf()}>
            <Eye className="mr-2 h-3.5 w-3.5" />
            Pré-visualizar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              setCompanyId("");
              setSaleId("");
              setDocument(freshDocument());
            }}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Limpar campos
          </Button>
          {generatedPdfReady && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => void downloadPdf()}
            >
              <FileDown className="mr-2 h-3.5 w-3.5" />
              Baixar PDF
            </Button>
          )}
          {generatedPdfReady && (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => void sharePdf()}>
              <Share2 className="mr-2 h-3.5 w-3.5" />
              Compartilhar PDF
            </Button>
          )}
        </aside>
      </div>
      <div className="border-t border-border p-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black">Histórico de documentos</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          PDFs gerados, links enviados e formulários preenchidos.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Filtrar por número ou nome"
            />
          </div>
          <Input
            type="date"
            value={historyDate}
            onChange={(event) => setHistoryDate(event.target.value)}
            aria-label="Filtrar histórico por data"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) => toggleVisibleHistory(checked === true)}
              aria-label="Selecionar todos os documentos visíveis"
            />
            Selecionar visíveis
          </label>
          {selectedHistoryIds.length > 0 && (
            <Button size="sm" variant="destructive" disabled={isBulkDeleting} onClick={() => void deleteHistoryBulk("selected")}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Excluir selecionados ({selectedHistoryIds.length})
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={isBulkDeleting || !(history.data ?? []).some((item) => item.document_type === "invoice")} onClick={() => void deleteHistoryBulk("all_invoices")}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Limpar histórico de NF
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {visibleHistory.map((item) => {
            const link = item.share_token
              ? `${window.location.origin}/nota-fiscal/${item.share_token}`
              : null;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3"
              >
                <Checkbox
                  checked={selectedHistoryIds.includes(item.id)}
                  onCheckedChange={(checked) => toggleHistoryItem(item.id, checked === true)}
                  aria-label={`Selecionar ${item.document_number || "documento"}`}
                />
                <div className="min-w-0">
                  <b className="block text-xs">
                    {actionLabel(item.action)} · {documentTitle(item.document_type as DocumentType)}
                  </b>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {item.document_number || "Sem número"} ·{" "}
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                    {item.amount != null ? ` · ${money.format(Number(item.amount))}` : ""}
                  </p>
                  {item.document.attachmentPath && (
                    <button
                      type="button"
                      onClick={() => void openAttachment(item)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {item.document.attachmentName || "Imagem anexada"}
                    </button>
                  )}
                </div>
                {link && !item.submitted_at && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      title="Copiar link"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => toast({ title: "Link copiado" }))
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      title="Abrir formulário"
                      onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive"
                  title="Excluir documento"
                  disabled={deletingHistoryId === item.id}
                  onClick={() => void deleteHistoryItem(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {history.isLoading && (
            <p className="text-xs text-muted-foreground">Carregando histórico…</p>
          )}
          {!history.isLoading && !history.data?.length && (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              Nenhum PDF ou formulário registrado ainda.
            </p>
          )}
          {!history.isLoading && !!history.data?.length && !visibleHistory.length && (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              Nenhum documento encontrado para este filtro.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
