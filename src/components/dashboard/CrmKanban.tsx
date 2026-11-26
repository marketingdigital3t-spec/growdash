import { useState } from "react";
import { Flame, LayoutGrid, Snowflake, Sun, Table2, UserRound } from "lucide-react";
import { formatCurrency } from "@/lib/format/formatPtBr";

export type LeadStage = "new" | "qualified" | "negotiating" | "proposal" | "won" | "lost";

export interface KanbanLead {
  id: string;
  name: string;
  platform: "meta" | "Claude Opus 5" | "organic";
  potentialValue: number;
  daysInStage: number;
  stage: LeadStage;
  assignedTo: string;
  temperature: "hot" | "warm" | "cold";
}

interface CrmKanbanProps {
  leads: KanbanLead[];
  onSelectLead?: (lead: KanbanLead) => void;
  className?: string;
}

const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "Novo Lead" },
  { key: "qualified", label: "Qualificado" },
  { key: "negotiating", label: "Em Negociação" },
  { key: "proposal", label: "Proposta Enviada" },
  { key: "won", label: "Ganho" },
  { key: "lost", label: "Perdido" },
];

const TEMPERATURE_CONFIG = {
  hot: { label: "Quente", icon: Flame, className: "text-danger border-danger/30 bg-danger/10" },
  warm: { label: "Morno", icon: Sun, className: "text-warning border-warning/30 bg-warning/10" },
  cold: { label: "Frio", icon: Snowflake, className: "text-info border-info/30 bg-info/10" },
};

/**
 * Kanban da Tripulacao (seção 9.7 — aba CRM).
 *
 * Colunas do pipeline com contagem e soma em R$, card do lead com origem,
 * valor potencial, tempo na etapa e temperatura por cor semantica.
 */
export function CrmKanban({ leads, onSelectLead, className = "" }: CrmKanbanProps) {
  const [view, setView] = useState<"kanban" | "table">("kanban");

  return (
    <section
      aria-label="Pipeline do CRM"
      className={`rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 pb-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
          Pipeline de Vendas
        </h2>

        {/* Alternancia entre visao Kanban e Tabela */}
        <div className="flex items-center gap-1 rounded-lg border border-card-border bg-bg-elevated/60 p-1">
          <button
            type="button"
            onClick={() => setView("kanban")}
            aria-pressed={view === "kanban"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              view === "kanban" ? "bg-primary/20 text-primary-neon shadow-glow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              view === "table" ? "bg-primary/20 text-primary-neon shadow-glow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Table2 className="h-3.5 w-3.5" /> Tabela
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="mt-4 grid gap-3 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage.key);
            const stageTotal = stageLeads.reduce((sum, lead) => sum + lead.potentialValue, 0);

            return (
              <div key={stage.key} className="min-w-[220px] rounded-xl border border-card-border/60 bg-bg-elevated/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    {stage.label}
                  </span>
                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-black text-primary-neon tabular-nums">
                    {stageLeads.length}
                  </span>
                </div>
                <span className="mt-0.5 block text-[10px] font-semibold text-text-muted tabular-nums">
                  {formatCurrency(stageTotal)}
                </span>

                <div className="mt-3 space-y-2">
                  {stageLeads.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-card-border/60 p-3 text-center text-[10px] text-text-muted">
                      Nenhum lead nesta etapa.
                    </p>
                  ) : (
                    stageLeads.map((lead) => {
                      const temp = TEMPERATURE_CONFIG[lead.temperature];
                      const TempIcon = temp.icon;

                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => onSelectLead?.(lead)}
                          className="block w-full rounded-lg border border-card-border/70 bg-card-bg/80 p-2.5 text-left transition hover:border-card-border-active hover:shadow-glow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <b className="min-w-0 truncate text-[11px] font-bold text-text-primary">
                              {lead.name}
                            </b>
                            <span
                              title={temp.label}
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${temp.className}`}
                            >
                              <TempIcon className="h-2.5 w-2.5" />
                            </span>
                          </div>
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
                            <UserRound className="h-2.5 w-2.5" />
                            {lead.assignedTo}
                          </span>
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="font-bold text-primary-neon tabular-nums">
                              {formatCurrency(lead.potentialValue)}
                            </span>
                            <span className="text-text-muted tabular-nums">
                              {lead.daysInStage}d
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[11px]">
            <thead className="border-b border-card-border text-text-muted">
              <tr>
                <th className="px-3 py-2 font-bold uppercase tracking-wider">Lead</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider">Etapa</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider">Responsável</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider">Valor</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider">Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/60">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition hover:bg-bg-elevated/50">
                  <td className="px-3 py-2 font-bold text-text-primary">{lead.name}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {STAGES.find((stage) => stage.key === lead.stage)?.label ?? lead.stage}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{lead.assignedTo}</td>
                  <td className="px-3 py-2 text-right font-bold text-primary-neon tabular-nums">
                    {formatCurrency(lead.potentialValue)}
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted tabular-nums">{lead.daysInStage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
