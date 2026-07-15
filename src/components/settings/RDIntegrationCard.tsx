import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link2, CheckCircle2, AlertCircle, Trash2, Unplug } from "lucide-react";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { useAuth } from "@/contexts/AuthContext";
import { DestructiveConfirmationDialog } from "@/components/DestructiveConfirmationDialog";

export function RDIntegrationCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { user } = useAuth();

  const { data: integration } = useRDIntegration();
  const isConnected = !!integration?.is_active;

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-test-connection", {
        body: { api_token: token.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setToken("");
      toast({
        title: "RD Station CRM conectado!",
        description: data?.warning || "Token validado e salvo com segurança.",
      });
      qc.invalidateQueries({ queryKey: ["integration"] });
      qc.invalidateQueries({ queryKey: ["rd_health_check"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-test-connection", {
        body: { disconnect: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setToken("");
      toast({ title: "RD Station desconectado", description: "O token salvo foi removido da Growdash." });
      qc.invalidateQueries({ queryKey: ["integration"] });
      qc.invalidateQueries({ queryKey: ["rd_health_check"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-integration-account", {
        body: {
          provider: "rd_station_crm",
          account_id: user?.id,
          confirmation: "EXCLUIR RD",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setToken("");
      setDeleteOpen(false);
      toast({ title: "Integração RD excluída", description: data?.message });
      qc.invalidateQueries({ queryKey: ["integration"] });
      qc.invalidateQueries({ queryKey: ["rd_health_check"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao excluir integração", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Conexão com RD Station CRM
        </CardTitle>
        <CardDescription>
          Cole o token da API do RD CRM para listar funis reais e sincronizar vendas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${
            isConnected
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {isConnected ? "RD Station CRM conectado" : "Não conectado"}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como gerar o token:</p>
          <p>1. Entre no <strong>RD Station CRM</strong></p>
          <p>2. Clique no ícone de engrenagem (<strong>Admin</strong>)</p>
          <p>3. Vá em <strong>Integrações → API do CRM</strong></p>
          <p>4. Clique em <strong>Gerar token</strong> e copie o valor</p>
        </div>

        <div className="space-y-1">
          <Label>Token da API do RD CRM</Label>
          <Input
            type="password"
            autoComplete="off"
            placeholder={isConnected ? "Cole um novo token para substituir o atual" : "Cole o token aqui"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {isConnected && (
            <p className="text-xs text-muted-foreground">
              Por segurança, o token salvo nunca é enviado de volta ao navegador.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => save.mutate()} disabled={!token.trim() || save.isPending || disconnect.isPending}>
            {save.isPending ? "Testando..." : isConnected ? "Substituir token" : "Testar e conectar"}
          </Button>
          {isConnected && (
            <>
              <Button
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending || save.isPending || remove.isPending}
              >
                <Unplug className="mr-2 h-4 w-4" />
                {disconnect.isPending ? "Desconectando..." : "Desconectar"}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={disconnect.isPending || save.isPending || remove.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir conexão
              </Button>
            </>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Desconectar revoga o uso do token. Excluir elimina a credencial da Growdash e preserva os negócios já sincronizados para auditoria.
        </p>
      </CardContent>
      <DestructiveConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir integração com RD Station"
        description="A credencial será eliminada da Growdash e novas sincronizações serão interrompidas. Os negócios já importados permanecem disponíveis como histórico."
        confirmation="EXCLUIR RD"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
