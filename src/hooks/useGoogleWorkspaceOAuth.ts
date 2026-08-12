import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

/** Starts the official Google consent flow; passwords never pass through Growdash. */
export function useGoogleWorkspaceOAuth() {
  const popupRef = useRef<Window | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("about:blank", "growdash-google-workspace-oauth", "popup,width=620,height=760");
      if (!popup) throw new Error("Libere pop-ups para a Growdash e tente novamente.");
      popupRef.current = popup;
      popup.document.title = "Conectando Google";
      popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Preparando conexão segura com o Google…</p>';
      const { data, error } = await supabase.functions.invoke("google-workspace-oauth-start", { body: {} });
      if (error || !data?.authUrl) {
        popup.close();
        popupRef.current = null;
        if (data?.error) throw new Error(`${data.error}${data.action ? ` ${data.action}` : ""}`);
        throw new Error(await getEdgeFunctionErrorMessage(error, "Não foi possível iniciar a conexão com o Google."));
      }
      popup.location.replace(data.authUrl);
    },
    onError: (error: Error) => toast({ title: "Não foi possível conectar", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    const origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== popupRef.current || event.data?.type !== "growdash-google-workspace-oauth") return;
      popupRef.current = null;
      if (event.data.status === "success") {
        toast({ title: "Google Workspace conectado", description: event.data.message });
        queryClient.invalidateQueries({ queryKey: ["google_workspace_integration"] });
      } else toast({ title: "Conexão não concluída", description: event.data.message, variant: "destructive" });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [queryClient, toast]);
  return connect;
}
