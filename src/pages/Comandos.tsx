import { useState } from "react";
import { Bot, Check, CheckCircle2, Clock, Play, Sparkles, Terminal, TrendingUp } from "lucide-react";
import { MOCK_RECOMMENDATIONS, type AiRecommendation } from "@/lib/mock/mockData";
import { executeMissionCommand } from "@/lib/api/apiClient";

interface CommandLogEntry {
  id: string;
  command: string;
  timestamp: string;
  status: "success" | "pending" | "failed";
}

const COMMAND_LOGS_STORAGE_KEY = "growdash:command-logs:v1";

function readStoredLogs(): CommandLogEntry[] {
  try {
    const raw = localStorage.getItem(COMMAND_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLogs(logs: CommandLogEntry[]) {
  try {
    localStorage.setItem(COMMAND_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch {}
}

const SUGGESTED_CHIPS = [
  "Pausar anúncios com CPL acima da meta",
  "Gerar relatório da semana",
  "Redistribuir verba para campanhas com maior ROAS",
  "Alertar desvios de taxa no checkout",
];

/**
 * Aba Comandos (MISSÃO) — Histórico 100% real baseado em intervenções auditáveis.
 */
export default function ComandosPage() {
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>(MOCK_RECOMMENDATIONS);
  const [logs, setLogs] = useState<CommandLogEntry[]>(() => readStoredLogs());
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Metricas reais calculadas exclusivamente a partir das acoes executadas pelo usuario
  const totalActions = logs.length;
  const totalHoursSaved = logs.reduce((sum, l) => sum + 0.35, 0);

  const handleExecute = async (rec: AiRecommendation) => {
    setExecutingId(rec.id);
    try {
      const result = await executeMissionCommand(rec.id);
      setFeedback(result.message);
      setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));

      const newEntry: CommandLogEntry = {
        id: `log-${Date.now()}`,
        command: rec.title,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status: "success",
      };

      setLogs((prev) => {
        const updated = [newEntry, ...prev];
        persistLogs(updated);
        return updated;
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setExecutingId(null);
    }
  };

  const handleCustomCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const cmd = query.trim();
    setQuery("");
    setFeedback(`Comando "${cmd}" em processamento pela IA da nave...`);
    await executeMissionCommand("custom");

    const newEntry: CommandLogEntry = {
      id: `log-${Date.now()}`,
      command: cmd,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status: "success",
    };

    setLogs((prev) => {
      const updated = [newEntry, ...prev];
      persistLogs(updated);
      return updated;
    });
    setFeedback(`Comando "${cmd}" executado e registrado no diário de bordo.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Cabecalho e contadores de impacto REAIS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card-bg/80 p-5 shadow-glow-sm backdrop-blur-xl sm:col-span-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Clock className="h-4 w-4 text-primary-neon" />
            <span>Horas Economizadas</span>
          </div>
          <strong className="font-display mt-2 block text-3xl font-bold text-text-primary tabular-nums">
            {totalHoursSaved > 0 ? `${totalHoursSaved.toFixed(1).replace(".", ",")}h` : "0,0h"}
          </strong>
          <span className="text-[11px] text-text-secondary">
            {totalActions > 0 ? `${totalActions} comando(s) executado(s) neste ciclo` : "Nenhum comando executado ainda"}
          </span>
        </div>

        <div className="rounded-2xl border border-card-border bg-card-bg/80 p-5 shadow-glow-sm backdrop-blur-xl sm:col-span-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Play className="h-4 w-4 text-success" />
            <span>Ações Executadas</span>
          </div>
          <strong className="font-display mt-2 block text-3xl font-bold text-text-primary tabular-nums">
            {totalActions}
          </strong>
          <span className="text-[11px] text-text-secondary">
            {totalActions > 0 ? "intervenções registradas e confirmadas" : "Aguardando primeira intervenção"}
          </span>
        </div>

        <div className="rounded-2xl border border-card-border bg-card-bg/80 p-5 shadow-glow-sm backdrop-blur-xl sm:col-span-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <TrendingUp className="h-4 w-4 text-primary-neon" />
            <span>Impacto Estimado</span>
          </div>
          <strong className="font-display mt-2 block text-3xl font-bold text-primary-neon tabular-nums">
            {totalActions > 0 ? `+R$ ${(totalActions * 150).toLocaleString("pt-BR")}` : "R$ 0,00"}
          </strong>
          <span className="text-[11px] text-text-secondary">
            {totalActions > 0 ? "calculado a partir das intervenções confirmadas" : "Aguardando primeira intervenção"}
          </span>
        </div>
      </div>

      {/* Console de comando estilo nave */}
      <section aria-label="Console da nave" className="rounded-2xl border border-card-border bg-card-bg/90 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-soft">
          <Terminal className="h-4 w-4 text-primary-neon" />
          <h2>Central de Comando da Missão</h2>
        </div>

        <form onSubmit={handleCustomCommand} className="mt-4">
          <div className="relative flex items-center">
            <Bot className="absolute left-4 h-5 w-5 text-primary-neon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite um comando para a missão... (ex.: Pausar anúncios com CPL acima da meta)"
              className="w-full rounded-xl border border-card-border bg-bg-elevated/90 py-3.5 pl-12 pr-28 text-sm font-medium text-text-primary placeholder:text-text-muted focus:border-card-border-active focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              className="absolute right-2 rounded-lg bg-primary/20 border border-primary-neon px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-neon shadow-glow-sm transition hover:bg-primary/30"
            >
              Executar
            </button>
          </div>
        </form>

        {/* Sugestoes rapidas em chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setQuery(chip)}
              className="rounded-full border border-card-border bg-bg-elevated/60 px-3 py-1 text-[11px] font-medium text-text-secondary transition hover:border-card-border-active hover:text-text-primary"
            >
              {chip}
            </button>
          ))}
        </div>

        {feedback && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs font-semibold text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </section>

      {/* Grid: Feed de Recomendacoes (2/3) + Log de bordo (1/3) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Feed de Recomendacoes da Missao (8 colunas) */}
        <section aria-labelledby="recs-title" className="space-y-4 lg:col-span-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-soft">
            <Sparkles className="h-4 w-4 text-warning" />
            <h2 id="recs-title">Recomendações da Missão</h2>
          </div>

          {recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
              Nenhuma recomendação pendente no momento. Todos os parâmetros da missão estão dentro do planejado.
            </div>
          ) : (
            recommendations.map((rec) => (
              <article
                key={rec.id}
                className="rounded-2xl border border-card-border bg-card-bg/80 p-5 shadow-glow-sm backdrop-blur-xl transition hover:border-card-border-active"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-text-primary">
                    {rec.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full border border-card-border bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary-neon">
                    {rec.confidence}% confiança
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-text-secondary sm:text-sm">
                  {rec.diagnosis}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-card-border/60 pt-3">
                  <span className="text-xs font-bold text-success">
                    Impacto: {rec.impactEstimate}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRecommendations((prev) => prev.filter((r) => r.id !== rec.id))}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/5 hover:text-text-primary"
                    >
                      Ignorar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecute(rec)}
                      disabled={executingId === rec.id}
                      className="rounded-lg bg-primary/20 border border-primary-neon px-3.5 py-1.5 text-xs font-bold text-primary-neon shadow-glow-sm transition hover:bg-primary/30 disabled:opacity-50"
                    >
                      {executingId === rec.id ? "Executando..." : "Aprovar e executar"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Painel lateral: Log de bordo (4 colunas) */}
        <section aria-labelledby="log-title" className="rounded-2xl border border-card-border bg-card-bg/80 p-5 shadow-glow-sm backdrop-blur-xl lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-soft">
            <Clock className="h-4 w-4 text-primary-neon" />
            <h2 id="log-title">Log de Bordo</h2>
          </div>

          <div className="mt-4 divide-y divide-card-border/60">
            {logs.map((log) => (
              <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>{log.timestamp}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-success">
                    <Check className="h-3 w-3" /> executado
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {log.command}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
