import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { useLeadsAudit, type AuditLead } from "@/hooks/useLeadsAudit";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId?: string;
  startDate: Date;
  endDate: Date;
}

const SOURCE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  rd_contact: "default",
  ddd_phone: "secondary",
  rd_custom_field: "outline",
  form_answer: "default",
  manual: "outline",
  unknown: "destructive",
};

function toCSV(rows: AuditLead[]) {
  const head = ["Nome", "Telefone", "UF", "Estado bruto (RD)", "Critério", "Detalhe", "Data"];
  const body = rows.map((r) => [
    r.name,
    r.phone || "",
    r.uf || "",
    r.raw_state || "",
    r.source,
    r.source_detail,
    r.created_at,
  ]);
  return [head, ...body]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function LeadsAuditSheet({ open, onOpenChange, adAccountId, startDate, endDate }: Props) {
  const { data, isLoading } = useLeadsAudit({ adAccountId, startDate, endDate });
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const all = data || [];
  const ufs = useMemo(() => {
    const set = new Set<string>();
    all.forEach((r) => r.uf && set.add(r.uf));
    return Array.from(set).sort();
  }, [all]);
  const sources = useMemo(() => {
    const set = new Set<string>();
    all.forEach((r) => set.add(r.source));
    return Array.from(set);
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (ufFilter !== "all" && r.uf !== ufFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(s) &&
          !(r.phone || "").toLowerCase().includes(s) &&
          !(r.uf || "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [all, ufFilter, sourceFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.forEach((r) => (c[r.source] = (c[r.source] || 0) + 1));
    return c;
  }, [filtered]);

  function download() {
    const blob = new Blob([toCSV(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-leads-${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Auditoria de leads por estado</SheetTitle>
          <SheetDescription>
            {isLoading
              ? "Carregando..."
              : `${filtered.length} de ${all.length} leads — verifica nome, telefone, UF e o critério usado para definir o estado.`}
          </SheetDescription>
        </SheetHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone, UF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-9 text-xs"
            />
          </div>
          <Select value={ufFilter} onValueChange={setUfFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as UFs</SelectItem>
              {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Critério" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os critérios</SelectItem>
              {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo de critérios */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(counts).map(([s, n]) => (
            <Badge key={s} variant={SOURCE_VARIANT[s] || "outline"} className="text-[10px]">
              {s}: {n}
            </Badge>
          ))}
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={download}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>

        {/* Tabela */}
        <div className="mt-3 border rounded-md overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 px-2 font-medium">Nome</th>
                  <th className="py-2 px-2 font-medium">Telefone</th>
                  <th className="py-2 px-2 font-medium">UF</th>
                  <th className="py-2 px-2 font-medium">Critério</th>
                  <th className="py-2 px-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="py-1.5 px-2 max-w-[180px] truncate" title={r.name}>{r.name}</td>
                    <td className="py-1.5 px-2 tabular-nums text-muted-foreground">{r.phone || "—"}</td>
                    <td className="py-1.5 px-2 font-semibold">{r.uf || "—"}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant={SOURCE_VARIANT[r.source] || "outline"} className="text-[10px] font-normal">
                        {r.source_detail}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                      {r.created_at ? format(parseISO(r.created_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoading && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Nenhum lead nos filtros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
