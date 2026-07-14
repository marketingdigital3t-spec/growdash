import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import GrowdashLayout from "@/growdash/GrowdashLayout";
import DashboardPage from "@/growdash/DashboardPage";
import CrmPage from "@/growdash/CrmPage";
import FinancePage from "@/growdash/FinancePage";
import IntegrationsPage from "@/growdash/IntegrationsPage";
import ManagementPage from "@/growdash/ManagementPage";
import ModulePage from "@/growdash/ModulePage";
import TrafficPage from "@/growdash/TrafficPage";
import HistoricalModule from "@/growdash/HistoricalModule";

const FullDashboard = lazy(() => import("@/pages/Index"));
const FullCampaigns = lazy(() => import("@/pages/Campaigns"));
const FunnelAnalysis = lazy(() => import("@/pages/FunnelAnalysis"));
const FullAlerts = lazy(() => import("@/pages/Alerts"));
const EventClasses = lazy(() => import("@/pages/EventClasses"));
const IncompleteLeads = lazy(() => import("@/pages/LeadsIncompletos"));
const DataHealth = lazy(() => import("@/pages/DataHealth"));
const FullSettings = lazy(() => import("@/pages/Settings"));
const FullUsers = lazy(() => import("@/pages/Users"));
const Products = lazy(() => import("@/pages/Products"));
const Funnelytics = lazy(() => import("@/pages/Funnelytics"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function LoadingModule() {
  return <div className="grid min-h-[40vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#d5a62a] border-t-transparent" /></div>;
}

const historical = (title: string, source: string, element: ReactNode) => (
  <HistoricalModule title={title} source={source}>{element}</HistoricalModule>
);

export default function App() {
  const Router = import.meta.env.VITE_STATIC_HTML === "true" ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AuthProvider>
              <Suspense fallback={<LoadingModule />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<GrowdashLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="dashboard/completo" element={historical("Dashboard completo", "Dashboard histórico + widgets editáveis", <FullDashboard />)} />
                    <Route path="crm" element={<CrmPage />} />
                    <Route path="trafego-pago" element={<TrafficPage />} />
                    <Route path="trafego-pago/gerenciador" element={historical("Gerenciador avançado", "Campanhas, conjuntos, anúncios e métricas históricas", <FullCampaigns />)} />
                    <Route path="analise-de-funis" element={historical("Análise de Funis", "Funis e negociações sincronizados do RD Station", <FunnelAnalysis />)} />
                    <Route path="alertas" element={historical("Alertas", "Diagnósticos de campanha, orçamento e saldo", <FullAlerts />)} />
                    <Route path="agenda-turmas" element={historical("Agenda & Turmas", "Eventos, capacidade e membros vindos do RD Station", <EventClasses />)} />
                    <Route path="leads-incompletos" element={historical("Leads incompletos", "Auditoria e correção dos dados recebidos do CRM", <IncompleteLeads />)} />
                    <Route path="growdash-flow" element={historical("Growdash Flow", "Construtor visual de jornadas e funis", <Funnelytics />)} />
                    <Route path="saude-dos-dados" element={historical("Saúde dos Dados", "Validação Meta/RD, duplicidades e reconciliação", <DataHealth />)} />
                    <Route path="produtos" element={historical("Produtos", "Produtos, vendas e atribuição de receita", <Products />)} />
                    <Route path="configuracoes" element={historical("Configurações", "Integrações, UTMs, métricas e regras da plataforma", <FullSettings />)} />
                    <Route path="usuarios/avancado" element={historical("Usuários e permissões", "Acesso por conta de anúncio e funil", <FullUsers />)} />
                    <Route path="financeiro" element={<FinancePage />} />
                    <Route path="integracoes" element={<IntegrationsPage />} />
                    <Route path="marcas" element={<ManagementPage />} />
                    <Route path="usuarios" element={<ManagementPage />} />
                    <Route path="agentes" element={<ManagementPage />} />
                    <Route path="anuncios" element={<ManagementPage />} />
                    <Route path=":module" element={<ModulePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
