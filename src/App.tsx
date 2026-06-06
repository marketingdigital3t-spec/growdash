import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { usePermissions, firstAllowedPath, PagePermission } from "@/hooks/usePermissions";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Campaigns from "./pages/Campaigns";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import LeadsIncompletos from "./pages/LeadsIncompletos";
import FunnelAnalysis from "./pages/FunnelAnalysis";
import EventClasses from "./pages/EventClasses";
import Users from "./pages/Users";
import CRM from "./pages/CRM";
import Commercial from "./pages/Commercial";
import Announcements from "./pages/Announcements";
import Automations from "./pages/Automations";
import Plans from "./pages/Plans";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Loader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
    </div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequirePage({ page, children }: { page: PagePermission | "master"; children: React.ReactNode }) {
  const perms = usePermissions();
  if (perms.loading) return <Loader />;
  const allowed =
    page === "master"
      ? perms.isMaster
      : page === "dashboard"
      ? perms.canDashboard
      : page === "campaigns"
      ? perms.canCampaigns
      : page === "funnels"
      ? perms.canFunnels
      : page === "classes"
      ? perms.canClasses
      : false;
  if (!allowed) {
    const fallback = firstAllowedPath(perms);
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return <Loader />;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppErrorBoundary>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<RequirePage page="dashboard"><Index /></RequirePage>} />
                  <Route path="campaigns" element={<RequirePage page="campaigns"><Campaigns /></RequirePage>} />
                  <Route path="funnels" element={<RequirePage page="funnels"><FunnelAnalysis /></RequirePage>} />
                  <Route path="crm" element={<RequirePage page="funnels"><CRM /></RequirePage>} />
                  <Route path="commercial" element={<RequirePage page="funnels"><Commercial /></RequirePage>} />
                  <Route path="classes" element={<RequirePage page="classes"><EventClasses /></RequirePage>} />
                  <Route path="alerts" element={<RequirePage page="master"><Alerts /></RequirePage>} />
                  <Route path="integrations" element={<RequirePage page="master"><Integrations /></RequirePage>} />
                  <Route path="announcements" element={<RequirePage page="master"><Announcements /></RequirePage>} />
                  <Route path="automations" element={<RequirePage page="master"><Automations /></RequirePage>} />
                  <Route path="plans" element={<Plans />} />
                  <Route path="settings" element={<RequirePage page="master"><Settings /></RequirePage>} />
                  <Route path="leads-incompletos" element={<RequirePage page="master"><LeadsIncompletos /></RequirePage>} />
                  <Route path="users" element={<RequirePage page="master"><Users /></RequirePage>} />
                </Route>
                <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
              </Routes>
            </AppErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
