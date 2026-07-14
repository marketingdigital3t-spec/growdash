import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  DatabaseZap,
  Facebook,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeading } from "./shared";
import { cn } from "@/lib/utils";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useMetaOAuth } from "@/hooks/useMetaOAuth";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RDIntegrationCard } from "@/components/settings/RDIntegrationCard";

type StatusTone = "connected" | "warning" | "available";

interface IntegrationCardData {
  id: "meta" | "rd" | "google-ads" | "drive";
  name: string;
  description: string;
  status: string;
  tone: StatusTone;
  resources: string;
  synced: string;
}

const logos: Record<IntegrationCardData["id"], { label: string; className: string }> = {
  meta: { label: "f", className: "bg-[#eaf1ff] text-[#2469da]" },
  rd: { label: "RD", className: "bg-[#f7eed5] text-[#8b6815]" },
  "google-ads": { label: "G", className: "bg-[#e9f6ee] text-[#287847]" },
  drive: { label: "△", className: "bg-[#fff4d8] text-[#9b7416]" },
};

function relativeDate(value?: string | null) {
  if (!value) return "ainda não sincronizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
}

function statusIcon(tone: StatusTone) {
  if (tone === "connected") return <CheckCircle2 className="h-5 w-5 text-[#43845a]" />;
  if (tone === "warning") return <TriangleAlert className="h-5 w-5 text-[#c49118]" />;
  return <Cloud className="h-5 w-5 text-[#9a938b]" />;
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [rdDialogOpen, setRDDialogOpen] = useState(false);

  const { data: adAccounts = [], isLoading: loadingMeta } = useAdAccounts();
  const { data: rdIntegration, isLoading: loadingRD } = useRDIntegration();
  const { data: rdFunnels = [] } = useRDFunnels();
  const connectMeta = useMetaOAuth();
  const syncMeta = useSyncMeta();

  const { data: latestRDDeal } = useQuery({
    queryKey: ["rd_latest_sync"],
    enabled: !!rdIntegration?.is_active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_deals")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const metaConnected = adAccounts.length > 0;
  const metaHasWarning = adAccounts.some((account) =>
    account.connection_status === "error" || account.connection_status === "expired" || !!account.last_sync_error,
  );
  const rdConnected = !!rdIntegration?.is_active;
  const activeRDFunnels = rdFunnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id);

  const latestMetaSync = useMemo(() => {
    const dates = adAccounts
      .map((account) => account.last_sync_success_at)
      .filter((value): value is string => !!value)
      .sort();
    return dates.at(-1) ?? null;
  }, [adAccounts]);

  const cards: IntegrationCardData[] = [
    {
      id: "meta",
      name: "Meta Ads",
      description: "Conecte o Facebook com OAuth oficial e importe todas as contas de anúncio disponíveis para campanhas, métricas e saldo.",
      status: loadingMeta ? "Verificando" : metaHasWarning ? "Atenção" : metaConnected ? "Conectado" : "Disponível",
      tone: metaHasWarning ? "warning" : metaConnected ? "connected" : "available",
      resources: loadingMeta ? "—" : `${adAccounts.length} conta${adAccounts.length === 1 ? "" : "s"}`,
      synced: relativeDate(latestMetaSync),
    },
    {
      id: "rd",
      name: "RD Station CRM",
      description: "Conecte a API do RD CRM para importar funis, etapas, negociações, vendas, receita e origem dos leads.",
      status: loadingRD ? "Verificando" : rdConnected ? "Conectado" : "Disponível",
      tone: rdConnected ? "connected" : "available",
      resources: loadingRD ? "—" : `${activeRDFunnels.length} ${activeRDFunnels.length === 1 ? "funil vinculado" : "funis vinculados"}`,
      synced: relativeDate(latestRDDeal?.updated_at ?? rdIntegration?.updated_at),
    },
    {
      id: "google-ads",
      name: "Google Ads",
      description: "Campanhas de pesquisa, display, vídeo, conversões e orçamento.",
      status: "Em breve",
      tone: "available",
      resources: "—",
      synced: "não conectado",
    },
    {
      id: "drive",
      name: "Google Drive",
      description: "Arquivos, relatórios exportados e materiais compartilhados por marca.",
      status: "Em breve",
      tone: "available",
      resources: "—",
      synced: "não conectado",
    },
  ];

  const syncAll = useMutation({
    mutationFn: async () => {
      if (!metaConnected && !rdConnected) throw new Error("Conecte pelo menos uma integração antes de sincronizar.");

      let rdSynced = 0;
      if (metaConnected) {
        await syncMeta.mutateAsync({
          startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
          endDate: format(new Date(), "yyyy-MM-dd"),
        });
      }

      if (rdConnected) {
        for (const funnel of activeRDFunnels) {
          const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
            body: { funnel_id: funnel.id },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          rdSynced += Number(data?.created ?? 0) + Number(data?.updated ?? 0);
        }
      }

      return { rdSynced };
    },
    onSuccess: ({ rdSynced }) => {
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["rd_latest_sync"] });
      queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
      toast({
        title: "Integrações sincronizadas",
        description: rdConnected
          ? `${rdSynced} registros do RD atualizados, além dos dados disponíveis da Meta.`
          : "Os dados disponíveis da Meta foram atualizados.",
      });
    },
    onError: (error: Error) => toast({
      title: "Não foi possível sincronizar tudo",
      description: error.message,
      variant: "destructive",
    }),
  });

  const openIntegration = (id: IntegrationCardData["id"]) => {
    if (id === "meta") {
      connectMeta.mutate();
      return;
    }
    if (id === "rd") {
      setRDDialogOpen(true);
      return;
    }
    setNotice("Esta integração está no roadmap e ainda não está disponível nesta versão.");
  };

  const openData = (id: IntegrationCardData["id"]) => {
    if (id === "meta") navigate("/campanhas");
    else if (id === "rd") navigate("/analise-de-funis");
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Administração"
        title="Integrações"
        description="Conecte suas fontes para transformar mídia, CRM e arquivos em uma visão única da operação."
        actions={(
          <button
            className="gd-button"
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending || syncMeta.isPending || (!metaConnected && !rdConnected)}
          >
            <RefreshCw className={cn("h-4 w-4", syncAll.isPending && "animate-spin")} />
            {syncAll.isPending ? "Sincronizando..." : "Sincronizar tudo"}
          </button>
        )}
      />

      {notice && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#dfc068] bg-[#fff8df] p-4 text-xs text-[#6c5920]">
          <DatabaseZap className="h-4 w-4" />
          <span className="grow">{notice}</span>
          <button onClick={() => setNotice(null)} className="font-black">Fechar</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((integration) => {
          const logo = logos[integration.id];
          return (
            <article key={integration.id} className="gd-panel overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black", logo.className)}>
                  {logo.label}
                </span>
                <div className="min-w-0 grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{integration.name}</h2>
                    <span className={cn(
                      "rounded-full px-2 py-1 text-[8px] font-black uppercase",
                      integration.tone === "connected" && "bg-[#e7f4eb] text-[#39764d]",
                      integration.tone === "warning" && "bg-[#fff0cd] text-[#946a0f]",
                      integration.tone === "available" && "bg-[#efedeb] text-[#736c65]",
                    )}>
                      {integration.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#77716a]">{integration.description}</p>
                </div>
                {statusIcon(integration.tone)}
              </div>

              <div className="grid grid-cols-2 border-y border-[#ebe7e1] bg-[#faf9f7] text-[10px]">
                <div className="border-r border-[#ebe7e1] p-3">
                  <span className="block text-[#8b847c]">Recursos</span>
                  <b>{integration.resources}</b>
                </div>
                <div className="p-3">
                  <span className="block text-[#8b847c]">Última sincronização</span>
                  <b>{integration.synced}</b>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 p-3">
                <button
                  onClick={() => openIntegration(integration.id)}
                  disabled={(integration.id === "meta" && connectMeta.isPending) || loadingMeta || loadingRD}
                  className={integration.tone === "connected" ? "gd-button" : "gold-action"}
                >
                  {integration.id === "meta" ? <Facebook className="h-3.5 w-3.5" /> : integration.tone === "connected" ? <Settings2 className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                  {integration.id === "meta"
                    ? connectMeta.isPending ? "Abrindo Meta..." : metaConnected ? "Adicionar conta Meta" : "Conectar Meta"
                    : integration.id === "rd" && rdConnected ? "Gerenciar RD" : integration.id === "rd" ? "Conectar RD" : "Saiba mais"}
                </button>

                {(integration.id === "meta" || integration.id === "rd") && (
                  <button onClick={() => navigate(`/configuracoes?integration=${integration.id}`)} className="gd-button">
                    Configurações
                  </button>
                )}

                <button
                  className="gd-button ml-auto"
                  onClick={() => openData(integration.id)}
                  disabled={integration.id === "google-ads" || integration.id === "drive"}
                >
                  Ver dados <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="gd-panel mt-4 p-5">
        <h2 className="font-black">Como os dados se encontram</h2>
        <p className="mt-1 text-xs text-[#7f7870]">UTMs, origem do lead e identificadores de conta ligam o investimento das plataformas de mídia às negociações e vendas do RD Station.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {["Meta Ads", "UTM + conta + campanha", "Funil RD Station", "Receita e ROAS"].map((label, index) => (
            <div key={label} className="relative rounded-xl border border-[#e2ddd6] bg-[#fcfbf8] p-4 text-center text-xs font-black">
              {label}
              {index < 3 && <span className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border bg-white text-[#9b7416] md:grid">›</span>}
            </div>
          ))}
        </div>
      </section>

      <Dialog open={rdDialogOpen} onOpenChange={setRDDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conectar RD Station CRM</DialogTitle>
          </DialogHeader>
          <RDIntegrationCard />
        </DialogContent>
      </Dialog>
    </div>
  );
}
