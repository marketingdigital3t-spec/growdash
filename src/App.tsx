import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import GrowdashLayout from "@/growdash/GrowdashLayout";
import { firstAllowedPath, type PagePermission, usePermissions } from "@/hooks/usePermissions";

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
const CommercialPage = lazy(() => import("@/growdash/CommercialPage"));
const FinancePage = lazy(() => import("@/growdash/FinancePage"));
const StoragePage = lazy(() => import("@/growdash/StoragePage"));
const IntegrationsPage = lazy(() => import("@/growdash/IntegrationsPage"));
const ProfilePage = lazy(() => import("@/growdash/ProfilePage"));
const ModulePage = lazy(() => import("@/growdash/ModulePage"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function LoadingModule() {
  return <div className="grid min-h-[40vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#d5a62a] border-t-transparent" /></div>;
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingModule />;
  if (!user) return <Navigate to="/auth" replace />;
  return <GrowdashLayout />;
}

function RequirePage({ page, children }: { page: PagePermission | "master"; children: ReactNode }) {
  const permissions = usePermissions();
  if (permissions.loading) return <LoadingModule />;
  const allowed = page === "master"
    ? permissions.isMaster
    : page === "dashboard"
      ? permissions.canDashboard
      : page === "campaigns"
        ? permissions.canCampaigns
        : page === "funnels"
          ? permissions.canFunnels
          : permissions.canClasses;

  if (!allowed) return <Navigate to={firstAllowedPath(permissions)} replace />;
  return <>{children}</>;
}

const analytics = (element: ReactNode) => (
  <div className="analytics-module -m-3 min-h-[calc(100vh-48px)] bg-background p-3 text-foreground sm:-m-5 sm:p-5">
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
              <GlobalFiltersProvider>
                <Suspense fallback={<LoadingModule />}>
                  <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<AuthenticatedLayout />}>
                    <Route index element={<RequirePage page="dashboard">{analytics(<FullDashboard />)}</RequirePage>} />
                    <Route path="dashboard/completo" element={<Navigate to="/" replace />} />
                    <Route path="crm" element={<CrmPage />} />
                    <Route path="comercial" element={<CommercialPage />} />
                    <Route path="campanhas" element={<RequirePage page="campaigns">{analytics(<TrafficPage />)}</RequirePage>} />
                    <Route path="trafego-pago" element={<Navigate to="/campanhas" replace />} />
                    <Route path="trafego-pago/gerenciador" element={<Navigate to="/campanhas" replace />} />
                    <Route path="campaigns" element={<Navigate to="/campanhas" replace />} />
                    <Route path="analise-de-funis" element={<RequirePage page="funnels">{analytics(<FunnelAnalysis />)}</RequirePage>} />
                    <Route path="funnels" element={<Navigate to="/analise-de-funis" replace />} />
                    <Route path="alertas" element={<RequirePage page="master">{analytics(<FullAlerts />)}</RequirePage>} />
                    <Route path="agenda-turmas" element={<RequirePage page="classes">{analytics(<EventClasses />)}</RequirePage>} />
                    <Route path="classes" element={<Navigate to="/agenda-turmas" replace />} />
                    <Route path="leads-incompletos" element={<RequirePage page="master">{analytics(<IncompleteLeads />)}</RequirePage>} />
                    <Route path="growdash-flow" element={analytics(<Funnelytics />)} />
                    <Route path="saude-dos-dados" element={<RequirePage page="master">{analytics(<DataHealth />)}</RequirePage>} />
                    <Route path="data-health" element={<Navigate to="/saude-dos-dados" replace />} />
                    <Route path="produtos" element={<RequirePage page="master">{analytics(<Products />)}</RequirePage>} />
                    <Route path="configuracoes" element={<RequirePage page="master">{analytics(<FullSettings />)}</RequirePage>} />
                    <Route path="settings" element={<Navigate to="/configuracoes" replace />} />
                    <Route path="usuarios" element={<RequirePage page="master">{analytics(<FullUsers />)}</RequirePage>} />
                    <Route path="usuarios/avancado" element={<Navigate to="/usuarios" replace />} />
                    <Route path="users" element={<Navigate to="/usuarios" replace />} />
                    <Route path="financeiro" element={<FinancePage />} />
                    <Route path="armazenamento" element={<StoragePage />} />
                    <Route path="integracoes" element={<IntegrationsPage />} />
                    <Route path="perfil" element={<ProfilePage />} />
                    <Route path="kanban" element={<Navigate to="/crm" replace />} />
                    <Route path="anuncios" element={<Navigate to="/campanhas" replace />} />
                    <Route path="marcas" element={<ModulePage />} />
                    <Route path="agentes" element={<ModulePage />} />
                    <Route path=":module" element={<ModulePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                  </Routes>
                </Suspense>
              </GlobalFiltersProvider>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
