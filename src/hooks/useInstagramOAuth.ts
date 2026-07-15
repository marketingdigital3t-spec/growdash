import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
        throw new Error(data?.error || error?.message || "Não foi possível iniciar o login do Instagram.");
      }
      popup.location.replace(data.authUrl);
    },
    onError: (error: Error) => toast({ title: "Não foi possível conectar", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    const expectedOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== popupRef.current) return;
      if (event.data?.type !== "growdash-instagram-oauth") return;
      popupRef.current = null;
      if (event.data.status === "success") {
        toast({ title: "Instagram profissional conectado", description: event.data.message });
        queryClient.invalidateQueries({ queryKey: ["social_accounts"] });
      } else {
        toast({ title: "Conexão não concluída", description: event.data.message, variant: "destructive" });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [queryClient, toast]);

  return connect;
}
