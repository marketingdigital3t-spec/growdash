import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link2, CheckCircle2, AlertCircle } from "lucide-react";

export function RDIntegrationCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [token, setToken] = useState("");

  const { data: integration } = useQuery({
    queryKey: ["integration", "rd_station_crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, is_active, api_token")
        .eq("provider", "rd_station_crm")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isConnected = !!integration?.is_active && !!integration?.api_token;

  useEffect(() => {
    if (integration?.api_token && !token) setToken(integration.api_token);
  }, [integration?.api_token]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-test-connection", {
        body: { api_token: token.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "RD Station CRM conectado!", description: "Token validado e salvo." });
      qc.invalidateQueries({ queryKey: ["integration", "rd_station_crm"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" }),
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
            placeholder="Cole o token aqui"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <Button onClick={() => save.mutate()} disabled={!token.trim() || save.isPending}>
          {save.isPending ? "Testando..." : isConnected ? "Atualizar token" : "Testar e salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
