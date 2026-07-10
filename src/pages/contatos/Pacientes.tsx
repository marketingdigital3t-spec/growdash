import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Download, Filter, X, UserRound, KeyRound, Copy, Check, Sparkles,
  Pencil, Trash2, Loader2, AlertTriangle, MessageSquareLock, ShieldCheck,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrypto } from "@/hooks/useCrypto";

type Patient = {
  id: string;
  full_name: string | null;
  created_at: string;
  initial_password_pending: boolean;
};

type PatientRow = {
  id: string;
  nome: React.ReactNode;
  email: string;
  criado: string;
  status: React.ReactNode;
  acoes: React.ReactNode;
};

function randomPassword(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join("");
}

export default function Pacientes() {
  const { roles, user } = useAuth();
  const { createConversationKey } = useCrypto();
  const navigate = useNavigate();
  const canAdd = roles.includes("admin") || roles.includes("professional");
  const canManage = roles.includes("admin");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [chatMap, setChatMap] = useState<Record<string, string>>({});
  const [chatBusy, setChatBusy] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);

  const load = async () => {
    setLoading(true);
    let ids: string[] = [];

    if (roles.includes("admin")) {
      const { data: patientRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "patient");
      ids = patientRoles?.map((r) => r.user_id) ?? [];
    } else if (user?.id) {
      const { data: links } = await supabase
        .from("patient_links")
        .select("patient_id")
        .eq("professional_id", user.id);
      ids = links?.map((r) => r.patient_id) ?? [];
    }

    if (!ids.length) {
      setPatients([]);
      setChatMap({});
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, created_at, initial_password_pending")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setPatients((profs ?? []) as Patient[]);

    if (user?.id) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, patient_id, professional_id")
        .eq("professional_id", user.id)
        .in("patient_id", ids);
      const map: Record<string, string> = {};
      convs?.forEach((c) => { map[c.patient_id] = c.id; });
      setChatMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, roles.join("|")]);

  const ensureSecureChat = async (patientId: string): Promise<{ id: string } | { error: string }> => {
    if (!user?.id) return { error: "Sessão inválida" };
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("patient_id", patientId)
      .eq("professional_id", user.id)
      .maybeSingle();
    if (existing?.id) return { id: existing.id };
    // Garante o vínculo paciente↔profissional antes de criar a conversa
    // (necessário pra passar na RLS quando o usuário é 'professional').
    await supabase
      .from("patient_links")
      .insert({ patient_id: patientId, professional_id: user.id })
      .then(() => {}, () => {});
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ patient_id: patientId, professional_id: user.id })
      .select("id")
      .single();
    if (error || !conv) return { error: error?.message ?? "Falha ao criar conversa" };
    try {
      await createConversationKey(conv.id, patientId);
    } catch (e) {
      // Chaves da paciente ainda não existem — a conversa fica criada e será
      // finalizada assim que ela fizer o primeiro login e gerar o cofre.
      console.warn("createConversationKey pending:", e);
    }
    return { id: conv.id };
  };

  const handleStartChat = async (p: Patient) => {
    setChatBusy(p.id);
    setChatMsg(null);
    const r = await ensureSecureChat(p.id);
    setChatBusy(null);
    if ("error" in r) {
      setChatMsg({ id: p.id, text: r.error, ok: false });
      return;
    }
    setChatMap((m) => ({ ...m, [p.id]: r.id }));
    navigate("/chat-seguro");
  };

  const rows: PatientRow[] = patients.map((p) => {
    const hasChat = !!chatMap[p.id];
    const busy = chatBusy === p.id;
    return {
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
          <button
            onClick={() => handleStartChat(p)}
            disabled={busy}
            title={hasChat ? "Abrir chat seguro" : "Criar chat seguro para esta paciente"}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition ${
              hasChat
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            } disabled:opacity-60`}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : hasChat ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <MessageSquareLock className="h-3 w-3" />
            )}
            {hasChat ? "Chat E2E" : "Criar chat E2E"}
          </button>
          {chatMsg?.id === p.id && (
            <span className={`text-[10px] font-semibold ${chatMsg.ok ? "text-emerald-600" : "text-destructive"}`}>
              {chatMsg.text}
            </span>
          )}
        </span>
      ),
      email: "",
      criado: new Date(p.created_at).toLocaleDateString("pt-BR"),
      status: <Badge tone="green">Ativa</Badge>,
      acoes: (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditing(p)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
            title="Editar paciente"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <button
              onClick={() => setDeleting(p)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
              title="Excluir paciente"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Pacientes"]}
        title="Pacientes"
        subtitle="Gestão completa de todas as pacientes da clínica."
        actions={
          <>
            <Button variant="secondary"><Download className="h-4 w-4" /> Exportar</Button>
            {canAdd && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Nova paciente
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(patients.length)} hint="cadastradas" accent="primary" />
        <StatCard label="Ativas" value="0" hint="atendidas nos últimos 90 dias" accent="green" />
        <StatCard label="Novas no mês" value="0" accent="pink" />
        <StatCard label="Aniversariantes" value="0" hint="nesta semana" accent="yellow" />
      </div>
      <Toolbar searchPlaceholder="Buscar por nome, telefone ou e-mail...">
        <Button variant="secondary"><Filter className="h-4 w-4" /> Filtros</Button>
      </Toolbar>
      <DataTable
        rows={rows}
        empty={loading ? "Carregando..." : "Nenhuma paciente cadastrada ainda."}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "criado", label: "Cadastrada em" },
          { key: "status", label: "Status" },
          { key: "acoes", label: "Ações", className: "text-right" },
        ]}
      />

      {open && <AddPatientDialog onClose={() => setOpen(false)} onCreated={load} ensureSecureChat={ensureSecureChat} />}
      {editing && (
        <EditPatientDialog
          patient={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {deleting && (
        <DeletePatientDialog
          patient={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
        />
      )}
    </div>
  );
}

function EditPatientDialog({
  patient, onClose, onSaved,
}: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(patient.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!name.trim()) { setErr("Informe o nome."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles").update({ full_name: name.trim() }).eq("id", patient.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <ModalShell title="Editar paciente" subtitle="Atualize os dados cadastrais." onClose={onClose} icon={<Pencil className="h-5 w-5" />}>
      <div className="grid gap-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nome completo</label>
        <input
          className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-muted">Cancelar</button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </ModalShell>
  );
}

function DeletePatientDialog({
  patient, onClose, onDeleted,
}: { patient: Patient; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    setErr(null);
    setBusy(true);
    const { data, error } = await callAdminFunction("admin-delete-user", { user_id: patient.id });
    setBusy(false);
    if (error || data?.error) {
      setErr((data?.error as string) ?? error ?? "Falha ao excluir paciente");
      return;
    }
    onDeleted();
  };

  return (
    <ModalShell
      title="Excluir paciente"
      subtitle="Esta ação não pode ser desfeita."
      onClose={onClose}
      icon={<Trash2 className="h-5 w-5" />}
      tone="destructive"
    >
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div className="mb-1 flex items-center gap-2 font-extrabold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Tem certeza?
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          Vamos remover permanentemente <b>{patient.full_name ?? "esta paciente"}</b>, seu login, mensagens e
          conversas associadas.
        </p>
      </div>
      {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-muted">Cancelar</button>
        <button
          onClick={confirm}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground shadow disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Excluindo..." : "Excluir definitivamente"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title, subtitle, onClose, icon, tone = "primary", children,
}: {
  title: string; subtitle?: string; onClose: () => void;
  icon: React.ReactNode; tone?: "primary" | "destructive"; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl shadow ${
            tone === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
          }`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddPatientDialog({ onClose, onCreated, ensureSecureChat }: { onClose: () => void; onCreated: () => void; ensureSecureChat: (patientId: string) => Promise<{ id: string } | { error: string }> }) {
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
    } catch { /* ignore */ }
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
    if (error || data?.error) {
      setLoading(false);
      setErr((data?.error as string) ?? (await functionErrorMessage(error, "Falha ao criar paciente")));
      return;
    }
    const newUserId = (data as { user_id?: string } | null)?.user_id;
    if (newUserId) {
      const r = await ensureSecureChat(newUserId);
      if ("error" in r) {
        console.warn("auto secure chat:", r.error);
      }
    }
    setLoading(false);
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

async function functionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") return payload.error;
      if (typeof payload?.message === "string") return payload.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // ignore
      }
    }
  }
  return (error as { message?: string } | null)?.message ?? fallback;
}

async function callAdminFunction(name: string, body: unknown) {
  const token = getStoredAccessToken();
  if (!token) return { data: null, error: "Sessão expirada. Entre novamente para continuar." };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data, error: data?.error ?? `Erro ${res.status}` };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Falha na conexão" };
  }
}

function getStoredAccessToken() {
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      const token = value?.access_token ?? value?.currentSession?.access_token ?? value?.session?.access_token;
      if (typeof token === "string" && token.length > 20) return token;
    } catch {
      // ignore unrelated storage entries
    }
  }
  return null;
}

function CredRow({
  label, value, onCopy, copied, mono,
}: { label: string; value: string; onCopy: () => void; copied: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}>
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
