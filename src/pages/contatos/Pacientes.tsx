import { useEffect, useState } from "react";
import { Plus, Download, Filter, X, UserRound, KeyRound, Copy, Check, Sparkles } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PatientRow = {
  id: string;
  nome: React.ReactNode;
  email: string;
  criado: string;
};

function randomPassword(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join("");
}

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
      .select("id, full_name, created_at, initial_password_pending")
      .in("id", ids);
    setRows(
      (profs ?? []).map((p) => ({
        id: p.id,
        nome: (
          <span className="inline-flex items-center gap-2">
            {p.initial_password_pending && (
              <span
                title="Cliente ainda não fez o primeiro login — está usando a senha inicial gerada pelo sistema."
                className="inline-grid h-6 w-6 place-items-center rounded-full bg-[hsl(35_90%_92%)] text-[hsl(35_85%_35%)]"
              >
                <KeyRound className="h-3.5 w-3.5" />
              </span>
            )}
            <span>{p.full_name ?? "—"}</span>
          </span>
        ),
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
  const [pw, setPw] = useState(() => randomPassword());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<null | "email" | "pw" | "both">(null);

  const copy = async (text: string, kind: "email" | "pw" | "both") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  };

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || pw.length < 8) {
      setErr("Preencha nome, e-mail e senha (mín. 8 caracteres).");
      return;
    }
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { full_name: name.trim(), email: email.trim().toLowerCase(), password: pw, role: "patient" },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setLoading(false);
    if (error || data?.error) {
      setErr((data?.error as string) ?? error?.message ?? "Falha ao criar paciente");
      return;
    }
    setCreated({ email: email.trim().toLowerCase(), password: pw });
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
            <h3 className="text-lg font-black">
              {created ? "Paciente criada!" : "Nova paciente"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {created
                ? "Copie a senha inicial e entregue à cliente por um canal seguro."
                : "Cria o login de acesso da cliente."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!created ? (
          <>
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
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary"
                  placeholder="Senha inicial (mín. 8)"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setPw(randomPassword())}
                  className="flex h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
                  title="Gerar senha aleatória"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gerar
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A cliente usará esta senha tanto no login quanto para desbloquear o cofre E2E das suas próprias
                conversas. Um ícone de chave 🔑 aparecerá ao lado do nome até o primeiro login dela.
              </p>
            </div>

            {err && (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow disabled:opacity-50"
              >
                {loading ? "Criando..." : "Criar paciente"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-[hsl(35_85%_88%)] bg-[hsl(35_90%_97%)] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[hsl(35_85%_35%)]">
                <KeyRound className="h-4 w-4" /> Credenciais de acesso — mostradas só uma vez
              </div>

              <div className="space-y-3">
                <CredRow
                  label="E-mail"
                  value={created.email}
                  copied={copied === "email"}
                  onCopy={() => copy(created.email, "email")}
                />
                <CredRow
                  label="Senha inicial"
                  value={created.password}
                  copied={copied === "pw"}
                  onCopy={() => copy(created.password, "pw")}
                  mono
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() =>
                  copy(`E-mail: ${created.email}\nSenha: ${created.password}`, "both")
                }
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted"
              >
                {copied === "both" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Copiado!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Copy className="h-4 w-4" /> Copiar tudo
                  </span>
                )}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow"
              >
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-sm ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
          title="Copiar"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
