import { useEffect, useState } from "react";
import { Plus, Download, Filter, X, UserRound } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PatientRow = {
  id: string;
  nome: string;
  email: string;
  criado: string;
};

export default function Pacientes() {
  const { roles } = useAuth();
  const canAdd = roles.includes("admin") || roles.includes("professional");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: patientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "patient");
    const ids = patientRoles?.map((r) => r.user_id) ?? [];
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .in("id", ids);
    setRows(
      (profs ?? []).map((p) => ({
        id: p.id,
        nome: p.full_name ?? "—",
        email: "",
        criado: new Date(p.created_at as string).toLocaleDateString("pt-BR"),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Pacientes"]}
        title="Pacientes"
        subtitle="Gestão completa de todas as pacientes da clínica."
        actions={
          <>
            <Button variant="secondary">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            {canAdd && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Nova paciente
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(rows.length)} hint="cadastradas" accent="primary" />
        <StatCard label="Ativas" value="0" hint="atendidas nos últimos 90 dias" accent="green" />
        <StatCard label="Novas no mês" value="0" accent="pink" />
        <StatCard label="Aniversariantes" value="0" hint="nesta semana" accent="yellow" />
      </div>
      <Toolbar searchPlaceholder="Buscar por nome, telefone ou e-mail...">
        <Button variant="secondary">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        empty={loading ? "Carregando..." : "Nenhuma paciente cadastrada ainda."}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "criado", label: "Cadastrada em" },
          {
            key: "status",
            label: "Status",
            render: () => <Badge tone="green">Ativa</Badge>,
          },
        ]}
      />

      {open && <AddPatientDialog onClose={() => setOpen(false)} onCreated={load} />}
    </div>
  );
}

function AddPatientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setOk(null);
    if (!name.trim() || !email.trim() || pw.length < 8) {
      setErr("Preencha nome, e-mail e senha (mín. 8 caracteres).");
      return;
    }
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { full_name: name.trim(), email: email.trim(), password: pw, role: "patient" },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setLoading(false);
    if (error || data?.error) {
      setErr((data?.error as string) ?? error?.message ?? "Falha ao criar paciente");
      return;
    }
    setOk(`Paciente criada. Envie por um canal seguro:\nE-mail: ${email}\nSenha inicial: ${pw}`);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black">Nova paciente</h3>
            <p className="text-xs text-muted-foreground">Cria o login de acesso da cliente.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          <input
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            placeholder="E-mail de acesso"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            placeholder="Senha inicial (mín. 8)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>

        {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        {ok && (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            {ok}
          </pre>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-muted">
            Fechar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar paciente"}
          </button>
        </div>
      </div>
    </div>
  );
}
