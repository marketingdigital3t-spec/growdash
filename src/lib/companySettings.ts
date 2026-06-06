export type PlatformLanguage = "pt-BR" | "en-US" | "es-ES";
export type PlatformTheme = "dark" | "light" | "system";

export interface CompanySettings {
  companyName: string;
  companyDescription: string;
  logoDataUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  palette: string;
  defaultTheme: PlatformTheme;
  language: PlatformLanguage;
  monthlyGoal: number;
  seoTitle: string;
  seoDescription: string;
  seoLogoDataUrl: string;
}

export const COMPANY_SETTINGS_KEY = "growthos:company-settings";
export const ACCOUNT_MONTHLY_GOALS_KEY = "trackvio:account-monthly-goals";
export const TRACKVIO_BRAND_NAME = "Trackvio";
export const TRACKVIO_BRAND_LOGO = "/trackvio-logo-full.png";
export const TRACKVIO_BRAND_ICON = "/trackvio-logo-tv.png";
export const TRACKVIO_BRAND_DESCRIPTION = "Sistema operacional de receita com IA para escalar aquisição, vendas e margem.";

const routePageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/auth": "Login",
  "/campaigns": "Campanhas",
  "/funnels": "Análise de Funis",
  "/crm": "CRM",
  "/commercial": "Comercial",
  "/classes": "Datas & Turmas",
  "/leads-incompletos": "Leads incompletos",
  "/alerts": "Alertas",
  "/users": "Usuários",
  "/integrations": "Integrações",
  "/announcements": "Anúncios",
  "/automations": "Automações",
  "/plans": "Planos",
  "/settings": "Configurações",
};

export const defaultCompanySettings: CompanySettings = {
  companyName: TRACKVIO_BRAND_NAME,
  companyDescription: TRACKVIO_BRAND_DESCRIPTION,
  logoDataUrl: TRACKVIO_BRAND_LOGO,
  primaryColor: "#8f5cff",
  secondaryColor: "#c026ff",
  accentColor: "#7c3cff",
  palette: "trackvio",
  defaultTheme: "dark",
  language: "pt-BR",
  monthlyGoal: 250000,
  seoTitle: "Trackvio | Revenue Intelligence",
  seoDescription: "Plataforma de inteligência de receita para tráfego, vendas, CRM e operação comercial.",
  seoLogoDataUrl: TRACKVIO_BRAND_ICON,
};

function normalizeHex(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return clean;
}

function hexToHsl(hex: string) {
  const clean = normalizeHex(hex);
  if (!clean) return null;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToRgb(hex: string) {
  const clean = normalizeHex(hex);
  if (!clean) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(l1: number, l2: number) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(hex: string) {
  const luminance = relativeLuminance(hex);
  if (luminance == null) return "#ffffff";

  const whiteContrast = contrastRatio(luminance, 1);
  const blackContrast = contrastRatio(luminance, 0);
  return blackContrast >= whiteContrast ? "#020617" : "#ffffff";
}

function hexToCssRgb(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

export function readCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(COMPANY_SETTINGS_KEY);
    if (!raw) return defaultCompanySettings;
    const parsed = JSON.parse(raw);
    return {
      ...defaultCompanySettings,
      defaultTheme: parsed.defaultTheme || defaultCompanySettings.defaultTheme,
      language: parsed.language || defaultCompanySettings.language,
      monthlyGoal: Number(parsed.monthlyGoal || defaultCompanySettings.monthlyGoal),
    };
  } catch {
    return defaultCompanySettings;
  }
}

export function saveCompanySettings(settings: CompanySettings) {
  const next = {
    ...defaultCompanySettings,
    defaultTheme: settings.defaultTheme,
    language: settings.language,
    monthlyGoal: Number(settings.monthlyGoal || defaultCompanySettings.monthlyGoal),
  };
  localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(next));
  applyCompanyBranding(next);
  applyCompanySEO(next);
  window.dispatchEvent(new CustomEvent("growthos:company-settings-updated", { detail: next }));
}

export function readAccountMonthlyGoals(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_MONTHLY_GOALS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveAccountMonthlyGoals(goals: Record<string, number>) {
  localStorage.setItem(ACCOUNT_MONTHLY_GOALS_KEY, JSON.stringify(goals));
  window.dispatchEvent(new CustomEvent("trackvio:account-monthly-goals-updated", { detail: goals }));
}

export function getMonthlyGoalForScope(
  selectedAccountId: string,
  adAccounts: { id: string }[],
  fallbackGoal: number,
  goals = readAccountMonthlyGoals(),
) {
  if (selectedAccountId && selectedAccountId !== "all") {
    return Math.max(Number(goals[selectedAccountId] || fallbackGoal || 0), 1);
  }
  const accountGoals = adAccounts.map((account) => Number(goals[account.id] || 0)).filter((goal) => goal > 0);
  if (accountGoals.length > 0) return Math.max(accountGoals.reduce((sum, goal) => sum + goal, 0), 1);
  return Math.max(Number(fallbackGoal || 0), 1);
}

export function applyPageSEO(pageTitle?: string, settings = readCompanySettings()) {
  const brand = TRACKVIO_BRAND_NAME;
  document.title = pageTitle ? `${pageTitle} | ${brand}` : defaultCompanySettings.seoTitle;

  const description = defaultCompanySettings.seoDescription;
  let metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement("meta");
    metaDescription.name = "description";
    document.head.appendChild(metaDescription);
  }
  metaDescription.content = description;

  const iconHref = TRACKVIO_BRAND_ICON;
  if (iconHref) {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = iconHref;
  }
}

export function applyCompanySEO(settings = readCompanySettings()) {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  applyPageSEO(routePageTitles[currentPath], settings);
}

export function getRoutePageTitle(pathname: string) {
  return routePageTitles[pathname] || "Trackvio";
}

export function applyCompanyBranding(settings = readCompanySettings()) {
  const primary = hexToHsl(defaultCompanySettings.primaryColor);
  const secondary = hexToHsl(defaultCompanySettings.secondaryColor);
  const accent = hexToHsl(defaultCompanySettings.accentColor);
  const primaryForeground = hexToHsl(getReadableTextColor(defaultCompanySettings.primaryColor));
  const secondaryForeground = hexToHsl(getReadableTextColor(defaultCompanySettings.secondaryColor));
  const accentForeground = hexToHsl(getReadableTextColor(defaultCompanySettings.accentColor));
  const accentRgb = hexToCssRgb(defaultCompanySettings.accentColor);
  const root = document.documentElement;

  if (primary) {
    root.style.setProperty("--primary", primary);
    if (primaryForeground) root.style.setProperty("--primary-foreground", primaryForeground);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    if (primaryForeground) root.style.setProperty("--sidebar-primary-foreground", primaryForeground);
    root.style.setProperty("--sidebar-ring", primary);
  }
  if (secondary) {
    root.style.setProperty("--success", secondary);
    if (secondaryForeground) root.style.setProperty("--success-foreground", secondaryForeground);
  }
  if (accent) {
    root.style.setProperty("--growth-accent", accent);
    if (accentForeground) root.style.setProperty("--growth-accent-foreground", accentForeground);
    if (accentRgb) root.style.setProperty("--growth-accent-rgb", accentRgb);
  }
}
