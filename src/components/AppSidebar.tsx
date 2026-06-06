import { useMemo } from "react";
import { BadgeHelp, Bot, ChevronRight, CreditCard, ImagePlus, LayoutDashboard, Megaphone, Bell, Settings, LogOut, Moon, Sun, AlertCircle, GitBranch, CalendarDays, Users as UsersIcon, Link2, Handshake, Trophy, Palette, Sparkles, UserCircle } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GROWDASH_BRAND_ICON, GROWDASH_BRAND_LOGO, GROWDASH_BRAND_NAME } from "@/lib/companySettings";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const perms = usePermissions();
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: perms.canDashboard },
    { title: "Campanhas", url: "/campaigns", icon: Megaphone, show: perms.canCampaigns },
    { title: "Análise de Funis", url: "/funnels", icon: GitBranch, show: perms.canFunnels },
    { title: "CRM", url: "/crm", icon: Handshake, show: perms.canCRM },
    { title: "Comercial", url: "/commercial", icon: Trophy, show: perms.canCommercial },
    { title: "Datas & Turmas", url: "/classes", icon: CalendarDays, show: perms.canClasses },
    { title: "Leads incompletos", url: "/leads-incompletos", icon: AlertCircle, show: perms.isMaster || perms.canLeads },
    { title: "Alertas", url: "/alerts", icon: Bell, show: perms.isMaster || perms.canAlerts },
    { title: "Usuários", url: "/users", icon: UsersIcon, show: perms.isMaster || perms.canUsers },
    { title: "Integrações", url: "/integrations", icon: Link2, show: perms.isMaster || perms.canIntegrations },
    { title: "Anúncios", url: "/announcements", icon: ImagePlus, show: perms.isMaster || perms.canAnnouncements },
    { title: "Automações", url: "/automations", icon: Bot, show: perms.isMaster || perms.canAutomations },
  ].filter((i) => i.show);


  const handleNavClick = () => {
    if (isMobile) toggleSidebar();
  };

  const profileName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Perfil";
  const profileEmail = profile?.email || user?.email || "";
  const profileInitials = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
  const planName = perms.isMaster ? "Proprietário" : "Plus";

  const goTo = (path: string) => {
    navigate(path);
    if (isMobile) toggleSidebar();
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-3">
        <div className={collapsed ? "flex items-center justify-center" : "flex items-center gap-3"}>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-visible",
              collapsed
                ? "h-11 w-11 rounded-xl border border-primary/35 bg-black/25 shadow-[0_0_34px_hsl(var(--primary)/0.38)]"
                : "h-16 w-full min-w-0 max-w-[210px] justify-start",
            )}
          >
            <img
              src={collapsed ? GROWDASH_BRAND_ICON : GROWDASH_BRAND_LOGO}
              alt={GROWDASH_BRAND_NAME}
              className={cn("object-contain", collapsed ? "h-10 w-10" : "h-full w-full object-left")}
            />
          </div>
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      activeClassName="bg-primary/10 text-sidebar-foreground font-medium ring-1 ring-primary/25"
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground" />
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
          className={cn("w-full text-sidebar-foreground/70 transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "justify-center" : "justify-start")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <div className="relative h-4 w-4 shrink-0">
            <Sun className={`h-4 w-4 absolute inset-0 text-sidebar-foreground transition-all duration-500 ${theme === "dark" ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`} />
            <Moon className={`h-4 w-4 absolute inset-0 text-sidebar-foreground transition-all duration-500 ${theme === "dark" ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`} />
          </div>
          {!collapsed && <span className="ml-3">{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className={cn(
                "h-auto w-full text-sidebar-foreground/80 transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "justify-center p-2" : "justify-start gap-3 px-2 py-2",
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 border border-primary/25 bg-primary/10">
                <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">{profileInitials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold leading-tight">{profileName}</p>
                    <p className="truncate text-xs text-sidebar-foreground/55">{planName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-sidebar-foreground/55" />
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align={collapsed ? "center" : "start"}
            sideOffset={10}
            className="w-72 rounded-lg border-white/10 bg-popover/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 rounded-md p-2">
              <Avatar className="h-11 w-11 border border-primary/25 bg-primary/10">
                <AvatarFallback className="bg-primary/20 font-semibold text-primary">{profileInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{profileName}</p>
                <p className="truncate text-sm text-muted-foreground">{planName}</p>
                {profileEmail && <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => goTo("/plans")}>
                <Sparkles className="h-4 w-4" /> Subir de plano
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => goTo("/settings#branding")}>
                <Palette className="h-4 w-4" /> Personalização
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => goTo("/users")}>
                <UserCircle className="h-4 w-4" /> Perfil
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => goTo("/settings")}>
                <Settings className="h-4 w-4" /> Configurações
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => goTo("/plans")}>
                <CreditCard className="h-4 w-4" /> Ver planos
              </Button>
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-3">
                <BadgeHelp className="h-4 w-4" /> Ajuda
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
