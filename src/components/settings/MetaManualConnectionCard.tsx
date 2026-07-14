import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Facebook, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MetaManualConnectionCard({ onConnected }: { onConnected?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-connect-token", {
        body: { account_id: accountId.trim(), access_token: token.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setAccountId("");
      setToken("");
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      toast({
        title: data?.updated ? "Conta Meta atualizada" : "Conta Meta conectada",
        description: `${data?.account?.name || "Conta de anúncio"} foi validada e salva com segurança.`,
      });
      onConnected?.();
    },
    onError: (error: Error) => toast({
      title: "Não foi possível conectar",
      description: error.message,
      variant: "destructive",
    }),
  });

  const validAccountId = /^(act_)?\d{5,30}$/i.test(accountId.trim().replace(/\s+/g, ""));
  const validToken = token.trim().length >= 20;

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eaf1ff] text-[#2469da]">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Facebook className="h-4 w-4" /> Conectar por ID e token</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Use o ID da conta de anúncio e um token que possua acesso a ela.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="meta-account-id">ID da conta de anúncio</Label>
          <Input
            id="meta-account-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder="act_123456789 ou 123456789"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-access-token">Token de acesso</Label>
          <Input
            id="meta-access-token"
            type="password"
            autoComplete="new-password"
            placeholder="Cole o token da Meta"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          O token é validado na API da Meta e armazenado somente no servidor. Para uso contínuo, prefira um token de usuário do sistema da BM com permissões <code>ads_read</code>, <code>ads_management</code> e <code>business_management</code>.
        </span>
      </div>

      <Button
        onClick={() => connect.mutate()}
        disabled={!validAccountId || !validToken || connect.isPending}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        {connect.isPending ? "Validando na Meta..." : "Validar e conectar conta"}
      </Button>
    </div>
  );
}
