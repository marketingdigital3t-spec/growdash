import { useState } from "react";
import { Goal, Languages, RotateCcw, Save } from "lucide-react";
import { useTheme } from "next-themes";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  defaultCompanySettings,
  readAccountMonthlyGoals,
  readCompanySettings,
  saveAccountMonthlyGoals,
  saveCompanySettings,
  type CompanySettings,
  type PlatformLanguage,
  type PlatformTheme,
} from "@/lib/companySettings";
import { useAdAccounts } from "@/hooks/useAdAccounts";

const languageLabels: Record<PlatformLanguage, string> = {
  "pt-BR": "Português",
  "en-US": "English",
  "es-ES": "Español",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<CompanySettings>(() => readCompanySettings());
  const [accountGoals, setAccountGoals] = useState<Record<string, number>>(() => readAccountMonthlyGoals());
  const { data: adAccounts = [] } = useAdAccounts();

  const update = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    saveCompanySettings(settings);
    saveAccountMonthlyGoals(accountGoals);
    if (settings.defaultTheme !== "system") setTheme(settings.defaultTheme);
    toast({ title: "Configurações salvas", description: "Preferências operacionais aplicadas na plataforma." });
  };

  const reset = () => {
    setSettings(defaultCompanySettings);
    setAccountGoals({});
    saveCompanySettings(defaultCompanySettings);
    saveAccountMonthlyGoals({});
    setTheme(defaultCompanySettings.defaultTheme);
    toast({ title: "Configurações restauradas" });
  };

  const updateAccountGoal = (accountId: string, value: number) => {
    setAccountGoals((current) => ({ ...current, [accountId]: value }));
  };

  return (
    <MotionPage className="mx-auto max-w-5xl space-y-6">
      <MotionItem>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste metas, idioma e preferências operacionais. O branding oficial da Trackvio é fixo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </Button>
            <Button onClick={save} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar configurações
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Goal className="h-5 w-5" />
              Metas mensais por conta
            </CardTitle>
            <CardDescription>
              Cada conta pode ter uma meta diferente. Em “Todas as contas”, a barra soma as metas configuradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 rounded-lg border bg-background/35 p-4 md:grid-cols-[1fr_220px] md:items-center">
              <div>
                <p className="font-semibold">Meta mensal padrão</p>
                <p className="text-xs text-muted-foreground">Fallback usado quando uma conta não tiver meta própria.</p>
              </div>
              <Input
                type="number"
                min={0}
                value={settings.monthlyGoal}
                onChange={(event) => update("monthlyGoal", Number(event.target.value))}
              />
            </div>

            {adAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma conta vinculada ainda. Conecte contas em Integrações para configurar metas individuais.
              </div>
            ) : (
              adAccounts.map((account) => (
                <div key={account.id} className="grid gap-3 rounded-lg border bg-background/35 p-4 md:grid-cols-[1fr_220px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{account.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.account_id}</p>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Meta mensal</Label>
                    <Input
                      type="number"
                      min={0}
                      value={accountGoals[account.id] ?? ""}
                      onChange={(event) => updateAccountGoal(account.id, Number(event.target.value || 0))}
                      placeholder={String(settings.monthlyGoal)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </MotionItem>

      <MotionItem>
        <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Idioma e tema
            </CardTitle>
            <CardDescription>Preferências gerais da experiência da plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Idioma da plataforma</Label>
              <Select value={settings.language} onValueChange={(value) => update("language", value as PlatformLanguage)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(languageLabels) as PlatformLanguage[]).map((language) => (
                    <SelectItem key={language} value={language}>
                      {languageLabels[language]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tema padrão</Label>
              <Select value={settings.defaultTheme} onValueChange={(value) => update("defaultTheme", value as PlatformTheme)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark mode</SelectItem>
                  <SelectItem value="light">Light mode</SelectItem>
                  <SelectItem value="system">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </MotionItem>
    </MotionPage>
  );
}
