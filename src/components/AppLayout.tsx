import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { useEffect } from "react";
import { RevenueTopBar } from "@/components/RevenueTopBar";
import { TrackvioAIButton } from "@/components/TrackvioAIButton";
import { GlobalAnnouncementBanner } from "@/components/GlobalAnnouncementBanner";
import { FirstAccessPasswordDialog } from "@/components/FirstAccessPasswordDialog";
import { applyCompanyBranding, readCompanySettings } from "@/lib/companySettings";
import { useTheme } from "next-themes";
import { usePageSEO } from "@/hooks/usePageSEO";

export function AppLayout() {
  const { setTheme } = useTheme();
  usePageSEO();
  const location = useLocation();
  const isDashboard = location.pathname === "/" || location.pathname === "/index";


  useEffect(() => {
    const apply = () => {
      const settings = readCompanySettings();
      applyCompanyBranding(settings);
      if (settings.defaultTheme !== "system") setTheme(settings.defaultTheme);
    };
    apply();
    window.addEventListener("growthos:company-settings-updated", apply);
    return () => window.removeEventListener("growthos:company-settings-updated", apply);
  }, [setTheme]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="h-screen flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-white/10 bg-background/78 px-4 backdrop-blur-xl md:px-6">
            <SidebarTrigger className="transition-opacity duration-200 hover:opacity-70" />
          </header>
          {isDashboard && <RevenueTopBar />}
          <GlobalAnnouncementBanner />
          <div className="p-4 md:p-6">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
        <TrackvioAIButton />
        <FirstAccessPasswordDialog />
      </div>
    </SidebarProvider>
  );
}
