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
import { isRecoverableChunkError, lazyWithRetry, recordRuntimeDiagnostic } from "@/lib/resilience";

// O shell autenticado reúne navegação, notificações e consultas de dados. Mantê-lo
// fora do bundle inicial deixa a tela de acesso pronta sem baixar a plataforma toda.
const GrowdashLayout = lazyWithRetry(() => import("@/growdash/GrowdashLayout"), "layout");
const MfaChallengeGate = lazyWithRetry(() =>
  import("@/components/auth/MfaChallengeGate").then((module) => ({ default: module.MfaChallengeGate })),
  "mfa",
);

const FullDashboard = lazyWithRetry(() => import("@/pages/Index"), "dashboard");
const TrafficPage = lazyWithRetry(() => import("@/growdash/TrafficPage"), "trafego-pago");
const FunnelAnalysis = lazyWithRetry(() => import("@/pages/FunnelAnalysis"), "analise-de-funis");
const FullAlerts = lazyWithRetry(() => import("@/pages/Alerts"), "alertas");
const EventClasses = lazyWithRetry(() => import("@/pages/EventClasses"), "agenda-turmas");
const IncompleteLeads = lazyWithRetry(() => import("@/pages/LeadsIncompletos"), "leads-incompletos");
const DataHealth = lazyWithRetry(() => import("@/pages/DataHealth"), "saude-dos-dados");
const FullSettings = lazyWithRetry(() => import("@/pages/Settings"), "configuracoes");
const FullUsers = lazyWithRetry(() => import("@/pages/Users"), "usuarios");
const Products = lazyWithRetry(() => import("@/pages/Products"), "produtos");
const Funnelytics = lazyWithRetry(() => import("@/pages/Funnelytics"), "growdash-flow");
const CrmPage = lazyWithRetry(() => import("@/growdash/CrmPage"), "crm");
const KanbanPage = lazyWithRetry(() => import("@/growdash/KanbanPage"), "kanban");
const CommercialPage = lazyWithRetry(() => import("@/growdash/CommercialPage"), "comercial");
const FinancePage = lazyWithRetry(() => import("@/growdash/FinancePage"), "financeiro");
const StoragePage = lazyWithRetry(() => import("@/growdash/StoragePage"), "armazenamento");
const IntegrationsPage = lazyWithRetry(() => import("@/growdash/IntegrationsPage"), "integracoes");
const ProfilePage = lazyWithRetry(() => import("@/growdash/ProfilePage"), "perfil");
const SocialMediaPage = lazyWithRetry(() => import("@/growdash/SocialMediaPage"), "midia-social");
const AnnouncementsPage = lazyWithRetry(() => import("@/growdash/AnnouncementsPage"), "anuncios");
const ModulePage = lazyWithRetry(() => import("@/growdash/ModulePage"), "modulo");
const BrandDiagnosticPage = lazyWithRetry(() => import("@/growdash/BrandDiagnosticPage"), "marca");
const IntelligenceCenterPage = lazyWithRetry(() => import("@/growdash/IntelligenceCenterPage"), "inteligencia");
const StrategyPage = lazyWithRetry(() => import("@/growdash/StrategyPage"), "estrategia");
const Auth = lazyWithRetry(() => import("@/pages/Auth"), "autenticacao");
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"), "reset-senha");
const SharedLeadReport = lazyWithRetry(() => import("@/pages/SharedLeadReport"), "relatorio-compartilhado");
const ExpertDashboard = lazyWithRetry(() => import("@/pages/ExpertDashboard"), "painel-expert");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
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
      <button type="button" onClick={() => { const url = new URL(window.location.href); url.searchParams.set("gd_reload", String(Date.now())); window.location.replace(url.toString()); }} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Tentar novamente</button>
    </div> : <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Carregando" />}
  </div>;
}

function MarkApplicationBooted() {
  useEffect(() => {
    // The HTML fallback only stops its startup watchdog after React has
    // actually committed. This preserves a usable recovery screen when an
    // eager production module cannot be evaluated.
    window.__GROWDASH_BOOTED__ = true;
  }, []);
  return null;
}

type AppErrorBoundaryState = { failed: boolean };

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostic context in the browser without exposing it in the UI.
    recordRuntimeDiagnostic("application", error);
    console.error("Growdash render error", error, info.componentStack);
    // A Pages release replaces hashed lazy chunks. Safari can retain the old
    // shell briefly and then fail a dynamic import. Retry exactly once against
    // a cache-busting URL before showing the manual recovery screen.
    const isChunkError = isRecoverableChunkError(error);
    const retryKey = "growdash:chunk-retry";
    let retry = { attempts: 0, startedAt: 0 };
    try {
      const stored = JSON.parse(sessionStorage.getItem(retryKey) || "null");
      if (stored && typeof stored.attempts === "number" && typeof stored.startedAt === "number") retry = stored;
    } catch {
      // A malformed recovery marker must never prevent a safe reload.
    }
    const activeRecovery = Date.now() - retry.startedAt < 30_000;
    const attempts = activeRecovery ? retry.attempts : 0;
    if (isChunkError && attempts < 1) {
      try {
        sessionStorage.setItem(retryKey, JSON.stringify({ attempts: attempts + 1, startedAt: activeRecovery ? retry.startedAt : Date.now() }));
      } catch {
        // Storage pode estar desabilitado; ainda é seguro tentar a nova versão uma vez.
      }
      const url = new URL(window.location.href);
      url.searchParams.set("gd_reload", String(Date.now()));
      // Pages can expose the HTML a few seconds before every new lazy chunk
      // reaches the custom domain. A short backoff avoids a false failure UI.
      window.setTimeout(() => window.location.replace(url.toString()), (attempts + 1) * 1_500);
      return;
    }
    try { sessionStorage.removeItem(retryKey); } catch { /* sem storage, nada para limpar */ }
  }

  retry = () => {
    this.setState({ failed: false });
    // A manual retry happens after a deploy may have finished propagating.
    // Clear the automatic-retry guard so this retry can load the new chunks.
    try { sessionStorage.removeItem("growdash:chunk-retry"); } catch { /* sem storage, nada para limpar */ }
    const url = new URL(window.location.href);
    url.searchParams.set("gd_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.failed) {
      return <div className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
          <p className="text-lg font-black">Não foi possível abrir esta tela.</p>
          <p className="mt-2 text-sm text-muted-foreground">Uma atualização ou conexão instável pode ter interrompido o carregamento. Tente carregar a versão mais recente.</p>
          <button type="button" onClick={this.retry} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Recarregar Growdash</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingModule />;
  if (!user) return <Navigate to="/auth" replace />;
  return <MfaChallengeGate><GlobalFiltersProvider><DashboardEditorProvider><GrowdashLayout /></DashboardEditorProvider></GlobalFiltersProvider></MfaChallengeGate>;
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
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/relatorios/:shareToken" element={<SharedLeadReport />} />
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
                    <Route path="integracoes" element={<RequirePage page="integrations"><IntegrationsPage /></RequirePage>} />
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
