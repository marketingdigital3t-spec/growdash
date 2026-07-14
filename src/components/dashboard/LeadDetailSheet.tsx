import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, User, Mail, MapPin, Calendar, Tag, Briefcase } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadDealAttribution } from "@/lib/leadAttribution";

interface Props {
  entry: LeadDealAttribution | null;
  onClose: () => void;
}

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return format(parseISO(s), "dd 'de' MMM yyyy 'às' HH:mm", { locale: ptBR }); } catch { return s; }
};

const FAILURE_LABEL: Record<string, string> = {
  no_utm_campaign: "Sem utm_campaign",
  campaign_not_found: "Campanha não encontrada no período",
  account_no_insights: "Conta sem insights no período",
};

export function LeadDetailSheet({ entry, onClose }: Props) {
  const open = !!entry;
  const deal = entry?.deal;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {entry && deal && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {deal.contact_name || "Lead sem nome"}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant={entry.bucket === "won" ? "default" : entry.bucket === "disqualified" ? "secondary" : entry.bucket === "lost" ? "destructive" : "outline"}>
                  {entry.bucket === "won" ? "Ganho" : entry.bucket === "qualified" ? "Qualificado" : entry.bucket === "disqualified" ? "Desqualificado" : entry.bucket === "lost" ? "Perdido" : "Em aberto"}
                </Badge>
                <span className="text-xs">{deal.rd_stage_name}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4 text-sm">
              <Section title="Contato">
                <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={deal.contact_email} />
                <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Local" value={[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || null} />
                <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Criado em" value={fmtDate(deal.lead_created_at)} />
                <Row icon={<Briefcase className="h-3.5 w-3.5" />} label="Responsável" value={deal.deal_owner_name} />
              </Section>

              <Section title="UTMs recebidos">
                <Row label="utm_source" value={deal.utm_source} mono />
                <Row label="utm_medium" value={deal.utm_medium} mono />
                <Row label="utm_campaign" value={deal.utm_campaign || deal.last_touch_utm_campaign || deal.first_touch_utm_campaign} mono />
                <Row label="utm_term" value={deal.utm_term} mono />
                <Row label="utm_content" value={deal.utm_content} mono />
              </Section>

              <Section title="Atribuição">
                {entry.campaign_id ? (
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-green-500 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Atribuído
                    </div>
                    <Row icon={<Tag className="h-3.5 w-3.5" />} label="Campanha" value={entry.campaign_name} />
                    {entry.adset_id && <Row label="Conjunto" value={entry.adset_id} />}
                    {entry.ad_id && <Row label="Criativo (ad_id)" value={entry.ad_id} mono />}
                  </div>
                ) : (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-yellow-500 font-medium">
                      <AlertCircle className="h-4 w-4" /> Não atribuído
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Motivo: </span>
                      {FAILURE_LABEL[entry.failure_reason ?? ""] ?? "Desconhecido"}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.failure_detail}</p>
                  </div>
                )}
              </Section>

              {deal.lost_reason && (
                <Section title="Motivo de perda">
                  <p className="text-xs text-muted-foreground">{deal.lost_reason}</p>
                </Section>
              )}

              {deal.rd_product_name && (
                <Section title="Produto / Curso">
                  <p className="text-xs">{deal.rd_product_name}</p>
                </Section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <span className="text-muted-foreground min-w-[110px]">{label}</span>
      <span className={mono ? "font-mono break-all" : "break-all"}>{value || "—"}</span>
    </div>
  );
}
