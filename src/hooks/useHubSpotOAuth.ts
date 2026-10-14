import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export function useHubSpotOAuth() {
  const popupRef = useRef<Window | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const popup = window.open("about:blank", "growdash-hubspot-oauth", "popup,width=620,height=760");
      if (!popup) throw new Error("Libere pop-ups para a Growdash e tente novamente.");
      popupRef.current = popup;
      popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Preparando conexão segura com o HubSpot…</p>';
      const { data, error } = await supabase.functions.invoke("hubspot-oauth-start", { body: {} });
      if (error || !data?.authUrl) { popup.close(); popupRef.current = null; throw new Error(data?.error || await getEdgeFunctionErrorMessage(error, "Não foi possível iniciar a conexão com o HubSpot.")); }
      popup.location.replace(data.authUrl);
    },
    onError: (error: Error) => toast({ title: "HubSpot não conectado", description: error.message, variant: "destructive" }),
  });
  useEffect(() => {
    const origin = new URL(SUPABASE_URL).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== popupRef.current || event.data?.type !== "growdash-hubspot-oauth") return;
      popupRef.current = null;
      if (event.data.status === "success") { toast({ title: "HubSpot conectado", description: event.data.message }); void queryClient.invalidateQueries({ queryKey: ["hubspot_crm_integration"] }); }
      else toast({ title: "Conexão não concluída", description: event.data.message, variant: "destructive" });
    };
    window.addEventListener("message", receive); return () => window.removeEventListener("message", receive);
  }, [queryClient, toast]);
  return mutation;
}
