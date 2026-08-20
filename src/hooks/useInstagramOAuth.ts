import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export function useInstagramOAuth() {
  const popupRef = useRef<Window | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("about:blank", "growdash-instagram-oauth", "popup,width=620,height=760");
      if (!popup) throw new Error("Libere pop-ups para a Growdash e tente novamente.");
      popupRef.current = popup;
      popup.document.title = "Conectando Instagram";
      popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Preparando conexão segura com o Instagram…</p>';
      const { data, error } = await supabase.functions.invoke("instagram-oauth-start", { body: {} });
      if (error || !data?.authUrl) {
        popup.close();
        popupRef.current = null;
        if (data?.error) throw new Error(`${data.error}${data.action ? ` ${data.action}` : ""}`);
        throw new Error(await getEdgeFunctionErrorMessage(error, "Não foi possível iniciar o login do Instagram."));
      }
      popup.location.replace(data.authUrl);
    },
    onError: (error: Error) => toast({ title: "Não foi possível conectar", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    const expectedOrigin = new URL(SUPABASE_URL).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== popupRef.current) return;
      if (event.data?.type !== "growdash-instagram-oauth") return;
      popupRef.current = null;
      if (event.data.status === "success") {
        toast({ title: "Instagram profissional conectado", description: event.data.message });
        queryClient.invalidateQueries({ queryKey: ["social_accounts"] });
        queryClient.invalidateQueries({ queryKey: ["social_media"] });
        queryClient.invalidateQueries({ queryKey: ["social_insights_daily"] });
        // OAuth imports the profile first. Start the initial media sync as soon
        // as the callback identifies the account, so a newly connected profile
        // does not look empty until the person discovers the manual refresh.
        const socialAccountId = typeof event.data.socialAccountId === "string" ? event.data.socialAccountId : "";
        if (socialAccountId) {
          void supabase.functions.invoke("social-sync-instagram", { body: { social_account_id: socialAccountId } })
            .then(({ data, error }) => {
              if (error || data?.error) throw error ?? new Error(data.error);
              toast({ title: "Publicações importadas", description: data?.message ?? "Os conteúdos do Instagram foram atualizados." });
            })
            .catch(() => {
              // The connection itself remains valid. The Social page exposes a
              // retry button and a precise error if the Meta API is unavailable.
              toast({ title: "Perfil conectado", description: "Não foi possível importar as publicações agora. Use “Atualizar dados” para tentar novamente.", variant: "destructive" });
            })
            .finally(() => {
              queryClient.invalidateQueries({ queryKey: ["social_accounts"] });
              queryClient.invalidateQueries({ queryKey: ["social_media"] });
              queryClient.invalidateQueries({ queryKey: ["social_insights_daily"] });
            });
        }
      } else {
        toast({ title: "Conexão não concluída", description: event.data.message, variant: "destructive" });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [queryClient, toast]);

  return connect;
}
