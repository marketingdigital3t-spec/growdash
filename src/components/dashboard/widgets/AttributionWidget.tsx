import { useState } from "react";
import { useAttribution, type AttributionModel } from "@/hooks/useAttribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AttributionWidget() {
  const [model, setModel] = useState<AttributionModel>("last");
  const { data = [], isLoading } = useAttribution(model);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [backfilling, setBackfilling] = useState(false);

  async function runBackfill() {
    setBackfilling(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("rd-backfill-touches", { body: {} });
      if (error) throw error;
      toast({
        title: "Backfill concluído",
        description: `${res?.deals_processed ?? 0} deals processados, ${res?.touches_inserted ?? 0} toques registrados.`,
      });
      qc.invalidateQueries({ queryKey: ["attribution"] });
    } catch (e: any) {
      toast({ title: "Erro no backfill", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  }

  const totalSales = data.reduce((s, r) => s + r.sales_credit, 0);
  const totalRevenue = data.reduce((s, r) => s + r.revenue_credit, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">Atribuição por campanha</CardTitle>
        <div className="flex items-center gap-2">
          <Tabs value={model} onValueChange={(v) => setModel(v as AttributionModel)}>
            <TabsList className="h-8">
              <TabsTrigger value="first" className="text-xs h-6">First</TabsTrigger>
              <TabsTrigger value="last" className="text-xs h-6">Last</TabsTrigger>
              <TabsTrigger value="linear" className="text-xs h-6">Linear</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="ghost" onClick={runBackfill} disabled={backfilling} title="Reprocessar histórico de toques">
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhum toque registrado no período. Clique em <RefreshCw className="inline h-3 w-3 mx-1" />
            para fazer backfill do histórico.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Vendas (crédito)</TableHead>
                <TableHead className="text-right">Receita atribuída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.campaign_label}</TableCell>
                  <TableCell className="text-right">{row.sales_credit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(row.revenue_credit)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/30">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totalSales.toFixed(2)}</TableCell>
                <TableCell className="text-right">{fmtMoney(totalRevenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
