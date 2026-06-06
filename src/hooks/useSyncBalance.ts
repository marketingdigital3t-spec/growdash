import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSyncBalance() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-meta-balance");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Saldo atualizado!",
        description: `${data.updated}/${data.total} contas atualizadas`,
      });
    },
    onError: (e) => {
      toast({ title: "Erro ao sincronizar saldo", description: e.message, variant: "destructive" });
    },
  });
}
