import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useBackfillMeta } from "@/hooks/useBackfillMeta";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useSyncBalance } from "@/hooks/useSyncBalance";
import { useAccountPixels, useSyncMetaPixels } from "@/hooks/useAccountPixels";
import { useToast } from "@/hooks/use-toast";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UTMConventionCard } from "@/components/settings/UTMConventionCard";
import { UTMMappingCard } from "@/components/settings/UTMMappingCard";
import { PlatformRulesSection } from "@/components/settings/PlatformRulesSection";
import { CustomMetricsSection } from "@/components/settings/CustomMetricsSection";
import { RDHealthCheckCard } from "@/components/settings/RDHealthCheckCard";
import { RDIntegrationCard } from "@/components/settings/RDIntegrationCard";
import { RDFunnelsSection } from "@/components/settings/RDFunnelsSection";
import { RDObservabilityCard } from "@/components/settings/RDObservabilityCard";
import { RDUTMDiagnosticsCard } from "@/components/settings/RDUTMDiagnosticsCard";
import { WhatsAppConnectionPanel } from "@/components/whatsapp/WhatsAppConnectionPanel";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  ExternalLink,
  Facebook,
  KeyRound,
  Link2,
  MessageSquare,
  MonitorUp,
  Network,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  ServerCog,
  Smartphone,
  TestTube2,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

type ProviderId = "meta" | "google" | "kwai" | "tiktok";

const META_APP_ID_KEY = "trackvio_meta_app_id";
const META_ACTIVE_ACCOUNTS_KEY = "trackvio_meta_active_account_ids";
const DEFAULT_META_APP_ID = (import.meta.env.VITE_META_APP_ID as string | undefined) || "";

const providers: Array<{
  id: ProviderId;
  name: string;
  label: string;
  icon: React.ElementType;
  accent: string;
}> = [
  { id: "meta", name: "Meta Ads", label: "Facebook e Instagram Ads", icon: Facebook, accent: "bg-blue-600" },
  { id: "google", name: "Google Ads", label: "Pesquisa, YouTube e Performance Max", icon: MonitorUp, accent: "bg-emerald-600" },
  { id: "kwai", name: "Kwai Ads", label: "Campanhas de vídeo e tráfego", icon: RadioTower, accent: "bg-orange-500" },
  { id: "tiktok", name: "TikTok Ads", label: "Campanhas de vídeo e mensagens", icon: Smartphone, accent: "bg-zinc-950" },
];

const webhookProviders = ["Hotmart", "Kiwify", "Monetizze", "PerfectPay", "Eduzz", "Herospark", "Make", "Zapier"];
const MCP_STORAGE_KEY = "trackvio:mcp-connectors";
const mcpConnectors = [
  { id: "github", name: "GitHub MCP", description: "Repositórios, commits, PRs, issues e automações de entrega." },
  { id: "google-drive", name: "Google Drive MCP", description: "Docs, Sheets, arquivos, relatórios e leitura de materiais da operação." },
  { id: "browser", name: "Browser MCP", description: "Navegação, testes visuais e validação de páginas locais ou externas." },
  { id: "cloudflare", name: "Cloudflare MCP", description: "Workers, deploy, infraestrutura, DNS, segurança e automações serverless." },
  { id: "openai", name: "OpenAI MCP", description: "Agentes, IA, prompts, memória operacional e copilotos do SaaS." },
  { id: "rd-meta", name: "RD + Meta MCP custom", description: "Conector próprio para sincronizar CRM, vendas, funil e mídia via backend." },
];
const utmPlatforms = [
  { name: "Facebook", icon: Facebook, code: "utm_source=facebook&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}" },
  { name: "Google", icon: MonitorUp, code: "utm_source=google&utm_medium={network}&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}" },
  { name: "Kwai", icon: RadioTower, code: "utm_source=kwai&utm_medium=cpc&utm_campaign={{campaign_name}}&utm_content={{creative_name}}" },
  { name: "TikTok", icon: Smartphone, code: "utm_source=tiktok&utm_medium={{placement}}&utm_campaign={{campaign_name}}&utm_content={{ad_name}}" },
];

function readStoredSet(key: string) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function buildMetaOauthUrl(appId: string) {
  const redirectUri = `${window.location.origin}/integrations`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "ads_read,business_management",
    response_type: "token",
    state: crypto.randomUUID(),
  });
  return `https://www.facebook.com/v25.0/dialog/oauth?${params.toString()}`;
}

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: adAccounts = [], refetch: refetchAccounts } = useAdAccounts();
  const { data: pixelData } = useAccountPixels();
  const syncMeta = useSyncMeta();
  const syncBalance = useSyncBalance();
  const syncPixels = useSyncMetaPixels();
  const backfill = useBackfillMeta();

  const [activeTab, setActiveTab] = useState("ads");
  const [expandedProvider, setExpandedProvider] = useState<ProviderId>("meta");
  const [expandedAccounts, setExpandedAccounts] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [metaAppId, setMetaAppId] = useState(() => localStorage.getItem(META_APP_ID_KEY) || "");
  const [metaToken, setMetaToken] = useState("");
  const [manualMetaAccountId, setManualMetaAccountId] = useState("");
  const [manualMetaToken, setManualMetaToken] = useState("");
  const [manualMetaName, setManualMetaName] = useState("");
  const [inlineMetaName, setInlineMetaName] = useState("");
  const [inlineMetaAccountId, setInlineMetaAccountId] = useState("");
  const [inlineMetaToken, setInlineMetaToken] = useState("");
  const [inlineConnecting, setInlineConnecting] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [activeAccountIds, setActiveAccountIds] = useState<Set<string>>(() => readStoredSet(META_ACTIVE_ACCOUNTS_KEY));
  const [activeMcpIds, setActiveMcpIds] = useState<Set<string>>(() => readStoredSet(MCP_STORAGE_KEY));

  useEffect(() => {
    localStorage.setItem(META_APP_ID_KEY, metaAppId.trim());
  }, [metaAppId]);

  useEffect(() => {
    if (!adAccounts.length) return;
    setActiveAccountIds((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set(adAccounts.map((acc) => acc.id));
      localStorage.setItem(META_ACTIVE_ACCOUNTS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [adAccounts]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token");
    if (!token) return;
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    void discoverMetaAccounts(token, true);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "trackvio-meta-connected") return;
      void queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      void refetchAccounts();
      setExpandedAccounts(true);
      setConnectOpen(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient, refetchAccounts]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return adAccounts;
    return adAccounts.filter((acc) => `${acc.name} ${acc.account_id}`.toLowerCase().includes(q));
  }, [adAccounts, accountSearch]);

  const visibleAccounts = expandedAccounts ? filteredAccounts : filteredAccounts.slice(0, 6);
  const pixelCount = Object.values(pixelData?.byAccount || {}).flat().length;

  const setStoredActiveAccounts = (next: Set<string>) => {
    setActiveAccountIds(next);
    localStorage.setItem(META_ACTIVE_ACCOUNTS_KEY, JSON.stringify([...next]));
  };

  const toggleAccount = (id: string) => {
    const next = new Set(activeAccountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStoredActiveAccounts(next);
  };

  const toggleAllAccounts = () => {
    const allVisibleSelected = filteredAccounts.length > 0 && filteredAccounts.every((acc) => activeAccountIds.has(acc.id));
    setStoredActiveAccounts(allVisibleSelected ? new Set() : new Set(filteredAccounts.map((acc) => acc.id)));
  };

  const setStoredMcpIds = (next: Set<string>) => {
    setActiveMcpIds(next);
    localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify([...next]));
  };

  const toggleMcp = (id: string) => {
    const next = new Set(activeMcpIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStoredMcpIds(next);
  };

  const enableAllMcp = () => setStoredMcpIds(new Set(mcpConnectors.map((item) => item.id)));

  async function saveMetaAccounts(accounts: any[]) {
    const savedIds: string[] = [];

    for (const account of accounts) {
      const { data: existing, error: existingError } = await supabase
        .from("ad_accounts")
        .select("id")
        .eq("user_id", account.user_id)
        .eq("account_id", account.account_id)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { data: updated, error: updateError } = await supabase
          .from("ad_accounts")
          .update(account)
          .eq("id", existing.id)
          .select("id")
          .single();
        if (updateError) throw updateError;
        savedIds.push(updated.id);
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("ad_accounts")
        .insert(account)
        .select("id")
        .single();
      if (insertError) throw insertError;
      savedIds.push(inserted.id);
    }

    return savedIds;
  }

  async function deleteMetaAccount(account: { id: string; name: string }) {
    const confirmed = window.confirm(
      `Excluir a integração Meta "${account.name}"?\n\nIsso remove a conta vinculada da plataforma. Dados dependentes que estiverem ligados por regra do banco também podem ser removidos.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from("ad_accounts").delete().eq("id", account.id);
    if (error) {
      toast({
        title: "Erro ao excluir integração",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const next = new Set(activeAccountIds);
    next.delete(account.id);
    setStoredActiveAccounts(next);
    await queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
    await refetchAccounts();
    toast({
      title: "Integração excluída",
      description: `${account.name} foi removida da plataforma.`,
    });
  }

  async function discoverMetaAccounts(token: string, fromOauth = false) {
    if (!user?.id) {
      toast({ title: "Login necessário", description: "Entre na plataforma antes de vincular contas.", variant: "destructive" });
      return;
    }

    const cleanToken = token.trim();
    if (!cleanToken) {
      toast({ title: "Token ausente", description: "Cole um token da Meta com ads_read e acesso às contas de anúncio.", variant: "destructive" });
      return;
    }

    const fields = "id,account_id,name,account_status,currency,timezone_name";
    const errors: string[] = [];
    const accountMap = new Map<string, any>();

    const fetchMeta = async (endpoint: string, params: Record<string, string>) => {
      const url = new URL(`https://graph.facebook.com/v25.0/${endpoint}`);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("access_token", cleanToken);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message || "Erro desconhecido da Meta.");
      return json;
    };

    const addFoundAccount = (acc: any) => {
      const id = String(acc.id || `act_${acc.account_id || ""}`);
      if (!id || id === "act_") return;
      accountMap.set(id, acc);
    };

    try {
      const direct = await fetchMeta("me/adaccounts", { fields, limit: "200" });
      (direct.data || []).forEach(addFoundAccount);
    } catch (error: any) {
      errors.push(error.message);
    }

    try {
      const businessFields = `id,name,owned_ad_accounts.limit(200){${fields}},client_ad_accounts.limit(200){${fields}}`;
      const businesses = await fetchMeta("me/businesses", { fields: businessFields, limit: "100" });
      (businesses.data || []).forEach((business: any) => {
        (business.owned_ad_accounts?.data || []).forEach((acc: any) => addFoundAccount({ ...acc, business_name: business.name }));
        (business.client_ad_accounts?.data || []).forEach((acc: any) => addFoundAccount({ ...acc, business_name: business.name }));
      });
    } catch (error: any) {
      errors.push(error.message);
    }

    const accounts = [...accountMap.values()].map((acc: any) => ({
      user_id: user.id,
      account_id: String(acc.id || `act_${acc.account_id || ""}`),
      name: acc.business_name ? `${acc.name || `Conta ${acc.account_id}`} • ${acc.business_name}` : acc.name || `Conta ${acc.account_id}`,
      access_token: cleanToken,
      connection_status: "connected",
      last_sync_error: null,
      last_sync_error_code: null,
      last_sync_attempt_at: new Date().toISOString(),
      last_sync_success_at: new Date().toISOString(),
    }));

    if (accounts.length === 0) {
      toast({
        title: "Nenhuma conta encontrada",
        description: errors[0] || "Confirme se o login/token autorizou ads_read e acesso às contas de anúncio.",
        variant: errors.length ? "destructive" : "default",
      });
      return;
    }

    try {
      await saveMetaAccounts(accounts);
    } catch (error) {
      toast({
        title: "Erro ao salvar contas Meta",
        description: (error as Error).message,
        variant: "destructive",
      });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
    await refetchAccounts();
    setMetaToken("");
    setExpandedAccounts(true);
    if (fromOauth && window.opener) {
      window.opener.postMessage({ type: "trackvio-meta-connected" }, window.location.origin);
      window.setTimeout(() => window.close(), 700);
    }
    toast({
      title: "Contas Meta sincronizadas",
      description: `${accounts.length} conta(s) de anúncio encontrada(s).${fromOauth ? " Login oficial concluído." : ""}`,
    });
  }

  async function connectMetaAccountByIdInternal(opts: {
    name?: string;
    accountId: string;
    token: string;
    backfill?: boolean;
  }): Promise<boolean> {
    if (!user?.id) {
      toast({ title: "Login necessário", description: "Entre na plataforma antes de vincular contas.", variant: "destructive" });
      return false;
    }

    const token = opts.token.trim();
    const rawAccountId = opts.accountId.trim().replace(/^act_/i, "");
    if (!rawAccountId || !token) {
      toast({ title: "Dados obrigatórios", description: "Informe o ID da conta de anúncio e o token da Meta.", variant: "destructive" });
      return false;
    }

    const metaAccountId = `act_${rawAccountId}`;
    try {
      const url = new URL(`https://graph.facebook.com/v25.0/${metaAccountId}`);
      url.searchParams.set("fields", "id,account_id,name,account_status,currency,timezone_name");
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "A Meta rejeitou o ID/token informado.");
      }

      const customName = opts.name?.trim();
      const account = {
        user_id: user.id,
        account_id: String(json.id || metaAccountId),
        name: customName || json.name || `Conta ${rawAccountId}`,
        access_token: token,
        connection_status: "connected",
        last_sync_error: null,
        last_sync_error_code: null,
        last_sync_attempt_at: new Date().toISOString(),
        last_sync_success_at: new Date().toISOString(),
      };

      const [savedAccountId] = await saveMetaAccounts([account]);

      await queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      await refetchAccounts();
      setExpandedAccounts(true);
      toast({
        title: "Conta Meta conectada",
        description: `${account.name} foi vinculada. Buscando dados...`,
      });

      const today = format(new Date(), "yyyy-MM-dd");
      void syncMeta.mutateAsync({ adAccountId: savedAccountId, startDate: today, endDate: today });

      if (opts.backfill) {
        const from = new Date(Date.now() - 30 * 86400000);
        void backfill.mutateAsync({ adAccountId: savedAccountId, from, to: new Date() }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["insights"] });
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        });
      }

      void syncPixels.mutateAsync(savedAccountId).catch(() => {});
      void syncBalance.mutateAsync().catch(() => {});

      return true;
    } catch (error) {
      toast({
        title: "Erro ao conectar Meta",
        description: (error as Error).message,
        variant: "destructive",
      });
      return false;
    }
  }

  async function connectMetaAccountById() {
    const ok = await connectMetaAccountByIdInternal({
      name: manualMetaName,
      accountId: manualMetaAccountId,
      token: manualMetaToken,
      backfill: true,
    });
    if (ok) {
      setManualMetaAccountId("");
      setManualMetaToken("");
      setManualMetaName("");
      setConnectOpen(false);
    }
  }

  async function connectMetaAccountInline() {
    setInlineConnecting(true);
    const ok = await connectMetaAccountByIdInternal({
      name: inlineMetaName,
      accountId: inlineMetaAccountId,
      token: inlineMetaToken,
      backfill: true,
    });
    setInlineConnecting(false);
    if (ok) {
      setInlineMetaName("");
      setInlineMetaAccountId("");
      setInlineMetaToken("");
    }
  }

  const startMetaOauth = () => {
    const appId = metaAppId.trim() || DEFAULT_META_APP_ID;
    if (!appId) {
      toast({
        title: "App ID da Meta obrigatório",
        description: "Cole o App ID real criado em developers.facebook.com para abrir o login oficial da Meta.",
        variant: "destructive",
      });
      return;
    }
    const popup = window.open(buildMetaOauthUrl(appId), "trackvio_meta_oauth", "width=760,height=860");
    popup?.focus();
  };

  const copyOauthLink = async () => {
    const appId = metaAppId.trim() || DEFAULT_META_APP_ID;
    if (!appId) {
      toast({
        title: "App ID da Meta obrigatório",
        description: "Cole o App ID real criado em developers.facebook.com para gerar o link de conexão.",
        variant: "destructive",
      });
      return;
    }
    await navigator.clipboard.writeText(buildMetaOauthUrl(appId));
    toast({ title: "Link copiado", description: "Abra o link no navegador onde o Facebook está logado." });
  };

  const syncSelectedMeta = async () => {
    const selected = adAccounts.filter((acc) => activeAccountIds.has(acc.id));
    if (selected.length === 0) {
      toast({ title: "Nenhuma conta ativa", description: "Ative pelo menos uma conta de anúncio para sincronizar.", variant: "destructive" });
      return;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    const failures: string[] = [];
    for (const acc of selected) {
      try {
        await syncMeta.mutateAsync({ adAccountId: acc.id, startDate: today, endDate: today });
      } catch (error) {
        failures.push(`${acc.name}: ${(error as Error).message}`);
      }
    }
    if (failures.length > 0) {
      toast({
        title: "Algumas contas não sincronizaram",
        description: failures.slice(0, 2).join(" | "),
        variant: "destructive",
      });
    }
  };

  const syncLast30Days = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const thirtyDaysAgo = format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd");
    await syncMeta.mutateAsync({ startDate: thirtyDaysAgo, endDate: today });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  };

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div>
          <h1 className="text-2xl font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-1">Conecte anúncios, webhooks, UTMs, pixels e canais de atendimento.</p>
        </div>
      </MotionItem>

      <MotionItem>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-4 xl:grid-cols-9">
            <TabsTrigger value="ads" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Link2 className="h-4 w-4" /> Anúncios
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <RadioTower className="h-4 w-4" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="rd" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Link2 className="h-4 w-4" /> RD CRM
            </TabsTrigger>
            <TabsTrigger value="utms" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Clipboard className="h-4 w-4" /> UTMs
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <RefreshCw className="h-4 w-4" /> Sync
            </TabsTrigger>
            <TabsTrigger value="pixel" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Code2 className="h-4 w-4" /> Pixel
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="mcp" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Network className="h-4 w-4" /> MCP
            </TabsTrigger>
            <TabsTrigger value="tests" className="gap-2 rounded-none border-b-2 border-transparent py-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <BookOpen className="h-4 w-4" /> Testes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="space-y-5">
            <div className="grid max-w-4xl gap-4">
              {providers.map((provider) => {
                const Icon = provider.icon;
                const expanded = expandedProvider === provider.id;
                return (
                  <Card key={provider.id} className={cn("overflow-hidden", expanded && "ring-1 ring-primary/60")}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-5 text-left"
                      onClick={() => setExpandedProvider(expanded ? "meta" : provider.id)}
                    >
                      <div className="flex items-center gap-4">
                        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full text-white", provider.accent)}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <div>
                          <h2 className="text-xl font-semibold">{provider.name}</h2>
                          <p className="text-sm text-muted-foreground">{provider.label}</p>
                        </div>
                      </div>
                      {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </button>

                    {expanded && provider.id === "meta" && (
                      <CardContent className="space-y-5 border-t pt-5">
                        <div>
                          <p className="mb-3 text-sm text-muted-foreground">Conecte seus perfis por aqui:</p>
                          <div className="space-y-3">
                            {adAccounts.length > 0 ? (
                              <div className="rounded-lg border p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold">Perfil Meta conectado</p>
                                    <p className="text-sm text-muted-foreground">
                                      {activeAccountIds.size} ativa(s) de {adAccounts.length} conta(s) de anúncio disponíveis
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
                                      <BadgeCheck className="h-3 w-3" /> Conectado
                                    </Badge>
                                    <Button variant="ghost" size="icon" onClick={() => setExpandedAccounts(!expandedAccounts)} aria-label="Mostrar contas Meta">
                                      <ChevronRight className={cn("h-4 w-4 transition-transform", expandedAccounts && "rotate-90")} />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum perfil conectado ainda.</div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button className="gap-2" onClick={() => setConnectOpen(true)}>
                            <Plus className="h-4 w-4" /> Adicionar perfil
                          </Button>
                          <Button variant="secondary" className="gap-2" onClick={syncSelectedMeta} disabled={syncMeta.isPending || adAccounts.length === 0}>
                            <RefreshCw className={cn("h-4 w-4", syncMeta.isPending && "animate-spin")} /> Sincronizar contas Meta
                          </Button>
                        </div>

                        {expandedAccounts && (
                          <div className="space-y-4 rounded-lg border bg-background/35 p-4">
                            <div className="flex flex-col gap-3 md:flex-row">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Pesquisar conta por nome ou ID..." className="pl-9" />
                              </div>
                              <Button variant="outline" onClick={toggleAllAccounts}>
                                {filteredAccounts.length > 0 && filteredAccounts.every((acc) => activeAccountIds.has(acc.id)) ? "Remover todas" : "Selecionar todas"}
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {visibleAccounts.length > 0 ? (
                                visibleAccounts.map((acc) => (
                                  <div key={acc.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">{acc.name}</p>
                                      <p className="truncate text-sm text-muted-foreground">{acc.account_id} • {acc.connection_status || "conectada"}</p>
                                      {acc.last_sync_error && (
                                        <p className="mt-1 line-clamp-2 text-xs text-rose-300">{acc.last_sync_error}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant={activeAccountIds.has(acc.id) ? "default" : "secondary"}>
                                        {activeAccountIds.has(acc.id) ? "Ativa" : "Inativa"}
                                      </Badge>
                                      <Switch checked={activeAccountIds.has(acc.id)} onCheckedChange={() => toggleAccount(acc.id)} />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Excluir integração ${acc.name}`}
                                        title="Excluir integração"
                                        onClick={() => void deleteMetaAccount(acc)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-lg border p-4 text-muted-foreground">Nenhuma conta integrada.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}

                    {expanded && provider.id !== "meta" && (
                      <CardContent className="space-y-4 border-t pt-5">
                        <p className="text-sm text-muted-foreground">
                          Conector preparado para receber OAuth/API de {provider.name}. Quando a credencial for adicionada, os dados entram nos mesmos filtros da dashboard.
                        </p>
                        <Button variant="secondary" className="gap-2">
                          <KeyRound className="h-4 w-4" /> Configurar credenciais
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

          </TabsContent>

          <TabsContent value="webhooks">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione webhooks para receber vendas e eventos de plataformas externas.</p>
                  <div className="space-y-3">
                    {webhookProviders.slice(0, 6).map((name) => (
                      <div key={name} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-semibold">{name}</p>
                          <p className="text-sm text-muted-foreground">Status: Desativado</p>
                        </div>
                        <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Adicionar Webhook</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Credenciais de API</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione tokens de API para integrar com Make, RD, plataformas de venda e automações.</p>
                  <div className="rounded-lg border p-4">
                    <p className="font-semibold">RD Station CRM</p>
                    <p className="text-sm text-muted-foreground">Configure credenciais e webhooks na aba RD CRM.</p>
                  </div>
                  <Button className="gap-2"><KeyRound className="h-4 w-4" /> Adicionar Credencial</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rd" className="space-y-5">
            <div id="rd-integration">
              <RDIntegrationCard />
            </div>
            <RDFunnelsSection />
            <div className="grid gap-5 xl:grid-cols-2">
              <RDHealthCheckCard />
              <RDObservabilityCard />
            </div>
            <RDUTMDiagnosticsCard />
          </TabsContent>

          <TabsContent value="utms" className="space-y-5">
            <div className="grid gap-5">
              <UTMConventionCard />
              <UTMMappingCard />
              <RDUTMDiagnosticsCard />
              <PlatformRulesSection />
              <CustomMetricsSection />
              <Card>
                <CardHeader><CardTitle>Códigos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {utmPlatforms.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.name} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-semibold">Código de UTMs do {item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.code}</p>
                          </div>
                        </div>
                        <Button variant="secondary" className="gap-2" onClick={() => navigator.clipboard.writeText(item.code)}>
                          <Copy className="h-4 w-4" /> Copiar
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Scripts</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea readOnly value={`<script>\n(function(){\n  const params = new URLSearchParams(location.search);\n  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => localStorage.setItem(k, params.get(k) || localStorage.getItem(k) || ''));\n})();\n</script>`} />
                  <Button variant="secondary" className="gap-2"><Copy className="h-4 w-4" /> Copiar script de captura</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sync">
            <Card className="max-w-5xl border-white/10 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sincronização de dados
                </CardTitle>
                <CardDescription>
                  Atualize campanhas, saldos, pixels e histórico. Erros de token aparecem nos diagnósticos da integração.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button onClick={syncLast30Days} disabled={syncMeta.isPending || backfill.isPending}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", syncMeta.isPending && "animate-spin")} />
                    {syncMeta.isPending ? "Sincronizando..." : "Sincronizar últimos 30 dias"}
                  </Button>
                  <Button variant="outline" onClick={() => syncBalance.mutate()} disabled={syncBalance.isPending}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", syncBalance.isPending && "animate-spin")} />
                    {syncBalance.isPending ? "Atualizando saldo..." : "Atualizar saldo das BMs"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await backfill.mutateAsync({});
                      queryClient.invalidateQueries({ queryKey: ["insights"] });
                    }}
                    disabled={backfill.isPending || syncMeta.isPending}
                  >
                    <CalendarIcon className={cn("mr-2 h-4 w-4", backfill.isPending && "animate-spin")} />
                    {backfill.isPending ? "Backfill em andamento..." : `Backfill ${new Date().getFullYear()}`}
                  </Button>
                  <Button variant="outline" onClick={() => syncPixels.mutate(undefined)} disabled={syncPixels.isPending}>
                    <Code2 className={cn("mr-2 h-4 w-4", syncPixels.isPending && "animate-spin")} />
                    Sincronizar pixels
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Se uma API falhar, a plataforma mantém os dados existentes e mostra o erro nos cards de diagnóstico para evitar perda operacional.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pixel">
            <Card className="max-w-4xl">
              <CardHeader><CardTitle>Pixels</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Vincule pixels da Meta para enriquecer conversões e eventos por conta.</p>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold">Pixels encontrados</p>
                  <p className="text-sm text-muted-foreground">{pixelCount} pixel(s) sincronizado(s)</p>
                </div>
                <Button className="gap-2" onClick={() => syncPixels.mutate(undefined)} disabled={syncPixels.isPending}>
                  <RefreshCw className={cn("h-4 w-4", syncPixels.isPending && "animate-spin")} /> Sincronizar pixels Meta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppConnectionPanel />
          </TabsContent>

          <TabsContent value="mcp">
            <Card className="max-w-5xl border-primary/20 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ServerCog className="h-5 w-5 text-primary" />
                  Integrações MCP
                </CardTitle>
                <CardDescription>
                  Ative os MCPs que a operação pode usar. Credenciais sensíveis devem ser conectadas no backend, nunca expostas no navegador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div>
                    <p className="font-semibold">Conectar todos os MCPs disponíveis</p>
                    <p className="text-sm text-muted-foreground">
                      Habilita o catálogo completo para automações, agentes, dados e operações internas.
                    </p>
                  </div>
                  <Button className="gap-2" onClick={enableAllMcp}>
                    <Network className="h-4 w-4" /> Ativar todos
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {mcpConnectors.map((connector) => {
                    const active = activeMcpIds.has(connector.id);
                    return (
                      <div
                        key={connector.id}
                        className={cn(
                          "flex items-start justify-between gap-4 rounded-lg border p-4 transition",
                          active ? "border-primary/40 bg-primary/10" : "bg-background/35",
                        )}
                      >
                        <div>
                          <p className="font-semibold">{connector.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{connector.description}</p>
                          <Badge variant={active ? "default" : "secondary"} className="mt-3">
                            {active ? "Ativo" : "Disponível"}
                          </Badge>
                        </div>
                        <Switch checked={active} onCheckedChange={() => toggleMcp(connector.id)} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests">
            <Card className="max-w-4xl">
              <CardHeader><CardTitle>Testes de integração</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {["Meta Ads", "Google Ads", "UTMs", "Webhooks", "RD Station CRM", "WhatsApp"].map((name) => (
                  <div key={name} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <TestTube2 className="h-5 w-5 text-primary" />
                      <span className="font-medium">{name}</span>
                    </div>
                    <Button variant="outline" size="sm">Testar agora</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </MotionItem>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Conectar Meta Ads</DialogTitle>
            <DialogDescription>Escolha como deseja conectar sua conta Meta Ads.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="font-semibold">Conexão simples somente leitura</p>
                <p className="text-xs text-muted-foreground">
                  Informe o ID da conta de anúncio e um token com permissão de leitura para visualizar campanhas, gastos e leads.
                </p>
              </div>
              <Label htmlFor="manual-meta-account">ID da conta de anúncio</Label>
              <Input
                id="manual-meta-account"
                value={manualMetaAccountId}
                onChange={(e) => setManualMetaAccountId(e.target.value)}
                placeholder="Ex: act_1234567890 ou 1234567890"
              />
              <Label htmlFor="manual-meta-token">Token da Meta</Label>
              <Input
                id="manual-meta-token"
                value={manualMetaToken}
                onChange={(e) => setManualMetaToken(e.target.value)}
                type="password"
                placeholder="Token com ads_read/read_insights"
              />
              <Button className="w-full gap-2" onClick={connectMetaAccountById} disabled={!manualMetaAccountId.trim() || !manualMetaToken.trim()}>
                <RefreshCw className="h-4 w-4" /> Conectar e puxar dados
              </Button>
            </div>

            <Button variant="outline" className="h-12 w-full gap-2 text-base" onClick={startMetaOauth}>
              <ExternalLink className="h-5 w-5" /> Continuar com login Meta
            </Button>

            <div className="rounded-lg border p-4 space-y-3">
              <Label htmlFor="meta-app-id">App ID da Meta</Label>
              <Input id="meta-app-id" value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} placeholder="Ex: 1234567890" />
              <p className="text-xs text-muted-foreground">Redirect obrigatório no app da Meta: {window.location.origin}/integrations</p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <Label htmlFor="meta-token">Ou cole um token da Meta para descobrir contas automaticamente</Label>
              <Input id="meta-token" value={metaToken} onChange={(e) => setMetaToken(e.target.value)} type="password" placeholder="Token com ads_read e acesso às contas de anúncio" />
              <Button variant="secondary" className="w-full gap-2" onClick={() => discoverMetaAccounts(metaToken)} disabled={!metaToken.trim()}>
                <RefreshCw className="h-4 w-4" /> Puxar contas de anúncio
              </Button>
            </div>

            <Button variant="outline" className="h-12 w-full gap-2" onClick={copyOauthLink}>
              <Copy className="h-5 w-5" /> Copiar link para navegador multilogin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}
