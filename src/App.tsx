import { Component, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { dehydrate, hydrate, keepPreviousData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import GrowdashLayout from "@/growdash/GrowdashLayout";
import { MfaChallengeGate } from "@/components/auth/MfaChallengeGate";

// Route modules must remain lazy here as well as in the layout preloader.
// Statically importing them defeated code splitting and made one stale asset
// capable of delaying the whole authenticated application.
const FullDashboard = lazyWithRetry(() => import("@/pages/Index"), "dashboard");
const TrafficPage = lazyWithRetry(() => import("@/growdash/TrafficPage"), "campaigns");
const FunnelAnalysis = lazyWithRetry(() => import("@/pages/FunnelAnalysis"), "funnel-analysis");
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

const QUERY_SESSION_CACHE_KEY = "growdash:query-cache:v1";
const QUERY_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const QUERY_SESSION_MAX_BYTES = 4_200_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      // Keep the last successful screen in place when filters or query keys
      // change. Refreshes stay silent rather than replacing KPI cards with an
      // empty state or a blocking loader.
      placeholderData: keepPreviousData,
      // A snapshot of the last successful session is immediately usable. Live
      // changes arrive through the silent realtime layer; mounting a route
      // must not re-read its entire history just because the user navigated.
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function restoreQuerySession() {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(QUERY_SESSION_CACHE_KEY) || "null");
    if (!saved?.state || !saved?.savedAt || Date.now() - Number(saved.savedAt) > QUERY_SESSION_MAX_AGE_MS) return;
    hydrate(queryClient, saved.state);
  } catch {
    // A stale or partial browser cache must never prevent the application from opening.
    window.sessionStorage.removeItem(QUERY_SESSION_CACHE_KEY);
  }
}

restoreQuerySession();

let querySessionSaveTimer: number | undefined;
function persistQuerySession() {
  if (typeof window === "undefined") return;
  if (querySessionSaveTimer !== undefined) window.clearTimeout(querySessionSaveTimer);
  querySessionSaveTimer = window.setTimeout(() => {
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === "success" && query.state.data !== undefined,
      });
      // Keep the newest successful screen snapshots if the browser storage limit is near.
      state.queries.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
      let serialized = JSON.stringify({ savedAt: Date.now(), state });
      while (serialized.length > QUERY_SESSION_MAX_BYTES && state.queries.length > 1) {
        state.queries.pop();
        serialized = JSON.stringify({ savedAt: Date.now(), state });
      }
      window.sessionStorage.setItem(QUERY_SESSION_CACHE_KEY, serialized);
    } catch {
      // Storage is an enhancement only. Live data and navigation keep working without it.
    }
  }, 400);
}

if (typeof window !== "undefined") {
  queryClient.getQueryCache().subscribe((event) => {
    if (event?.type === "updated" && event.query.state.status === "success") persistQuerySession();
  });
}

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
                    <Route path="analise-funis" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="funnels" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="alertas" element={<RequirePage page="alerts">{analytics(<FullAlerts />)}</RequirePage>} />
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
                    <Route path="agentes" element={<RequirePage page="agents"><ModulePage /></RequirePage>} />
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
