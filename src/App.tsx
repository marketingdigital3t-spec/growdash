import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
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

// O shell autenticado reúne navegação, notificações e consultas de dados. Mantê-lo
// fora do bundle inicial deixa a tela de acesso pronta sem baixar a plataforma toda.
const GrowdashLayout = lazy(() => import("@/growdash/GrowdashLayout"));
const MfaChallengeGate = lazy(() =>
  import("@/components/auth/MfaChallengeGate").then((module) => ({ default: module.MfaChallengeGate })),
);

const FullDashboard = lazy(() => import("@/pages/Index"));
const TrafficPage = lazy(() => import("@/growdash/TrafficPage"));
const FunnelAnalysis = lazy(() => import("@/pages/FunnelAnalysis"));
const FullAlerts = lazy(() => import("@/pages/Alerts"));
const EventClasses = lazy(() => import("@/pages/EventClasses"));
const IncompleteLeads = lazy(() => import("@/pages/LeadsIncompletos"));
const DataHealth = lazy(() => import("@/pages/DataHealth"));
const FullSettings = lazy(() => import("@/pages/Settings"));
const FullUsers = lazy(() => import("@/pages/Users"));
const Products = lazy(() => import("@/pages/Products"));
const Funnelytics = lazy(() => import("@/pages/Funnelytics"));
const CrmPage = lazy(() => import("@/growdash/CrmPage"));
const KanbanPage = lazy(() => import("@/growdash/KanbanPage"));
const CommercialPage = lazy(() => import("@/growdash/CommercialPage"));
const FinancePage = lazy(() => import("@/growdash/FinancePage"));
const StoragePage = lazy(() => import("@/growdash/StoragePage"));
const IntegrationsPage = lazy(() => import("@/growdash/IntegrationsPage"));
const ProfilePage = lazy(() => import("@/growdash/ProfilePage"));
const SocialMediaPage = lazy(() => import("@/growdash/SocialMediaPage"));
const AnnouncementsPage = lazy(() => import("@/growdash/AnnouncementsPage"));
const ModulePage = lazy(() => import("@/growdash/ModulePage"));
const BrandDiagnosticPage = lazy(() => import("@/growdash/BrandDiagnosticPage"));
const IntelligenceCenterPage = lazy(() => import("@/growdash/IntelligenceCenterPage"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SharedLeadReport = lazy(() => import("@/pages/SharedLeadReport"));
const ExpertDashboard = lazy(() => import("@/pages/ExpertDashboard"));

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

function reloadFreshBuild() {
  const retryKey = "growdash:loading-retry";
  let attempts = 0;
  try { attempts = Number(sessionStorage.getItem(retryKey) || "0"); } catch { /* storage is optional */ }
  // One automatic refresh is enough to recover a stale Pages shell. Repeating
  // it can hide a real network/CDN failure behind an endless spinner.
  if (attempts >= 1) return false;
  try { sessionStorage.setItem(retryKey, String(attempts + 1)); } catch { /* a cache-busted reload is still safe */ }
  const url = new URL(window.location.href);
  url.searchParams.set("gd_reload", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

function LoadingModule({ recover = false }: { recover?: boolean }) {
  const [slow, setSlow] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!recover) return;
    // A lazy chunk can remain pending forever after a Pages rollout if a
    // browser holds an old HTML shell. Recover once automatically instead of
    // leaving the person on an endless spinner. If it already recovered once,
    // the visible recovery state stays available rather than retrying forever.
    const timeout = window.setTimeout(() => {
      if (reloadFreshBuild()) setRecovering(true);
      else setSlow(true);
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [recover]);

  return <div className="grid min-h-[40vh] place-items-center px-4 text-center" role="status" aria-live="polite">
    {slow ? <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-6 shadow-xl">
      <p className="font-bold">A Growdash está demorando para responder.</p>
      <p className="mt-2 text-sm text-muted-foreground">A conexão ou uma atualização foi interrompida. Esta tela não continuará tentando sozinha.</p>
      <button type="button" onClick={() => { try { sessionStorage.removeItem("growdash:loading-retry"); } catch { /* storage is optional */ } window.location.reload(); }} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Tentar novamente</button>
    </div> : recovering ? <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-6 shadow-xl"><p className="font-bold">Atualizando a Growdash…</p><p className="mt-2 text-sm text-muted-foreground">Estamos buscando a versão mais recente para recuperar o carregamento.</p></div> : <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Carregando" />}
  </div>;
}

function ClearLoadingRecovery() {
  useEffect(() => {
    // This component only commits after the lazy route tree was actually
    // rendered. Clearing the guard earlier reintroduced an infinite retry.
    try { sessionStorage.removeItem("growdash:loading-retry"); } catch { /* storage is optional */ }
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
    console.error("Growdash render error", error, info.componentStack);
    // A Pages release replaces hashed lazy chunks. Safari can retain the old
    // shell briefly and then fail a dynamic import. Retry exactly once against
    // a cache-busting URL before showing the manual recovery screen.
    const isChunkError = /dynamically imported module|loading chunk|importing a module script|failed to fetch/i.test(error.message);
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
                <AppErrorBoundary>
                  <Suspense fallback={<LoadingModule recover />}>
                    <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/relatorios/:shareToken" element={<SharedLeadReport />} />
                  <Route element={<AuthenticatedLayout />}>
                    <Route index element={<RequirePage page="dashboard">{analytics(<FullDashboard />)}</RequirePage>} />
                    <Route path="painel-expert" element={<RequirePage page="expertDashboard">{analytics(<ExpertDashboard />)}</RequirePage>} />
                    <Route path="dashboard" element={<Navigate to="/" replace />} />
                    <Route path="dashboard/completo" element={<Navigate to="/" replace />} />
                    <Route path="crm" element={<RequirePage page="crm"><CrmPage /></RequirePage>} />
                    <Route path="comercial" element={<RequirePage page="commercial"><CommercialPage /></RequirePage>} />
                    <Route path="campanhas" element={<RequirePage page="campaigns">{analytics(<TrafficPage />)}</RequirePage>} />
                    <Route path="inteligencia" element={<RequirePage page="campaigns">{analytics(<IntelligenceCenterPage />)}</RequirePage>} />
                    <Route path="trafego-pago" element={<Navigate to="/campanhas" replace />} />
                    <Route path="trafego-pago/gerenciador" element={<Navigate to="/campanhas" replace />} />
                    <Route path="campaigns" element={<Navigate to="/campanhas" replace />} />
                    <Route path="analise-de-funis" element={<RequirePage page="funnels">{analytics(<FunnelAnalysis />)}</RequirePage>} />
                    <Route path="analise-funis" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="funnels" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="alertas" element={<RequirePage page="alerts">{analytics(<FullAlerts />)}</RequirePage>} />
                    <Route path="agenda-turmas" element={<RequirePage page="classes">{analytics(<EventClasses />)}</RequirePage>} />
                    <Route path="classes" element={<Navigate to="/agenda-turmas" replace />} />
                    <Route path="leads-incompletos" element={<RequirePage page="leads">{analytics(<IncompleteLeads />)}</RequirePage>} />
                    <Route path="automacoes" element={<RequirePage page="automations"><ModulePage /></RequirePage>} />
                    <Route path="growdash-flow" element={<RequirePage page="flow">{analytics(<Funnelytics />)}</RequirePage>} />
                    <Route path="saude-dos-dados" element={<RequirePage page="dataHealth">{analytics(<DataHealth />)}</RequirePage>} />
                    <Route path="data-health" element={<Navigate to="/saude-dos-dados" replace />} />
                    <Route path="produtos" element={<RequirePage page="products">{analytics(<Products />)}</RequirePage>} />
                    <Route path="configuracoes" element={<RequirePage page="settings">{analytics(<FullSettings />)}</RequirePage>} />
                    <Route path="settings" element={<Navigate to="/configuracoes" replace />} />
                    <Route path="usuarios" element={<RequirePage page="users">{analytics(<FullUsers />)}</RequirePage>} />
                    <Route path="usuarios/avancado" element={<Navigate to="/usuarios" replace />} />
                    <Route path="users" element={<Navigate to="/usuarios" replace />} />
                    <Route path="financeiro" element={<RequirePage page="finance"><FinancePage /></RequirePage>} />
                    <Route path="armazenamento" element={<RequirePage page="storage"><StoragePage /></RequirePage>} />
                    <Route path="integracoes" element={<RequirePage page="integrations"><IntegrationsPage /></RequirePage>} />
                    <Route path="perfil" element={<ProfilePage />} />
                    <Route path="midia-social" element={<RequirePage page="socialMedia">{analytics(<SocialMediaPage />)}</RequirePage>} />
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
                    <ClearLoadingRecovery />
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
