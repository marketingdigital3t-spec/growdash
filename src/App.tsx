import { Component, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { firstAllowedPath, type PagePermission, usePermissions } from "@/hooks/usePermissions";
import { DashboardEditorProvider } from "@/contexts/DashboardEditorContext";
import { useAccentTheme } from "@/hooks/useAccentTheme";
import { RouteErrorBoundary } from "@/components/resilience/RouteErrorBoundary";
import { clearRecoveryAttempts, consumeRecoveryAttempt, lazyWithRetry, recordRuntimeDiagnostic, recoverLatestBuildOnce } from "@/lib/resilience";
import { MfaChallengeGate } from "@/components/auth/MfaChallengeGate";

// Keep the authenticated shell and the heavier workspace/agents modules out
// of the initial bundle. The route-level Suspense boundary below gives the
// user a stable shell while these modules are fetched on demand.
const GrowdashLayout = lazyWithRetry(() => import("@/growdash/GrowdashLayout"), "layout");
const BusinessWorkspacePage = lazyWithRetry(() => import("@/growdash/BusinessWorkspacePage"), "business-workspace");
const BusinessUnavailablePage = lazyWithRetry(
  () => import("@/growdash/BusinessWorkspacePage").then(({ BusinessUnavailablePage: Component }) => ({ default: Component })),
  "business-unavailable",
);
const AgentsOfficePage = lazyWithRetry(() => import("@/growdash/AgentsOfficePage"), "agents");

// Route modules must remain lazy here as well as in the layout preloader.
// Statically importing them defeated code splitting and made one stale asset
// capable of delaying the whole authenticated application.
const FullDashboard = lazyWithRetry(() => import("@/pages/Index"), "dashboard");
const TrafficPage = lazyWithRetry(() => import("@/growdash/TrafficPage"), "campaigns");
const FunnelAnalysis = lazyWithRetry(() => import("@/pages/FunnelAnalysis"), "funnel-analysis");
const BusinessPage = lazyWithRetry(() => import("@/growdash/BusinessPage"), "business");
const FullAlerts = lazyWithRetry(() => import("@/pages/Alerts"), "alerts");
const EventClasses = lazyWithRetry(() => import("@/pages/EventClasses"), "event-classes");
const IncompleteLeads = lazyWithRetry(() => import("@/pages/LeadsIncompletos"), "incomplete-leads");
const DataHealth = lazyWithRetry(() => import("@/pages/DataHealth"), "data-health");
const FullSettings = lazyWithRetry(() => import("@/pages/Settings"), "settings");
const FullUsers = lazyWithRetry(() => import("@/pages/Users"), "users");
const Products = lazyWithRetry(() => import("@/pages/Products"), "products");
const Funnelytics = lazyWithRetry(() => import("@/pages/Funnelytics"), "funnelytics");
const CrmPage = lazyWithRetry(() => import("@/growdash/CrmPage"), "crm");
const KanbanPage = lazyWithRetry(() => import("@/growdash/KanbanPage"), "kanban");
const CommercialPage = lazyWithRetry(() => import("@/growdash/CommercialPage"), "commercial");
const FinancePage = lazyWithRetry(() => import("@/growdash/FinancePage"), "finance");
const StoragePage = lazyWithRetry(() => import("@/growdash/StoragePage"), "storage");
const IntegrationsPage = lazyWithRetry(() => import("@/growdash/IntegrationsPage"), "integrations");
const ProfilePage = lazyWithRetry(() => import("@/growdash/ProfilePage"), "profile");
const SocialMediaPage = lazyWithRetry(() => import("@/growdash/SocialMediaPage"), "social-media");
const AnnouncementsPage = lazyWithRetry(() => import("@/growdash/AnnouncementsPage"), "announcements");
const ModulePage = lazyWithRetry(() => import("@/growdash/ModulePage"), "module");
const TrafficAgentPage = lazyWithRetry(() => import("@/growdash/TrafficAgentPage"), "traffic-agent");
const BrandDiagnosticPage = lazyWithRetry(() => import("@/growdash/BrandDiagnosticPage"), "brand-diagnostic");
const IntelligenceCenterPage = lazyWithRetry(() => import("@/growdash/IntelligenceCenterPage"), "intelligence-center");
const StrategyPage = lazyWithRetry(() => import("@/growdash/StrategyPage"), "strategy");
const Auth = lazyWithRetry(() => import("@/pages/Auth"), "auth");
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"), "reset-password");
const SharedLeadReport = lazyWithRetry(() => import("@/pages/SharedLeadReport"), "shared-lead-report");
const PublicInvoiceForm = lazyWithRetry(() => import("@/pages/PublicInvoiceForm"), "public-invoice");
const PublicBrandDiagnosticForm = lazyWithRetry(() => import("@/pages/PublicBrandDiagnosticForm"), "public-brand-diagnostic");
const PublicExpertQuestionnaire = lazyWithRetry(() => import("@/pages/PublicExpertQuestionnaire"), "public-expert-questionnaire");
const ExpertDashboard = lazyWithRetry(() => import("@/pages/ExpertDashboard"), "expert-dashboard");
const WhatsApp = lazyWithRetry(() => import("@/pages/WhatsApp"), "whatsapp");
const QuadroPage = lazyWithRetry(() => import("@/growdash/QuadroPage"), "quadro");
const LegalPage = lazyWithRetry(() => import("@/pages/LegalPage"), "legal");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      // A changed key means a different period, account or workspace. Do not
      // display its previous result as if it belonged to the new selection.
      placeholderData: undefined,
      // Revalidate stale facts when a module is opened, including after a
      // background Meta or RD synchronization has completed.
      refetchOnMount: true,
      // Ao voltar para a Growdash, revalida o último snapshot persistido sem
      // bloquear a pintura. Isso mantém os números visíveis e corrige a
      // sensação de que a tela ficou presa em dados antigos.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

function LoadingModule() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  return <div className="grid min-h-[40vh] place-items-center px-4 text-center" role="status" aria-live="polite">
    {slow ? <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-6 shadow-xl">
      <p className="font-bold">A Growdash está demorando para responder.</p>
      <p className="mt-2 text-sm text-muted-foreground">A conexão ou uma atualização foi interrompida. A página não será recarregada automaticamente.</p>
      <button type="button" onClick={() => window.location.assign("/auth")} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Abrir acesso</button>
    </div> : <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Carregando" />}
  </div>;
}

function MarkApplicationBooted() {
  useEffect(() => {
    // The HTML fallback only stops its startup watchdog after React has
    // actually committed. This preserves a usable recovery screen when an
    // eager production module cannot be evaluated.
    window.__GROWDASH_BOOTED__ = true;
    // The one-time cache-busting parameter is only for obtaining the newest
    // document shell; remove it after React commits so it is never shared or
    // bookmarked as application state.
    const url = new URL(window.location.href);
    if (url.searchParams.has("__gd_build")) {
      url.searchParams.delete("__gd_build");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    clearRecoveryAttempts("chunk-reload");
  }, []);
  return null;
}

type AppErrorBoundaryState = { failed: boolean; retryBlocked: boolean; attempts: number };

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false, retryBlocked: false, attempts: 0 };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostic context in the browser without exposing it in the UI.
    recordRuntimeDiagnostic("application", error);
    console.error("Growdash render error", error, info.componentStack);
    recoverLatestBuildOnce("application", error);
  }

  retry = () => {
    const recovery = consumeRecoveryAttempt("application");
    if (recovery.blocked) {
      this.setState({ retryBlocked: true, attempts: recovery.attempts });
      return;
    }
    this.setState({ failed: false, retryBlocked: false, attempts: recovery.attempts });
  };

  goHome = () => {
    clearRecoveryAttempts("application");
    window.history.replaceState(null, "", "/");
    window.location.assign("/");
  };

  render() {
    if (this.state.failed) {
      return <div className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
          <p className="text-lg font-black">{this.state.retryBlocked ? "Esta tela continua indisponível" : "Não foi possível abrir esta tela."}</p>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.retryBlocked ? "As tentativas nesta tela foram interrompidas para evitar um ciclo. Seus dados não foram alterados." : "O módulo falhou ao renderizar. Tente o módulo uma vez; a plataforma não será recarregada automaticamente."}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!this.state.retryBlocked && <button type="button" onClick={this.retry} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Tentar este módulo</button>}
            <button type="button" onClick={this.goHome} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold transition hover:bg-muted">Ir para o início</button>
          </div>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

function AuthenticatedLayout() {
  const { user, loading, status, retrySession } = useAuth();
  if (loading) return <LoadingModule />;
  if (status === "unavailable") return <section className="grid min-h-[52vh] place-items-center px-4 text-center"><div className="max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl"><p className="text-lg font-black">Não foi possível validar seu acesso.</p><p className="mt-2 text-sm text-muted-foreground">Sua sessão não foi removida. Verifique a conexão e tente novamente.</p><button type="button" onClick={() => void retrySession()} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Tentar conexão</button></div></section>;
  if (!user) return <Navigate to="/auth" replace />;
  return <MfaChallengeGate><GlobalFiltersProvider><DashboardEditorProvider><GrowdashLayout /></DashboardEditorProvider></GlobalFiltersProvider></MfaChallengeGate>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "hydrating") return <LoadingModule />;
  // A failed session check is not proof of logout. Keep the public screen
  // available so the user can recover access, but never bounce between it and
  // an authenticated route.
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AccentInitializer({ children }: { children: ReactNode }) {
  useAccentTheme();
  return <>{children}</>;
}

function ResilientRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`} scope={location.pathname}>{children}</RouteErrorBoundary>;
}

function RequirePage({ page, children }: { page: PagePermission | "master"; children: ReactNode }) {
  const permissions = usePermissions();
  if (permissions.loading) return <LoadingModule />;
  if (permissions.error) return <section className="grid min-h-[52vh] place-items-center px-4 text-center"><div className="max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl"><p className="text-lg font-black">Não foi possível validar as permissões.</p><p className="mt-2 text-sm text-muted-foreground">Nenhum acesso foi ampliado. Tente novamente sem recarregar a página.</p><button type="button" onClick={() => void permissions.retry()} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Tentar novamente</button></div></section>;
  const allowedByPage: Record<PagePermission, boolean> = {
    dashboard: permissions.canDashboard,
    crm: permissions.canCrm,
    commercial: permissions.canCommercial,
    campaigns: permissions.canCampaigns,
    funnels: permissions.canFunnels,
    flow: permissions.canFlow,
    socialMedia: permissions.canSocialMedia,
    classes: permissions.canClasses,
    leads: permissions.canLeads,
    kanban: permissions.canKanban,
    tickets: permissions.canTickets,
    alerts: permissions.canAlerts,
    automations: permissions.canAutomations,
    finance: permissions.canFinance,
    storage: permissions.canStorage,
    brands: permissions.canBrands,
    products: permissions.canProducts,
    integrations: permissions.canIntegrations,
    metaConnect: permissions.canMetaConnect,
    announcements: permissions.canAnnouncements,
    users: permissions.canUsers,
    agents: permissions.canAgents,
    settings: permissions.canSettings,
    dataHealth: permissions.canDataHealth,
    expertDashboard: permissions.canExpertDashboard,
  };
  const allowed = page === "master" ? permissions.isMaster : allowedByPage[page];

  if (!allowed) return <Navigate to={firstAllowedPath(permissions)} replace />;
  return <>{children}</>;
}

const analytics = (element: ReactNode) => (
  <div className="analytics-module flex h-full min-h-0 w-full min-w-0 flex-col text-foreground">
    {element}
  </div>
);

export default function App() {
  const Router = import.meta.env.VITE_STATIC_HTML === "true" ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AuthProvider>
              <AccentInitializer>
                <MarkApplicationBooted />
                <AppErrorBoundary>
                  <Suspense fallback={<LoadingModule />}>
                    <Routes>
                  <Route path="/termos" element={<LegalPage />} />
                  <Route path="/privacidade" element={<LegalPage />} />
                  <Route path="/cookies" element={<LegalPage />} />
                  <Route path="/dpa" element={<LegalPage />} />
                  <Route path="/sla" element={<LegalPage />} />
                  <Route path="/cancelamento" element={<LegalPage />} />
                  <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/relatorios/:shareToken" element={<SharedLeadReport />} />
                  <Route path="/nota-fiscal/:token" element={<PublicInvoiceForm />} />
                  <Route path="/diagnostico-marca/:token" element={<PublicBrandDiagnosticForm />} />
                  <Route path="/questionario-expert/:token" element={<PublicExpertQuestionnaire />} />
                  <Route element={<AuthenticatedLayout />}>
                    <Route index element={<ResilientRoute><RequirePage page="dashboard">{analytics(<FullDashboard />)}</RequirePage></ResilientRoute>} />
                    <Route path="painel-expert" element={<ResilientRoute><RequirePage page="expertDashboard">{analytics(<ExpertDashboard />)}</RequirePage></ResilientRoute>} />
                    <Route path="dashboard" element={<Navigate to="/" replace />} />
                    <Route path="dashboard/completo" element={<Navigate to="/" replace />} />
                    <Route path="crm" element={<ResilientRoute><RequirePage page="crm"><CrmPage /></RequirePage></ResilientRoute>} />
                    <Route path="comercial" element={<ResilientRoute><RequirePage page="commercial"><CommercialPage /></RequirePage></ResilientRoute>} />
                    <Route path="campanhas" element={<ResilientRoute><RequirePage page="campaigns">{analytics(<TrafficPage />)}</RequirePage></ResilientRoute>} />
                    <Route path="inteligencia" element={<RequirePage page="campaigns">{analytics(<IntelligenceCenterPage />)}</RequirePage>} />
                    <Route path="trafego-pago" element={<Navigate to="/campanhas" replace />} />
                    <Route path="trafego-pago/gerenciador" element={<Navigate to="/campanhas" replace />} />
                    <Route path="campaigns" element={<Navigate to="/campanhas" replace />} />
                    <Route path="analise-de-funis" element={<ResilientRoute><RequirePage page="funnels">{analytics(<FunnelAnalysis />)}</RequirePage></ResilientRoute>} />
                    <Route path="business" element={<ResilientRoute><RequirePage page="campaigns">{analytics(<BusinessWorkspacePage />)}</RequirePage></ResilientRoute>}>
                      <Route index element={<BusinessPage />} />
                      <Route path="insights" element={<BusinessPage />} />
                      <Route path="ads-manager" element={<TrafficPage />} />
                      <Route path="notifications" element={<BusinessUnavailablePage title="Notificações" description="As notificações serão exibidas quando a Meta disponibilizar os eventos deste ativo para a conexão autorizada." />} />
                      <Route path="inbox" element={<BusinessUnavailablePage title="Caixa de entrada" description="A Caixa de entrada será carregada aqui quando as permissões de mensagens e os ativos vinculados estiverem autorizados. Nenhuma conversa é simulada." />} />
                      <Route path="leads" element={<CrmPage />} />
                      <Route path="content" element={<BusinessUnavailablePage title="Conteúdo" description="O conteúdo orgânico será exibido aqui quando houver um Instagram ou Página vinculados e dados oficiais persistidos." />} />
                      <Route path="creator-marketing" element={<BusinessUnavailablePage title="Creator Marketing" description="Este módulo será exibido aqui quando a Meta disponibilizar dados oficiais para o portfólio conectado." />} />
                      <Route path="planner" element={<BusinessUnavailablePage title="Planner" description="O calendário de conteúdo será carregado aqui assim que a conexão autorizada fornecer os dados e permissões necessários." />} />
                      <Route path="ads" element={<BusinessUnavailablePage title="Anúncios" description="Os anúncios persistidos pela sincronização Meta serão listados e analisados aqui, dentro da Growdash." />} />
                      <Route path="monetization" element={<BusinessUnavailablePage title="Monetização" description="Os dados de monetização serão exibidos aqui para ativos e permissões elegíveis." />} />
                      <Route path="tools" element={<BusinessUnavailablePage title="Todas as ferramentas" description="Esta central interna será ampliada com os módulos e dados oficiais disponíveis para o portfólio conectado." />} />
                      <Route path="billing" element={<BusinessUnavailablePage title="Cobrança e pagamentos" description="Saldo, aportes e transações oficiais serão consultados e exibidos aqui, separados das métricas de campanha." />} />
                      <Route path="events" element={<BusinessUnavailablePage title="Gerenciador de eventos" description="Pixels, eventos e diagnósticos serão exibidos aqui quando as permissões administrativas forem autorizadas." />} />
                      <Route path="search" element={<BusinessUnavailablePage title="Pesquisar" description="A busca interna localizará os ativos e ferramentas autorizados no portfólio Meta conectado." />} />
                      <Route path="settings" element={<BusinessUnavailablePage title="Configurações" description="As configurações administrativas serão exibidas e auditadas aqui conforme os endpoints e permissões disponíveis." />} />
                      <Route path="help" element={<BusinessUnavailablePage title="Ajuda" description="A ajuda contextual da Growdash será exibida aqui com orientações sobre permissões, ativos e disponibilidade de dados." />} />
                    </Route>
                    <Route path="analise-funis" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="funnels" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="alertas" element={<RequirePage page="alerts">{analytics(<FullAlerts />)}</RequirePage>} />
                    {/* Legacy sidebar links used the English segment. Keep it as
                        a redirect so old bookmarks and cached menu chunks do
                        not land on the dashboard by accident. */}
                    <Route path="alerts" element={<Navigate to="/alertas" replace />} />
                    <Route path="agenda-turmas" element={<RequirePage page="classes">{analytics(<EventClasses />)}</RequirePage>} />
                    <Route path="classes" element={<Navigate to="/agenda-turmas" replace />} />
                    <Route path="leads-incompletos" element={<RequirePage page="leads">{analytics(<IncompleteLeads />)}</RequirePage>} />
                    <Route path="automacoes" element={<RequirePage page="automations"><ModulePage /></RequirePage>} />
                    <Route path="growdash-flow" element={<ResilientRoute><RequirePage page="flow">{analytics(<Funnelytics />)}</RequirePage></ResilientRoute>} />
                    <Route path="estrategia" element={<ResilientRoute><RequirePage page="brands">{analytics(<StrategyPage />)}</RequirePage></ResilientRoute>} />
                    <Route path="saude-dos-dados" element={<RequirePage page="dataHealth">{analytics(<DataHealth />)}</RequirePage>} />
                    <Route path="data-health" element={<Navigate to="/saude-dos-dados" replace />} />
                    <Route path="produtos" element={<RequirePage page="products">{analytics(<Products />)}</RequirePage>} />
                    <Route path="configuracoes" element={<RequirePage page="settings">{analytics(<FullSettings />)}</RequirePage>} />
                    <Route path="settings" element={<Navigate to="/configuracoes" replace />} />
                    <Route path="usuarios" element={<RequirePage page="users">{analytics(<FullUsers />)}</RequirePage>} />
                    <Route path="usuarios/avancado" element={<Navigate to="/usuarios" replace />} />
                    <Route path="users" element={<Navigate to="/usuarios" replace />} />
                    <Route path="financeiro" element={<ResilientRoute><RequirePage page="finance"><FinancePage /></RequirePage></ResilientRoute>} />
                    <Route path="armazenamento" element={<RequirePage page="storage"><StoragePage /></RequirePage>} />
                    <Route path="integracoes" element={<ResilientRoute><RequirePage page="integrations"><IntegrationsPage /></RequirePage></ResilientRoute>} />
                    <Route path="perfil" element={<ProfilePage />} />
                    <Route path="midia-social" element={<ResilientRoute><RequirePage page="socialMedia">{analytics(<SocialMediaPage />)}</RequirePage></ResilientRoute>} />
                    <Route path="kanban" element={<RequirePage page="kanban"><KanbanPage /></RequirePage>} />
                    <Route path="chamados" element={<RequirePage page="tickets"><ModulePage /></RequirePage>} />
                    <Route path="anuncios" element={<RequirePage page="announcements"><AnnouncementsPage /></RequirePage>} />
                    <Route path="marcas" element={<RequirePage page="brands"><ModulePage /></RequirePage>} />
                    <Route path="marcas/:brandId" element={<RequirePage page="brands">{analytics(<BrandDiagnosticPage />)}</RequirePage>} />
                    <Route path="marca" element={<Navigate to="/marcas" replace />} />
                    {/* Legacy URL: Meta Connect is now the paid tab in the unified integrations center. */}
                    <Route path="meta-connect" element={<RequirePage page="integrations"><Navigate to="/integracoes?tab=paid" replace /></RequirePage>} />
                    <Route path="agentes" element={<RequirePage page="agents"><AgentsOfficePage /></RequirePage>} />
                    <Route path="gestor-trafego" element={<RequirePage page="agents"><TrafficAgentPage /></RequirePage>} />
                    <Route path="whatsapp" element={<RequirePage page="integrations">{analytics(<WhatsApp />)}</RequirePage>} />
                    <Route path="quadro" element={<ResilientRoute><QuadroPage /></ResilientRoute>} />
                    <Route path="neural-core" element={<RequirePage page="agents"><ModulePage /></RequirePage>} />
                    <Route path="life-sim" element={<RequirePage page="agents"><ModulePage /></RequirePage>} />
                    <Route path="ia-do-funil" element={<Navigate to="/crm?tab=ai" replace />} />
                    <Route path=":module" element={<ModulePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                    </Routes>
                  </Suspense>
                </AppErrorBoundary>
              </AccentInitializer>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
