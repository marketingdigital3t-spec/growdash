import { useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import {
  useRDFunnels, useCreateRDFunnel, useUpdateRDFunnel, useDeleteRDFunnel, type RDFunnel,
} from "@/hooks/useRDFunnels";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Filter as Funnel, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface RDPipeline { id: string; name: string }

function useRDApiFunnels(enabled: boolean) {
  return useQuery({
    queryKey: ["rd_api_funnels"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-list-funnels", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.pipelines || []) as RDPipeline[];
    },
  });
}

function LinkFunnelDialog({
  accountId, open, onOpenChange,
}: { accountId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const create = useCreateRDFunnel();
  const { data: pipelines = [], isLoading, error } = useRDApiFunnels(open);
  const [pipelineId, setPipelineId] = useState("");

  const selected = pipelines.find((p) => p.id === pipelineId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular funil do RD Station</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="text-sm text-destructive">
            {(error as Error).message}. Configure o token no card acima.
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando funis do RD...</p>
        ) : (
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger><SelectValue placeholder="Escolha um funil" /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!selected || create.isPending}
            onClick={async () => {
              if (!selected) return;
              await create.mutateAsync({
                ad_account_id: accountId,
                name: selected.name,
                expert_name: null,
                rd_funnel_id: selected.id,
                utm_campaign_pattern: null,
              });
              toast({ title: "Funil vinculado!" });
              onOpenChange(false);
              setPipelineId("");
            }}
          >
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FunnelRow({ funnel }: { funnel: RDFunnel }) {
  const { toast } = useToast();
  const update = useUpdateRDFunnel();
  const remove = useDeleteRDFunnel();
  const linked = !!funnel.rd_funnel_id;

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
        body: { funnel_id: funnel.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast({
        title: "Sincronizado!",
        description: `${d.created} novas, ${d.updated} atualizadas, ${d.skipped} ignoradas`,
      });
    },
    onError: (e: any) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 gap-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{funnel.name}</p>
          {linked ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Vinculado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" /> Sem vínculo
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {linked ? `RD ID: ${funnel.rd_funnel_id}` : "Edite para vincular a um funil real"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={!linked || sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "..." : "Sincronizar"}
        </Button>
        <Switch
          checked={funnel.is_active}
          onCheckedChange={(v) => update.mutate({ id: funnel.id, is_active: v })}
        />
        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(funnel.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function AccountFunnelsBlock({ accountId, accountName }: { accountId: string; accountName: string }) {
  const { data: funnels = [] } = useRDFunnels(accountId);
  const [openLink, setOpenLink] = useState(false);

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-sm">{accountName}</p>
          <p className="text-xs text-muted-foreground">
            {funnels.length === 0
              ? "Nenhum funil vinculado"
              : `${funnels.length} funil${funnels.length > 1 ? "is" : ""} vinculado${funnels.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpenLink(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Vincular funil do RD
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {funnels.map((f) => <FunnelRow key={f.id} funnel={f} />)}
      </AnimatePresence>

      <LinkFunnelDialog accountId={accountId} open={openLink} onOpenChange={setOpenLink} />
    </div>
  );
}

export function RDFunnelsSection() {
  const { data: accounts = [] } = useAdAccounts();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Funnel className="h-5 w-5" /> Funis RD por conta
        </CardTitle>
        <CardDescription>
          Vincule funis reais do RD Station a cada conta Meta. Use "Sincronizar" para puxar as vendas
          ganhas daquele funil para o painel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <HowToSyncSteps
          steps={[
            { title: "Conecte o RD Station CRM acima", detail: "Cole o token da API do RD para liberar a lista de funis reais." },
            { title: "Clique em 'Vincular funil do RD' em cada conta Meta", detail: "Escolha o funil do RD que representa as vendas daquela conta de anúncio." },
            { title: "Ative o funil no switch ao lado", detail: "Funis inativos não trazem vendas para o painel." },
            { title: "Clique em 'Sincronizar' para puxar as vendas ganhas", detail: "O primeiro sync pode levar alguns minutos dependendo do volume." },
            { title: "Confira o resultado em Diagnóstico RD ↔ Campanhas", detail: "Use o card abaixo para verificar se os números batem." },
          ]}
        />
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Adicione uma conta Meta acima primeiro.</p>
        ) : (
          accounts.map((acc) => (
            <AccountFunnelsBlock key={acc.id} accountId={acc.id} accountName={acc.name} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
