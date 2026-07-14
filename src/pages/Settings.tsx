import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useSyncBalance } from "@/hooks/useSyncBalance";
import { useBackfillMeta } from "@/hooks/useBackfillMeta";
import { useMetaOAuth } from "@/hooks/useMetaOAuth";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Trash2, RefreshCw, Key, Info, Pencil, Check, X, Link2, Copy, Facebook, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { motion, AnimatePresence } from "framer-motion";
import { RDFunnelsSection } from "@/components/settings/RDFunnelsSection";
import { RDIntegrationCard } from "@/components/settings/RDIntegrationCard";
import { MetaManualConnectionCard } from "@/components/settings/MetaManualConnectionCard";
import { UTMConventionCard } from "@/components/settings/UTMConventionCard";
import { UTMMappingCard } from "@/components/settings/UTMMappingCard";
import { PlatformRulesSection } from "@/components/settings/PlatformRulesSection";
import { CustomMetricsSection } from "@/components/settings/CustomMetricsSection";
import { RDHealthCheckCard } from "@/components/settings/RDHealthCheckCard";
import { RDReconcileCard } from "@/components/settings/RDReconcileCard";
import { RDObservabilityCard } from "@/components/settings/RDObservabilityCard";
import { RDUTMDiagnosticsCard } from "@/components/settings/RDUTMDiagnosticsCard";
import { AccountConnectionStatus } from "@/components/settings/AccountConnectionStatus";
import { RDCustomFieldsCard } from "@/components/settings/RDCustomFieldsCard";

export default function SettingsPage() {
  const { data: adAccounts = [] } = useAdAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const connectMeta = useMetaOAuth();
  const { data: integration } = useRDIntegration();
  const [searchParams] = useSearchParams();

  const [emailAlerts, setEmailAlerts] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editDailyBudget, setEditDailyBudget] = useState("");
  const [editRemainingBalance, setEditRemainingBalance] = useState("");
  const [editTargetCpl, setEditTargetCpl] = useState("");
  const [editMinSpend, setEditMinSpend] = useState("");

  useEffect(() => {
    const target = searchParams.get("integration");
    if (!target) return;
    const id = target === "meta" ? "meta-integration" : target === "rd" ? "rd-integration" : "";
    if (!id) return;
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [searchParams]);

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta removida" });
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, name, account_id, daily_budget, remaining_balance, target_cpl, min_spend_threshold }: { id: string; name: string; account_id: string; daily_budget: string; remaining_balance: string; target_cpl: string; min_spend_threshold: string }) => {
      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (account_id) updates.account_id = account_id;
      updates.daily_budget = daily_budget ? parseFloat(daily_budget) : null;
      updates.remaining_balance = remaining_balance ? parseFloat(remaining_balance) : null;
      updates.target_cpl = target_cpl ? parseFloat(target_cpl) : null;
      if (min_spend_threshold) updates.min_spend_threshold = parseFloat(min_spend_threshold);
      const { error } = await supabase.from("ad_accounts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta atualizada!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const syncMeta = useSyncMeta();
  const syncBalance = useSyncBalance();
  const backfill = useBackfillMeta();

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-rd-crm`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!" });
  };

  const syncData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    await syncMeta.mutateAsync({ startDate: thirtyDaysAgo, endDate: today });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  };

  const syncBalanceData = async () => {
    await syncBalance.mutateAsync();
    queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
  };

  return (
    <MotionPage className="space-y-6 w-full max-w-7xl mx-auto">
      <MotionItem>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas contas e preferências</p>
      </MotionItem>

      {/* Ad Accounts */}
      <MotionItem>
        <Card id="meta-integration">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Ad Accounts</CardTitle>
            <CardDescription>Adicione suas contas de anúncio da Meta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="popLayout">
              {adAccounts.map((acc) => (
                <motion.div
                  key={acc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-lg border p-3 space-y-2"
                >
                  {editingId === acc.id ? (
                    <div className="space-y-2">
                      <Input placeholder="Nome" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <Input placeholder="Account ID (ex: act_123456)" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)} />
                      <Input type="number" placeholder="Orçamento diário (R$)" value={editDailyBudget} onChange={(e) => setEditDailyBudget(e.target.value)} />
                      <Input type="number" placeholder="Saldo restante (R$)" value={editRemainingBalance} onChange={(e) => setEditRemainingBalance(e.target.value)} />
                      <Input type="number" placeholder="CPL alvo padrão (R$) — usado nos alertas" value={editTargetCpl} onChange={(e) => setEditTargetCpl(e.target.value)} />
                      <Input type="number" placeholder="Gasto mínimo p/ alerta (R$, padrão 50)" value={editMinSpend} onChange={(e) => setEditMinSpend(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateAccount.mutate({ id: acc.id, name: editName, account_id: editAccountId, daily_budget: editDailyBudget, remaining_balance: editRemainingBalance, target_cpl: editTargetCpl, min_spend_threshold: editMinSpend })} disabled={updateAccount.isPending}>
                          <Check className="h-4 w-4 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {acc.account_id}</p>
                          {(acc.daily_budget || acc.remaining_balance) && (
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              {acc.daily_budget != null && <span>Orçamento: <AnimatedNumber value={Number(acc.daily_budget)} prefix="R$ " decimals={2} duration={500} />/dia</span>}
                              {acc.remaining_balance != null && <span>Saldo: <AnimatedNumber value={Number(acc.remaining_balance)} prefix="R$ " decimals={2} duration={500} /></span>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingId(acc.id); setEditName(acc.name); setEditAccountId(acc.account_id); setEditDailyBudget(acc.daily_budget != null ? String(acc.daily_budget) : ""); setEditRemainingBalance(acc.remaining_balance != null ? String(acc.remaining_balance) : ""); setEditTargetCpl((acc as any).target_cpl != null ? String((acc as any).target_cpl) : ""); setEditMinSpend((acc as any).min_spend_threshold != null ? String((acc as any).min_spend_threshold) : ""); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteAccount.mutate(acc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <AccountConnectionStatus
                        status={(acc as any).connection_status}
                        errorMessage={(acc as any).last_sync_error}
                        errorCode={(acc as any).last_sync_error_code}
                        lastAttemptAt={(acc as any).last_sync_attempt_at}
                        lastSuccessAt={(acc as any).last_sync_success_at}
                        onReconnect={() => connectMeta.mutate()}
                        onRetry={syncBalanceData}
                        retrying={syncBalance.isPending}
                      />
                    </div>

                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Conexão oficial e segura</p>
                  <p className="text-xs text-muted-foreground">
                    Entre na Meta, escolha as permissões e a Growdash importará automaticamente todas as contas de anúncio disponíveis. Sua senha da Meta nunca passa pela Growdash.
                  </p>
                </div>
              </div>
              <Button onClick={() => connectMeta.mutate()} disabled={connectMeta.isPending} className="w-full sm:w-auto">
                <Facebook className="h-4 w-4 mr-2" />
                {connectMeta.isPending ? "Abrindo a Meta…" : "Continuar com Facebook/Meta"}
              </Button>
            </div>

            <div className="border-t pt-4">
              <MetaManualConnectionCard />
            </div>
          </CardContent>
        </Card>
      </MotionItem>

      {/* Sync */}
      <MotionItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Sincronização</CardTitle>
            <CardDescription>Atualize os dados das suas campanhas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <Button onClick={syncData} disabled={syncMeta.isPending || backfill.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncMeta.isPending && "animate-spin")} />
                {syncMeta.isPending ? "Sincronizando..." : "Sincronizar Campanhas"}
              </Button>
              <Button variant="outline" onClick={syncBalanceData} disabled={syncBalance.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncBalance.isPending && "animate-spin")} />
                {syncBalance.isPending ? "Atualizando saldo..." : "Atualizar Saldo das BMs"}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await backfill.mutateAsync({});
                  queryClient.invalidateQueries({ queryKey: ["insights"] });
                }}
                disabled={backfill.isPending || syncMeta.isPending}
              >
                <CalendarIcon className={cn("h-4 w-4 mr-2", backfill.isPending && "animate-spin")} />
                {backfill.isPending ? "Backfill em andamento..." : `Backfill ${new Date().getFullYear()} (ano todo)`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O saldo é atualizado automaticamente a cada 2 horas. O backfill puxa mês a mês desde Janeiro
              e pode levar alguns minutos. Contas com token expirado serão reportadas no fim.
            </p>
          </CardContent>
        </Card>
      </MotionItem>

      {/* Email Alerts */}
      <MotionItem>
        <Card>
          <CardHeader>
            <CardTitle>Notificações por Email</CardTitle>
            <CardDescription>Receba alertas críticos no seu email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">Alertas por email</span>
              <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
            </div>
          </CardContent>
        </Card>
      </MotionItem>

      {/* RD Station CRM Integration */}
      <MotionItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Integração RD Station CRM</CardTitle>
            <CardDescription>Receba vendas automaticamente via webhook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {integration?.is_active ? (
              <div className="space-y-3">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
                  Conexão RD ativa. Configure este webhook no RD Station para receber atualizações automáticas.
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">URL do Webhook</p>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="text-xs font-mono" />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Como configurar:</strong></p>
                  <p>1. Acesse RD Station CRM → Configurações → Webhooks</p>
                  <p>2. Crie um webhook com a URL acima</p>
                  <p>3. Selecione os eventos: <code className="bg-muted px-1 rounded">deal_created</code>, <code className="bg-muted px-1 rounded">deal_updated</code></p>
                  <p>4. As vendas serão importadas automaticamente!</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-800">Conecte primeiro o token da API do RD Station no card abaixo.</p>
                <Button variant="outline" onClick={() => document.getElementById("rd-integration")?.scrollIntoView({ behavior: "smooth" })}>
                  Ir para conexão RD
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </MotionItem>

      {/* RD API token */}
      <MotionItem>
        <div id="rd-integration">
          <RDIntegrationCard />
        </div>
      </MotionItem>

      {/* RD Funnels per Account */}
      <MotionItem>
        <div id="rd-funnels">
          <RDFunnelsSection />
        </div>
      </MotionItem>

      {/* RD custom fields per account */}
      <MotionItem>
        <RDCustomFieldsCard />
      </MotionItem>

      {/* RD Health diagnostic */}
      <MotionItem>
        <RDHealthCheckCard />
      </MotionItem>

      {/* RD Reconcile — vendas órfãs (Fase 2) */}
      <MotionItem>
        <RDReconcileCard />
      </MotionItem>

      {/* RD UTM Diagnostics (Fase 1) */}
      <MotionItem>
        <RDUTMDiagnosticsCard />
      </MotionItem>

      {/* RD Observability — Health Check expandido (Fase 3) */}
      <MotionItem>
        <RDObservabilityCard />
      </MotionItem>

      {/* UTM convention */}
      <MotionItem>
        <UTMConventionCard />
      </MotionItem>

      {/* UTM mapping por conta (atribuição de vendas) */}
      <MotionItem>
        <UTMMappingCard />
      </MotionItem>

      {/* Platform inference rules */}
      <MotionItem>
        <PlatformRulesSection />
      </MotionItem>

      {/* Custom metrics from Meta events */}
      <MotionItem>
        <CustomMetricsSection />
      </MotionItem>

      {/* Guide */}
      <MotionItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> Como conectar a Meta Ads</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Clique em <strong>Continuar com Facebook/Meta</strong>.</p>
            <p>2. Entre no perfil que tem acesso às contas de anúncio desejadas.</p>
            <p>3. Autorize as permissões solicitadas pela Growdash.</p>
            <p>4. Todas as contas liberadas serão importadas automaticamente, sem copiar tokens manualmente.</p>
            <p className="pt-2 text-xs">Se a janela não abrir, libere pop-ups para este endereço. Para reconectar um token expirado, use o botão Reconectar da própria conta.</p>
          </CardContent>
        </Card>
      </MotionItem>

      {/* RD Station CRM Guide */}
      <MotionItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> Como conectar o RD Station CRM</CardTitle>
            <CardDescription>
              O RD CRM usa OAuth2 via Portal de Desenvolvedores. Tokens de "Dados de integração (API)" do RD Marketing <strong>não funcionam</strong> aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Acesse <strong>app.rdstation.com.br/app-publisher</strong> e clique em "Quero criar um aplicativo".</p>
            <p>2. Escolha o produto <strong>RD Station CRM</strong> e selecione visibilidade <em>Privado</em> (uso interno).</p>
            <p>3. Em <strong>Redirect URI</strong>, cole a URL de callback exibida no card "Conexão com RD Station CRM" acima.</p>
            <p>4. Salve e copie o <code className="bg-muted px-1 rounded">client_id</code> e <code className="bg-muted px-1 rounded">client_secret</code> gerados.</p>
            <p>5. Cole as credenciais no card acima e clique em <strong>Conectar RD Station CRM</strong> — você será redirecionado para autorizar a conta.</p>
            <p className="pt-2 text-xs">Após autorizar, o token é renovado automaticamente. Reconecte se ficar 14 dias sem uso.</p>
          </CardContent>
        </Card>
      </MotionItem>
    </MotionPage>
  );
}
