import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CheckCircle2, Download, Eye, FileImage, FileText, Instagram, MessageCircle, Share2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PublicInvoice = {
  document_type: string;
  document_number: string | null;
  issue_date: string | null;
  issuer_name: string | null;
  issuer_document: string | null;
  description: string | null;
  amount: number | null;
};

type InvoiceForm = {
  issuerName: string;
  issuerDocument: string;
  customerName: string;
  customerDocument: string;
  customerAddress: string;
  description: string;
  amount: string;
  notes: string;
  authorization: string;
};

const emptyForm: InvoiceForm = {
  issuerName: "",
  issuerDocument: "",
  customerName: "",
  customerDocument: "",
  customerAddress: "",
  description: "",
  amount: "",
  notes: "",
  authorization: "",
};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const parseMoney = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

async function fileToPdfImage(file: File) {
  const bytes = await file.arrayBuffer();
  if (file.type === "image/jpeg") return { kind: "jpg" as const, bytes };
  if (file.type === "image/png") return { kind: "png" as const, bytes };

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível converter a imagem anexada."));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível converter a imagem anexada.");
    context.drawImage(image, 0, 0);
    const converted = await fetch(canvas.toDataURL("image/jpeg", 0.9)).then((response) => response.arrayBuffer());
    return { kind: "jpg" as const, bytes: converted };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PublicInvoiceForm() {
  const { token } = useParams();
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [generated, setGenerated] = useState<InvoiceForm | null>(null);
  const invoice = useQuery({
    queryKey: ["public-finance-invoice-form", token],
    enabled: !!token,
    retry: 1,
    queryFn: async (): Promise<PublicInvoice | null> => {
      const { data, error } = await (supabase as any).rpc("get_public_finance_invoice_form", {
        p_token: token,
      });
      if (error) throw error;
      return data as PublicInvoice | null;
    },
  });

  useEffect(() => {
    if (!invoice.data) return;
    setForm((current) => ({
      ...current,
      issuerName: current.issuerName || invoice.data!.issuer_name || "",
      issuerDocument: current.issuerDocument || invoice.data!.issuer_document || "",
      description: current.description || invoice.data!.description || "",
      amount:
        current.amount ||
        (invoice.data!.amount != null ? String(invoice.data!.amount).replace(".", ",") : ""),
    }));
  }, [invoice.data]);

  const submit = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(form.amount);
      if (
        !token ||
        !form.customerName.trim() ||
        !form.customerDocument.trim() ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        throw new Error("Preencha nome, CPF/CNPJ e valor corretamente.");
      }
      let attachmentPath: string | null = null;
      if (attachment) {
        if (
          !/^image\/(jpeg|png|webp)$/.test(attachment.type) ||
          attachment.size > 5 * 1024 * 1024
        ) {
          throw new Error("Envie uma imagem JPG, PNG ou WEBP de até 5 MB.");
        }
        const extension = attachment.name.split(".").pop()?.toLowerCase() || "jpg";
        attachmentPath = `${token}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("invoice-attachments")
          .upload(attachmentPath, attachment, { upsert: false, contentType: attachment.type });
        if (uploadError)
          throw new Error(`Não foi possível anexar a imagem: ${uploadError.message}`);
      }
      const { error } = await (supabase as any).rpc("submit_public_finance_invoice_form", {
        p_token: token,
        p_issuer_name: form.issuerName || null,
        p_issuer_document: form.issuerDocument || null,
        p_customer_name: form.customerName,
        p_customer_document: form.customerDocument,
        p_customer_email: null,
        p_customer_address: form.customerAddress || null,
        p_description: form.description || null,
        p_amount: amount,
        p_notes: form.notes || null,
        p_authorization: form.authorization || null,
        p_attachment_path: attachmentPath,
        p_attachment_name: attachment?.name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setGenerated({ ...form }),
  });

  function chooseAttachment(file: File | null) {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachment(file);
    setAttachmentPreview(file ? URL.createObjectURL(file) : "");
  }

  async function buildPdf() {
    if (!invoice.data || !generated) throw new Error("A nota ainda não está pronta.");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0.06, 0.06, 0.06);
    const muted = rgb(0.35, 0.35, 0.35);
    const border = rgb(0.84, 0.84, 0.84);
    const width = page.getWidth();
    const margin = 44;
    const wrap = (text: string, maxWidth: number, font = regular, size = 10) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else current = candidate;
      }
      if (current) lines.push(current);
      return lines;
    };
    const value = (label: string, content: string, x: number, boxY: number, boxWidth: number) => {
      page.drawText(label.toUpperCase(), { x, y: boxY - 18, font: bold, size: 7, color: muted });
      let textY = boxY - 36;
      const lines = (content || "Não informado")
        .split(/\r?\n/)
        .flatMap((part) => wrap(part || " ", boxWidth - 24, regular, 10));
      for (const item of lines.slice(0, 4)) {
        page.drawText(item, { x, y: textY, font: regular, size: 10, color: black });
        textY -= 14;
      }
    };

    // Fixed header coordinates prevent the brand/title overlap in PDF viewers.
    page.drawRectangle({ x: margin, y: 792, width: width - margin * 2, height: 2, color: black });
    page.drawText("GROWDASH", { x: margin, y: 768, font: bold, size: 10, color: black });
    page.drawText("NOTA FISCAL - PREVIA", { x: margin, y: 726, font: bold, size: 24, color: black });
    page.drawText(`Numero: ${invoice.data.document_number || "-"}`, { x: margin, y: 686, font: bold, size: 10, color: black });
    page.drawText(`Data: ${invoice.data.issue_date ? new Date(`${invoice.data.issue_date}T12:00:00`).toLocaleDateString("pt-BR") : "-"}`, { x: margin, y: 668, font: regular, size: 10, color: black });

    const cardTop = 632;
    const cardWidth = (width - margin * 2 - 16) / 2;
    page.drawRectangle({ x: margin, y: cardTop - 112, width: cardWidth, height: 112, borderColor: border, borderWidth: 1 });
    page.drawRectangle({ x: margin + cardWidth + 16, y: cardTop - 112, width: cardWidth, height: 112, borderColor: border, borderWidth: 1 });
    value("Emitente", `${generated.issuerName || "Não informado"}\n${generated.issuerDocument || "Documento não informado"}`, margin + 12, cardTop, cardWidth);
    value("Solicitante", [generated.customerName, generated.customerDocument, generated.customerAddress || "Endereço não informado"].join("\n"), margin + cardWidth + 28, cardTop, cardWidth);
    let y = cardTop - 136;
    page.drawRectangle({ x: margin, y: y - 174, width: width - margin * 2, height: 174, borderColor: border, borderWidth: 1 });
    value("Descrição", generated.description || "Não informada", margin + 12, y, width - margin * 2);
    value("Autorizado por", generated.authorization || "Não informado", margin + 12, y - 58, width - margin * 2);
    value("Observações", generated.notes || "-", margin + 12, y - 114, width - margin * 2);
    y -= 198;
    if (attachment) {
      const imageData = await fileToPdfImage(attachment);
      const embedded = imageData.kind === "png" ? await pdf.embedPng(imageData.bytes) : await pdf.embedJpg(imageData.bytes);
      const scale = Math.min((width - margin * 2) / embedded.width, 140 / embedded.height, 1);
      const imageWidth = embedded.width * scale;
      const imageHeight = embedded.height * scale;
      page.drawText("ANEXO", { x: margin, y, font: bold, size: 7, color: muted });
      y -= 12;
      page.drawImage(embedded, { x: margin, y: y - imageHeight, width: imageWidth, height: imageHeight });
      y -= imageHeight + 22;
    }
    page.drawLine({ start: { x: width - margin - 220, y }, end: { x: width - margin, y }, thickness: 1.5, color: black });
    page.drawText("TOTAL", { x: width - margin - 220, y: y - 20, font: bold, size: 13, color: black });
    page.drawText(money.format(parseMoney(generated.amount)), { x: width - margin - 118, y: y - 20, font: bold, size: 13, color: black });
    page.drawText("Esta e uma previa em PDF, nao uma NFS-e autorizada.", { x: margin, y: 42, font: regular, size: 8, color: muted });
    return pdf.save();
  }

  async function createPdfFile() {
    const bytes = await buildPdf();
    return new File([bytes], `nota-${invoice.data?.document_number || "growdash"}.pdf`, { type: "application/pdf" });
  }

  function downloadPdfFile(file: File) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function downloadPdf() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    // The popup is deliberately opened before PDF generation so mobile Safari/Chrome keeps it
    // associated with the user's tap instead of blocking it as an asynchronous popup.
    const previewWindow = isMobile ? window.open("", "_blank") : null;
    const file = await createPdfFile();
    if (!isMobile) {
      downloadPdfFile(file);
      toast.success("PDF baixado para o seu computador.");
      return;
    }
    if (!previewWindow) {
      downloadPdfFile(file);
      toast.info("O PDF foi salvo. Abra o app Arquivos/Downloads para compartilhar.");
      return;
    }
    previewWindow.opener = null;
    const url = URL.createObjectURL(file);
    previewWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    toast.info("Use o menu do PDF para salvar em Arquivos ou compartilhar.");
  }

  async function previewPdf() {
    const previewWindow = window.open("", "_blank");
    const file = await createPdfFile();
    if (!previewWindow) {
      downloadPdfFile(file);
      toast.info("O navegador bloqueou a prévia. O PDF foi baixado para você abrir.");
      return;
    }
    previewWindow.opener = null;
    const url = URL.createObjectURL(file);
    previewWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  }

  async function sharePdf() {
    const file = await createPdfFile();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Nota Growdash" });
      return;
    }
    downloadPdfFile(file);
    toast.info("Seu navegador não oferece compartilhamento de arquivos. O PDF foi baixado.");
  }

  async function shareOnWhatsApp() {
    const file = await createPdfFile();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Nota Growdash" });
      return;
    }
    downloadPdfFile(file);
    const message = `Olá! Segue a nota ${invoice.data?.document_number || "Growdash"}. O PDF foi baixado neste dispositivo para você anexar nesta conversa.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.info("O PDF foi baixado e o WhatsApp foi aberto. Anexe o arquivo na conversa.");
  }

  async function shareOnInstagram() {
    const file = await createPdfFile();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Nota Growdash" });
      return;
    }
    downloadPdfFile(file);
    toast.info("O Instagram no navegador não aceita anexar PDF diretamente. O arquivo foi baixado para envio pelo aplicativo, se disponível.");
  }

  function reportPdfError(error: unknown) {
    console.error("[public-invoice-pdf]", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido ao gerar o PDF.";
    toast.error(`Não foi possível gerar o PDF: ${message}`);
  }

  if (!token) return <Navigate to="/" replace />;
  if (invoice.isLoading)
    return (
      <PublicShell>
        <p className="text-sm text-muted-foreground">Carregando formulário…</p>
      </PublicShell>
    );
  if (invoice.isError || !invoice.data)
    return (
      <PublicShell>
        <FileText className="mx-auto h-9 w-9 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-black">Link indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link expirou, já foi utilizado ou não existe.
        </p>
      </PublicShell>
    );
  if (generated)
    return (
      <PublicShell>
        <div className="mx-auto max-w-xl text-left">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">
                Growdash
              </p>
              <h1 className="text-xl font-black">Nota pronta</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A nota foi salva no histórico financeiro. Visualize, baixe ou compartilhe o arquivo PDF.
          </p>
          <section className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Nota {invoice.data.document_number}
            </p>
            <h2 className="mt-2 text-lg font-black">{generated.customerName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {generated.description || "Serviço informado"}
            </p>
            <p className="mt-4 text-2xl font-black">{money.format(parseMoney(generated.amount))}</p>
            {attachmentPreview && (
              <img
                className="mt-4 max-h-64 w-full rounded-xl border border-border object-contain"
                src={attachmentPreview}
                alt="Anexo da nota"
              />
            )}
          </section>
          <Button className="mt-5 w-full" onClick={() => void downloadPdf().catch(reportPdfError)}>
            <Download className="mr-2 h-4 w-4" />
            Baixar PDF
          </Button>
          <Button variant="outline" className="mt-2 w-full" onClick={() => void previewPdf().catch(reportPdfError)}>
            <Eye className="mr-2 h-4 w-4" />
            Visualizar PDF
          </Button>
          <Button variant="outline" className="mt-2 w-full" onClick={() => void sharePdf().catch(reportPdfError)}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartilhar PDF
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void shareOnWhatsApp().catch(reportPdfError)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" onClick={() => void shareOnInstagram().catch(reportPdfError)}>
              <Instagram className="mr-2 h-4 w-4" />
              Instagram
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">No celular, o menu nativo mostra os aplicativos que aceitam PDF. No desktop, o WhatsApp abre com o arquivo baixado pronto para anexar.</p>
        </div>
      </PublicShell>
    );

  const invoiceDocument = invoice.data;
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl text-left">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">
              Growdash
            </p>
            <h1 className="text-xl font-black">Dados para nota fiscal</h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Preencha os dados da nota{" "}
          <b className="text-foreground">{invoiceDocument.document_number || "em preparação"}</b>. Este
          formulário não dá acesso à plataforma.
        </p>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate();
          }}
        >
          <Field label="Número da nota">
            <Input readOnly value={invoiceDocument.document_number || ""} />
          </Field>
          <Field label="Data">
            <Input
              readOnly
              value={
                invoiceDocument.issue_date
                  ? new Date(`${invoiceDocument.issue_date}T12:00:00`).toLocaleDateString("pt-BR")
                  : ""
              }
            />
          </Field>
          <Field label="Nome / razão social emitente">
            <Input value={form.issuerName} onChange={(event) => setForm({ ...form, issuerName: event.target.value })} placeholder="Razão social da empresa" />
          </Field>
          <Field label="CNPJ da empresa emitente">
            <Input inputMode="numeric" maxLength={18} value={form.issuerDocument} onChange={(event) => setForm({ ...form, issuerDocument: event.target.value })} placeholder="00.000.000/0001-00" />
          </Field>
          <Field label="Nome do solicitante">
            <Input
              required
              value={form.customerName}
              onChange={(event) => setForm({ ...form, customerName: event.target.value })}
            />
          </Field>
          <Field label="CPF ou CNPJ">
            <Input
              required
              value={form.customerDocument}
              onChange={(event) => setForm({ ...form, customerDocument: event.target.value })}
            />
          </Field>
          <Field label="Valor total">
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span><Input required inputMode="decimal" className="pl-10" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Endereço (opcional)">
              <Input
                value={form.customerAddress}
                onChange={(event) => setForm({ ...form, customerAddress: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Autorizado por">
              <Input value={form.authorization} onChange={(event) => setForm({ ...form, authorization: event.target.value })} placeholder="Nome de quem autorizou a nota" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descrição">
              <Textarea
                value={form.description}
            placeholder={invoiceDocument.description || "Descreva o serviço prestado"}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <Textarea
                value={form.notes}
                placeholder="Informações complementares (opcional)"
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Anexar imagem à nota (opcional)">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="max-w-xs"
                  onChange={(event) => chooseAttachment(event.target.files?.[0] || null)}
                />
                {attachment ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <FileImage className="h-4 w-4 text-primary" />
                    {attachment.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP · até 5 MB</span>
                )}
              </div>
              {attachmentPreview && (
                <img
                  className="mt-3 max-h-48 rounded-xl border border-border object-contain"
                  src={attachmentPreview}
                  alt="Prévia do anexo"
                />
              )}
            </Field>
          </div>
          {submit.error && (
            <p className="sm:col-span-2 text-sm text-destructive">
              {submit.error instanceof Error
                ? submit.error.message
                : "Não foi possível gerar a nota. Tente novamente."}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button className="w-full" type="submit" disabled={submit.isPending}>
              {submit.isPending ? (
                "Gerando nota…"
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Gerar nota
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-center">
      <section className="w-full max-w-5xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        {children}
        <p className="mt-7 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Dados enviados exclusivamente para o documento solicitado.
        </p>
        <Link to="/auth" className="mt-4 inline-block text-xs font-semibold text-primary">
          Growdash
        </Link>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-left text-xs font-bold">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
