import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useMetaOAuth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const oauthPopup = useRef<Window | null>(null);

  const connect = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na Growdash antes de conectar a Meta.");

      const popup = window.open("about:blank", "growdash-meta-oauth", "popup,width=620,height=760");
      if (!popup) {
        throw new Error("O navegador bloqueou a janela da Meta. Libere pop-ups para a Growdash e tente novamente.");
      }

      oauthPopup.current = popup;
      popup.document.title = "Conectando à Meta";
      popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Preparando conexão segura com a Meta…</p>';

      const { data, error } = await supabase.functions.invoke("meta-oauth-start", { body: {} });
      if (error || !data?.authUrl) {
        popup.close();
        oauthPopup.current = null;
        const action = data?.action ? ` ${data.action}` : "";
        throw new Error(`${data?.error || error?.message || "Não foi possível iniciar a conexão com a Meta."}${action}`);
      }

      popup.location.replace(data.authUrl);
    },
    onError: (error: Error) => toast({
      title: "Não foi possível conectar",
      description: error.message,
      variant: "destructive",
    }),
  });

  useEffect(() => {
    const expectedOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    const receiveOAuthResult = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== oauthPopup.current) return;
      if (event.data?.type !== "growdash-meta-oauth") return;

      oauthPopup.current = null;
      if (event.data.status === "success") {
        toast({
          title: "Meta Ads conectado!",
          description: event.data.message || "As contas de anúncio foram adicionadas.",
        });
        queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      } else {
        toast({
          title: "Conexão não concluída",
          description: event.data.message || "A Meta não autorizou a conexão.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", receiveOAuthResult);
    return () => window.removeEventListener("message", receiveOAuthResult);
  }, [queryClient, toast]);

  return connect;
}
