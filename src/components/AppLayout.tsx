import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { SidebarProvider } from "./sidebar-context";
import { ClinicProvider } from "@/store/clinic-store";

export default function AppLayout() {
  return (
    <ClinicProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full bg-background text-foreground">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ClinicProvider>
  );
}
