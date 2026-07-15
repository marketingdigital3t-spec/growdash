import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import type { LeadDealAttribution } from "@/lib/leadAttribution";
import { useState } from "react";
import { LeadDetailSheet } from "./LeadDetailSheet";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignName: string;
  deals: LeadDealAttribution[];
}

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return s.slice(0, 10); }
};

const bucketBadge = (bucket: string) => {
  if (bucket === "won") return <Badge variant="default" className="text-[10px]">Ganho</Badge>;
  if (bucket === "disqualified") return <Badge variant="secondary" className="text-[10px]">Desqualif.</Badge>;
  if (bucket === "lost") return <Badge variant="destructive" className="text-[10px]">Perdido</Badge>;
  if (bucket === "qualified") return <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500">Qualif.</Badge>;
  return <Badge variant="outline" className="text-[10px]">Aberto</Badge>;
};

export function CampaignLeadsSheet({ open, onClose, campaignName, deals }: Props) {
  const [search, setSearch] = useState("");
  const [openLead, setOpenLead] = useState<LeadDealAttribution | null>(null);

  const filtered = deals.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (e.deal.contact_name || "").toLowerCase().includes(s) ||
      (e.deal.contact_email || "").toLowerCase().includes(s) ||
      (e.deal.rd_stage_name || "").toLowerCase().includes(s)
    );
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full max-w-[100vw] overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="truncate">{campaignName}</SheetTitle>
            <SheetDescription>{deals.length} lead{deals.length === 1 ? "" : "s"} atribuído{deals.length === 1 ? "" : "s"} a esta campanha</SheetDescription>
          </SheetHeader>

          <div className="mt-4 relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, email, etapa..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nome</th>
                  <th className="px-2 py-2 font-medium">Etapa</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">Nenhum lead.</td></tr>
                ) : filtered.map((e) => (
                  <tr key={e.deal.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setOpenLead(e)}>
                    <td className="px-2 py-2 font-medium truncate max-w-[200px]">{e.deal.contact_name || e.deal.contact_email || "—"}</td>
                    <td className="px-2 py-2 truncate max-w-[160px]">{e.deal.rd_stage_name || "—"}</td>
                    <td className="px-2 py-2">{bucketBadge(e.bucket)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{fmtDate(e.deal.lead_created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetContent>
      </Sheet>

      <LeadDetailSheet entry={openLead} onClose={() => setOpenLead(null)} />
    </>
  );
}
