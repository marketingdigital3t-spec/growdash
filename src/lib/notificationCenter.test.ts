import { describe, expect, it } from "vitest";
import { filterNotifications, type GrowdashNotification, type NotificationPermissions } from "./notificationCenter";

const notifications: GrowdashNotification[] = [
  { id: "dash", title: "Dashboard", description: "Resumo", severity: "info", scope: "dashboard", href: "/" },
  { id: "campaign-a", title: "Conta A", description: "Alerta A", severity: "critical", scope: "campaigns", href: "/campanhas", adAccountId: "a" },
  { id: "campaign-b", title: "Conta B", description: "Alerta B", severity: "warning", scope: "campaigns", href: "/campanhas", adAccountId: "b" },
  { id: "funnel", title: "Funil", description: "Gargalo", severity: "warning", scope: "funnels", href: "/analise-de-funis" },
];

function permissions(overrides: Partial<NotificationPermissions> = {}): NotificationPermissions {
  return { isMaster: false, canDashboard: false, canCampaigns: false, canFunnels: false, canClasses: false, canViewAllAccounts: false, allowedAdAccounts: [], ...overrides };
}

describe("filterNotifications", () => {
  it("permite tudo para o proprietário", () => {
    expect(filterNotifications(notifications, permissions({ isMaster: true }))).toHaveLength(4);
  });

  it("não vaza alertas de tráfego para quem só acessa o dashboard", () => {
    expect(filterNotifications(notifications, permissions({ canDashboard: true })).map((item) => item.id)).toEqual(["dash"]);
  });

  it("limita alertas às contas explicitamente atribuídas", () => {
    expect(filterNotifications(notifications, permissions({ canCampaigns: true, allowedAdAccounts: ["a"] })).map((item) => item.id)).toEqual(["campaign-a"]);
  });

  it("não interpreta lista vazia como acesso global", () => {
    expect(filterNotifications(notifications, permissions({ canCampaigns: true }))).toEqual([]);
  });

  it("permite todas as contas retornadas por RLS para administradores do workspace", () => {
    expect(filterNotifications(notifications, permissions({ canCampaigns: true, canViewAllAccounts: true })).map((item) => item.id)).toEqual(["campaign-a", "campaign-b"]);
  });
});
