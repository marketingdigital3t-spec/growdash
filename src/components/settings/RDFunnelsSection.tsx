import { useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import {
  useRDFunnels, useCreateRDFunnel, useUpdateRDFunnel, useDeleteRDFunnel, type RDFunnel,
} from "@/hooks/useRDFunnels";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Filter as Funnel, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DestructiveConfirmationDialog } from "@/components/DestructiveConfirmationDialog";
import { useRDAccountConnections } from "@/hooks/useRDAccountConnections";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

interface RDPipeline { id: string; name: string }

function useRDApiFunnels(enabled: boolean, rdConnectionId?: string) {
  return useQuery({
    queryKey: ["rd_api_funnels", rdConnectionId ?? "none"],
    enabled: enabled && !!rdConnectionId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-list-funnels", { body: { rd_connection_id: rdConnectionId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.pipelines || []) as RDPipeline[];
    },
  });
}

function LinkFunnelDialog({
  accountId, open, onOpenChange, rdConnectionId,
}: { accountId: string | null; open: boolean; onOpenChange: (o: boolean) => void; rdConnectionId?: string }) {
  const { toast } = useToast();
  const create = useCreateRDFunnel();
  const { data: connections = [] } = useRDAccountConnections();
  const [selectedConnectionId, setSelectedConnectionId] = useState(rdConnectionId || "");
  const { data: pipelines = [], isLoading, error } = useRDApiFunnels(open, selectedConnectionId);
  const [pipelineId, setPipelineId] = useState("");

  const selected = pipelines.find((p) => p.id === pipelineId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular funil do RD Station</DialogTitle>
        </DialogHeader>
        <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
          <SelectTrigger><SelectValue placeholder="Escolha a conexão RD" /></SelectTrigger>
          <SelectContent>{connections.map((connection) => <SelectItem key={connection.id} value={connection.id}>{connection.account_name} · {connection.status}</SelectItem>)}</SelectContent>
        </Select>
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
            disabled={!selected || !selectedConnectionId || create.isPending}
            onClick={async () => {
              if (!selected) return;
              await create.mutateAsync({
                ad_account_id: accountId,
                rd_connection_id: selectedConnectionId,
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
  const queryClient = useQueryClient();
  const update = useUpdateRDFunnel();
  const remove = useDeleteRDFunnel();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const linked = !!funnel.rd_funnel_id;

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
        body: {
          funnel_id: funnel.id,
          // A manual action must mirror the complete RD pipeline, including
          // open, won, lost and paused deals. The incremental path only
          // refreshes a small recent window and made this screen look empty
          // or incomplete compared with RD.
          analytics_mode: true,
          full_history: true,
          refresh_amounts: true,
          trigger_source: "funnel_settings_manual",
        },
      });
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, `Não foi possível sincronizar o funil ${funnel.name}.`));
      if (data?.error || data?.success === false || data?.partial || data?.status === "partial") {
        throw new Error(data?.error || `Sincronização incompleta: ${data?.pages_processed ?? 0} páginas processadas, ${data?.snapshot_missing_ids?.length ?? 0} IDs ausentes.`);
      }
      return data;
    },
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
      void queryClient.invalidateQueries({ queryKey: ["rd_latest_sync"] });
      void queryClient.invalidateQueries({ queryKey: ["rd_health_check"] });
      toast({
        title: "Funil sincronizado com o RD",
        description: `${d.deals ?? 0} negócios verificados · ${d.pages_processed ?? 0} páginas · ${d.created ?? 0} novos · ${d.updated ?? 0} atualizados`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro ao sincronizar", description: e.message || "A sincronização falhou.", variant: "destructive" }),
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
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)} title={`Excluir vínculo ${funnel.name}`} aria-label={`Excluir vínculo ${funnel.name}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <DestructiveConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir vínculo do funil"
        description="A Growdash deixará de sincronizar este funil do RD Station. O funil real dentro do RD não será apagado."
        confirmation={funnel.name}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(funnel.id, {
          onSuccess: () => {
            setDeleteOpen(false);
            toast({ title: "Vínculo do funil removido" });
          },
          onError: (error: Error) => toast({ title: "Erro ao excluir vínculo", description: error.message, variant: "destructive" }),
        })}
      />
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

function RDOnlyFunnelsBlock({ connectionId, accountName, funnels }: { connectionId: string; accountName: string; funnels: RDFunnel[] }) {
  const [openLink, setOpenLink] = useState(false);
  return <div className="rounded-lg border border-dashed p-3 space-y-3"><div className="flex items-center justify-between gap-2"><div><p className="font-medium text-sm">{accountName}</p><p className="text-xs text-muted-foreground">Funis RD sem vínculo Meta · {funnels.length}</p></div><Button size="sm" variant="outline" onClick={() => setOpenLink(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Vincular funil</Button></div>{funnels.map((funnel) => <FunnelRow key={funnel.id} funnel={funnel} />)}<LinkFunnelDialog accountId={null} rdConnectionId={connectionId} open={openLink} onOpenChange={setOpenLink} /></div>;
}

export function RDFunnelsSection() {
  const { data: accounts = [] } = useAdAccounts();
  const { data: allFunnels = [] } = useRDFunnels(undefined, true);
  const { data: connections = [] } = useRDAccountConnections();

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
        {accounts.length === 0 && connections.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta ou conexão RD autorizada.</p> : (
          <>
          {accounts.map((acc) => (
            <AccountFunnelsBlock key={acc.id} accountId={acc.id} accountName={acc.name} />
          ))}
          {connections.map((connection) => {
            const rdOnlyFunnels = allFunnels.filter((funnel) => funnel.rd_connection_id === connection.id && !funnel.ad_account_id);
            return <RDOnlyFunnelsBlock key={`rd-${connection.id}`} connectionId={connection.id} accountName={connection.account_name} funnels={rdOnlyFunnels} />;
          })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
