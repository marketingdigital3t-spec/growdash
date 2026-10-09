import { useState } from "react";
import {
  useRDFunnels, useCreateRDFunnel, useUpdateRDFunnel, useDeleteRDFunnel, useImportRDFunnels, type RDFunnel,
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
  open, onOpenChange, rdConnectionId,
}: { open: boolean; onOpenChange: (o: boolean) => void; rdConnectionId?: string }) {
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
                ad_account_id: null,
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

function FunnelRow({ funnel, activationBlocked = false }: { funnel: RDFunnel; activationBlocked?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const update = useUpdateRDFunnel();
  const remove = useDeleteRDFunnel();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const linked = !!funnel.rd_funnel_id;
  const toggleActive = (value: boolean) => update.mutate({ id: funnel.id, is_active: value }, {
    onSuccess: () => toast({
      title: value ? "Funil ativado" : "Funil desativado",
      description: value
        ? "O funil voltará a aparecer nas abas e no ciclo de sincronização."
        : "O funil foi ocultado das abas e não será sincronizado.",
    }),
    onError: (error: Error) => toast({ title: "Não foi possível alterar o funil", description: error.message, variant: "destructive" }),
  });

  const toggleDisabled = update.isPending || (activationBlocked && !funnel.is_active);

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
          disabled={toggleDisabled}
          onCheckedChange={(value) => {
            if (activationBlocked && !funnel.is_active) {
              toast({ title: "Funil já ativo", description: "Este funil do RD já está ativo em outra conexão. O vínculo ativo atual foi preservado." });
              return;
            }
            toggleActive(value);
          }}
          aria-label={activationBlocked && !funnel.is_active ? `Funil ${funnel.name} já está ativo em outra conexão` : `${funnel.is_active ? "Desativar" : "Ativar"} funil ${funnel.name}`}
        />
        <span className={`text-[10px] font-black uppercase ${funnel.is_active ? "text-emerald-600" : activationBlocked ? "text-amber-600" : "text-muted-foreground"}`}>{funnel.is_active ? "Ativo" : activationBlocked ? "Ativo em outra conexão" : "Desativado"}</span>
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

function RDConnectionFunnelsBlock({ connectionId, accountName, funnels, activePipelineIds }: { connectionId: string; accountName: string; funnels: RDFunnel[]; activePipelineIds: Set<string> }) {
  const [openLink, setOpenLink] = useState(false);
  const { data: pipelines = [], isLoading, error } = useRDApiFunnels(true, connectionId);
  const importFunnels = useImportRDFunnels();
  const { toast } = useToast();
  const importedCount = funnels.length;
  return <div className="rounded-lg border p-3 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div><p className="font-medium text-sm">{accountName}</p><p className="text-xs text-muted-foreground">{importedCount} funil(is) carregado(s) · ativação independente da Meta</p></div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={isLoading || !!error || importFunnels.isPending} onClick={() => importFunnels.mutate({ connectionId, pipelines }, { onSuccess: (result) => toast({ title: "Funis RD carregados", description: `${result.imported} novos funis importados de ${result.total} disponíveis.` }), onError: (importError: Error) => toast({ title: "Erro ao carregar funis", description: importError.message, variant: "destructive" }) })}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${importFunnels.isPending ? "animate-spin" : ""}`} /> {importFunnels.isPending ? "Carregando…" : "Carregar todos os funis"}
        </Button>
        <Button size="sm" onClick={() => setOpenLink(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar funil</Button>
      </div>
    </div>
    {error && <p className="text-xs text-destructive">Não foi possível consultar os funis desta conexão RD.</p>}
    <AnimatePresence mode="popLayout">{funnels.map((funnel) => <FunnelRow key={funnel.id} funnel={funnel} activationBlocked={!!funnel.rd_funnel_id && activePipelineIds.has(funnel.rd_funnel_id) && !funnel.is_active} />)}</AnimatePresence>
    {!funnels.length && !isLoading && <p className="text-sm text-muted-foreground">Nenhum funil carregado. Use “Carregar todos os funis”.</p>}
    <LinkFunnelDialog rdConnectionId={connectionId} open={openLink} onOpenChange={setOpenLink} />
  </div>;
}

function OrphanFunnelsBlock({ funnels, activePipelineIds }: { funnels: RDFunnel[]; activePipelineIds: Set<string> }) {
  return <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
    <div>
      <p className="font-medium text-sm">Funis RD cadastrados</p>
      <p className="text-xs text-muted-foreground">A conexão não foi listada nesta consulta, mas o vínculo permanece disponível para ativação ou desativação.</p>
    </div>
    <AnimatePresence mode="popLayout">{funnels.map((funnel) => <FunnelRow key={funnel.id} funnel={funnel} activationBlocked={!!funnel.rd_funnel_id && activePipelineIds.has(funnel.rd_funnel_id) && !funnel.is_active} />)}</AnimatePresence>
  </div>;
}

export function RDFunnelsSection() {
  const { data: allFunnels = [] } = useRDFunnels(undefined, true);
  const { data: connections = [] } = useRDAccountConnections();
  const listedConnectionIds = new Set(connections.map((connection) => connection.id));
  const orphanFunnels = allFunnels.filter((funnel) => !funnel.rd_connection_id || !listedConnectionIds.has(funnel.rd_connection_id));
  const activePipelineIds = new Set(allFunnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id).map((funnel) => funnel.rd_funnel_id!));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Funnel className="h-5 w-5" /> Funis RD
        </CardTitle>
        <CardDescription>
          Todos os funis do RD Station ficam disponíveis aqui. Ative ou desative cada funil sem vínculo com contas Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connections.length === 0 && !allFunnels.length ? <p className="text-sm text-muted-foreground">Nenhuma conexão RD autorizada.</p> : connections.map((connection) => {
          const connectionFunnels = allFunnels.filter((funnel) => funnel.rd_connection_id === connection.id);
          return <RDConnectionFunnelsBlock key={`rd-${connection.id}`} connectionId={connection.id} accountName={connection.account_name} funnels={connectionFunnels} activePipelineIds={activePipelineIds} />;
        })}
        {orphanFunnels.length > 0 && <OrphanFunnelsBlock funnels={orphanFunnels} activePipelineIds={activePipelineIds} />}
      </CardContent>
    </Card>
  );
}
