// Os dados reais do escritorio: o que o Supabase registra sobre os agentes.
//
// A aba Agentes mostra a operacao como ela e, nao como uma ficcao. Este hook
// le as cinco tabelas que descrevem o trabalho real:
//
//   agent_office_agents  a arvore (CEO -> diretores) e o estado de cada agente
//   ad_accounts          as contas de anuncio (cada uma e uma sala)
//   agent_office_tasks   o trabalho detectado, por conta
//   agent_office_runs    os ciclos do orquestrador
//   agent_office_events  o que o escritorio anuncia
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { GrowdashOfficeData } from "@/habblaud/bridge/officeSnapshot";

/** Quantas execucoes e eventos entram no painel (o feed nao cresce sem limite). */
const RUNS_LIMIT = 40;
const EVENTS_LIMIT = 120;
const TASKS_LIMIT = 400;

export function useOfficeData(enabled = true) {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id;

  return useQuery<GrowdashOfficeData>({
    queryKey: ["agent-office-data", workspaceId],
    enabled: enabled && !!workspaceId,
    // O escritorio e uma visao de operacao: atualiza a cada 30 s, sem
    // recalcular a cada foco de janela.
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspace indisponível");
      const client = supabase;

      const [agents, accounts, tasks, runs, events] = await Promise.all([
        // As tabelas `agent_office_*` e `ad_accounts` nao estao nos tipos
        // gerados do Supabase; o `as any` e o mesmo padrao usado no resto do
        // projeto para elas (veja `useCustomMetrics`).
        client
          .from("agent_office_agents" as any)
          .select("id,role,name,parent_agent_id,runtime_status,status,last_run_at,is_visible")
          .eq("workspace_id", workspaceId),
        client
          .from("ad_accounts" as any)
          .select("id,name,connection_status,last_sync_success_at,last_sync_error")
          .eq("workspace_id", workspaceId)
          // So as contas ativadas (com a integracao Meta conectada) viram
          // salas: as demais nao tem operacao para mostrar.
          .eq("connection_status", "connected"),
        client
          .from("agent_office_tasks" as any)
          .select("id,agent_id,task_type,status,priority,scope,payload,created_at,updated_at")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(TASKS_LIMIT),
        client
          .from("agent_office_runs" as any)
          .select("id,status,summary,started_at,finished_at")
          .eq("workspace_id", workspaceId)
          .order("started_at", { ascending: false })
          .limit(RUNS_LIMIT),
        client
          .from("agent_office_events" as any)
          .select("id,agent_id,event_type,severity,title,body,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(EVENTS_LIMIT),
      ]);

      const firstError = [agents, accounts, tasks, runs, events].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      return {
        // Os tipos gerados do Supabase estao desatualizados para estas
        // tabelas; o cast passa por `unknown` (o mesmo padrao do resto do
        // projeto) porque o `select` acima ja limita as colunas.
        agents: (agents.data ?? []) as unknown as GrowdashOfficeData["agents"],
        accounts: (accounts.data ?? []) as unknown as GrowdashOfficeData["accounts"],
        tasks: (tasks.data ?? []) as unknown as GrowdashOfficeData["tasks"],
        runs: (runs.data ?? []) as unknown as GrowdashOfficeData["runs"],
        events: (events.data ?? []) as unknown as GrowdashOfficeData["events"],
      };
    },
  });
}
