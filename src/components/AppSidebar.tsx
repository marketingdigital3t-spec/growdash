import { BarChart3, LayoutDashboard, Megaphone, Bell, Settings, LogOut, Moon, Sun, AlertCircle, GitBranch, CalendarDays, Users as UsersIcon, HeartPulse } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppSidebar() {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const perms = usePermissions();

  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: perms.canDashboard },
    { title: "Campanhas", url: "/campanhas", icon: Megaphone, show: perms.canCampaigns },
    { title: "Análise de Funis", url: "/analise-de-funis", icon: GitBranch, show: perms.canFunnels },
    { title: "Datas & Turmas", url: "/agenda-turmas", icon: CalendarDays, show: perms.canClasses },
    { title: "Leads incompletos", url: "/leads-incompletos", icon: AlertCircle, show: perms.isMaster },
    { title: "Alertas", url: "/alerts", icon: Bell, show: perms.isMaster },
    { title: "Usuários", url: "/usuarios", icon: UsersIcon, show: perms.isMaster },
    { title: "Saúde dos Dados", url: "/saude-dos-dados", icon: HeartPulse, show: perms.isMaster },
    { title: "Configurações", url: "/configuracoes", icon: Settings, show: perms.isMaster },
  ].filter((i) => i.show);

  const handleNavClick = () => {
    if (isMobile) toggleSidebar();
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">Meta Ads</span>
              <span className="text-xs text-sidebar-foreground/60">Analytics</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-1">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <div className="relative h-4 w-4 shrink-0">
            <Sun className={`h-4 w-4 absolute inset-0 transition-all duration-500 ${theme === "dark" ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`} />
            <Moon className={`h-4 w-4 absolute inset-0 transition-all duration-500 ${theme === "dark" ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`} />
          </div>
          {!collapsed && <span className="ml-3">{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent transition-all duration-300"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-3">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
