import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Request = {
  id: string;
  patient_id: string;
  conversation_id: string | null;
  scope: string;
  status: "pending" | "approved" | "rejected" | "done";
  notes: string | null;
  requested_at: string;
  deadline_at: string;
  resolved_at: string | null;
  patient_name?: string;
};

/**
 * Painel administrativo (LGPD Art. 18).
 * Lista pedidos de exclusão de fotos das pacientes e permite aprovar/rejeitar.
 * Aprovação chama a edge function `lgpd-delete-photos` que apaga os arquivos
 * criptografados e as linhas de mensagens do tipo `photo`.
 */
export default function SolicitacoesLgpd() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("data_deletion_requests")
      .select("id, patient_id, conversation_id, scope, status, notes, requested_at, deadline_at, resolved_at")
      .order("requested_at", { ascending: false });
    const list = (data as Request[]) ?? [];
    const patientIds = Array.from(new Set(list.map((r) => r.patient_id)));
    if (patientIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", patientIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Paciente"]));
      list.forEach((r) => (r.patient_name = map.get(r.patient_id) ?? "Paciente"));
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Apenas administradoras podem ver esta página.
      </div>
    );
  }

  const approve = async (r: Request) => {
    if (!confirm(`Aprovar e apagar TODAS as fotos da paciente ${r.patient_name}?\n\nEsta ação é irreversível.`)) return;
    setProcessing(r.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const { error } = await supabase.functions.invoke("lgpd-delete-photos", {
        body: { request_id: r.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      await load();
    } catch (e) {
      alert("Falha ao processar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (r: Request) => {
    const notes = prompt("Motivo da rejeição (será registrado):", "");
    if (notes === null) return;
    setProcessing(r.id);
    try {
      const { error } = await supabase
        .from("data_deletion_requests")
        .update({
          status: "rejected",
          notes,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert("Falha ao rejeitar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Solicitações LGPD</h1>
            <p className="text-xs text-muted-foreground">
              Pedidos de exclusão de fotos feitos pelas pacientes. Prazo legal: 7 dias corridos (Art. 18).
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum pedido no momento.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const overdue = r.status === "pending" && new Date(r.deadline_at) < new Date();
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{r.patient_name}</p>
                        <StatusBadge status={r.status} overdue={overdue} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Escopo: <b>{r.scope === "photos" ? "todas as fotos" : "todos os dados"}</b> · Solicitado em{" "}
                        {new Date(r.requested_at).toLocaleString("pt-BR")} · Prazo{" "}
                        {new Date(r.deadline_at).toLocaleDateString("pt-BR")}
                      </p>
                      {r.notes && (
                        <p className="mt-1 rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground/80">{r.notes}</p>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          disabled={processing === r.id}
                          onClick={() => approve(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar e apagar
                        </button>
                        <button
                          disabled={processing === r.id}
                          onClick={() => reject(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, overdue }: { status: Request["status"]; overdue: boolean }) {
  const label =
    status === "pending"
      ? overdue
        ? "Atrasado"
        : "Aberto"
      : status === "approved"
        ? "Aprovado"
        : status === "rejected"
          ? "Rejeitado"
          : "Concluído";
  const cls =
    overdue
      ? "bg-destructive/15 text-destructive"
      : status === "done"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : status === "rejected"
          ? "bg-muted text-muted-foreground"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{label}</span>;
}
