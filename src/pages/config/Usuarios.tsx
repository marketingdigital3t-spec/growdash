import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MODULES, type PermLevel } from "@/lib/permissions";

type Member = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  perms: Record<string, PermLevel>;
};

export default function Usuarios() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false });
    const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role");
    const { data: permsRows } = await supabase.from("user_permissions").select("user_id, module, level");
    const rolesByUser: Record<string, string> = {};
    rolesRows?.forEach((r) => (rolesByUser[r.user_id] = r.role));
    const permsByUser: Record<string, Record<string, PermLevel>> = {};
    permsRows?.forEach((p) => {
      permsByUser[p.user_id] ??= {};
      permsByUser[p.user_id][p.module] = p.level as PermLevel;
    });
    const out: Member[] = (profs ?? [])
      .filter((p) => (rolesByUser[p.id] ?? "patient") !== "patient")
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: rolesByUser[p.id] ?? "professional",
        created_at: p.created_at,
        perms: permsByUser[p.id] ?? {},
      }));
    setMembers(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-black">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Apenas administradoras podem gerenciar usuárias da equipe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Usuárias da equipe</h1>
            <p className="text-sm text-muted-foreground">
              Adicione colaboradoras e defina o que cada uma pode ver ou editar.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Adicionar usuária
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Papel</th>
                <th className="px-4 py-3 text-left">Módulos com acesso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma usuária cadastrada ainda.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary font-bold">
                          {(m.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold">{m.full_name ?? "Sem nome"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {Object.keys(m.perms).length === 0
                        ? "—"
                        : Object.entries(m.perms)
                            .map(([mod, lvl]) => `${MODULES.find((x) => x.id === mod)?.label ?? mod} (${lvl})`)
                            .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(m)}
                        className="rounded-lg p-2 text-primary hover:bg-primary-soft"
                        title="Editar permissões"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} onCreated={load} />}
      {editing && (
        <EditPermsDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function AddUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"professional" | "admin">("professional");
  const [perms, setPerms] = useState<Record<string, PermLevel | "none">>(
    Object.fromEntries(MODULES.map((m) => [m.id, "none"])),
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    const permissions = Object.entries(perms)
      .filter(([, v]) => v !== "none")
      .map(([module, level]) => ({ module, level: level as PermLevel }));
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { full_name: name, email, password: pw, role, permissions },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setLoading(false);
    if (error || data?.error) return setErr((data?.error as string) ?? error!.message);
    onCreated();
    onClose();
  };

  return (
    <Overlay onClose={onClose} title="Adicionar usuária" icon={<UserRound className="h-5 w-5" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome completo">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
          />
        </Field>
        <Field label="Papel">
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as "professional" | "admin")}
          >
            <option value="professional">Profissional / colaboradora</option>
            <option value="admin">Administradora (acesso total)</option>
          </select>
        </Field>
        <Field label="E-mail de acesso">
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuaria@clinica.com"
          />
        </Field>
        <Field label="Senha (mín. 8)">
          <input
            type="text"
            className="input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Senha inicial"
          />
        </Field>
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-sm font-bold">Permissões por módulo</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          {role === "admin"
            ? "Administradoras têm acesso total automaticamente."
            : "Escolha o que essa pessoa pode fazer em cada módulo."}
        </p>
        {role !== "admin" && <PermMatrix value={perms} onChange={setPerms} />}
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
          {loading ? "Criando..." : "Criar usuária"}
        </button>
      </div>
    </Overlay>
  );
}

function EditPermsDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Record<string, PermLevel | "none">>(() =>
    Object.fromEntries(MODULES.map((m) => [m.id, member.perms[m.id] ?? "none"])),
  );
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    // Apaga tudo e reinsere (mais simples e consistente)
    await supabase.from("user_permissions").delete().eq("user_id", member.id);
    const rows = Object.entries(perms)
      .filter(([, v]) => v !== "none")
      .map(([module, level]) => ({ user_id: member.id, module, level: level as PermLevel }));
    if (rows.length) await supabase.from("user_permissions").insert(rows);
    setLoading(false);
    onSaved();
  };

  const removeUser = async () => {
    if (!confirm(`Remover ${member.full_name} da equipe? Isso apaga suas permissões (o login continua existindo).`)) return;
    await supabase.from("user_permissions").delete().eq("user_id", member.id);
    await supabase.from("user_roles").delete().eq("user_id", member.id).neq("role", "patient");
    onSaved();
  };

  return (
    <Overlay onClose={onClose} title={`Permissões — ${member.full_name}`} icon={<ShieldCheck className="h-5 w-5" />}>
      {member.role === "admin" ? (
        <p className="rounded-lg bg-primary-soft px-3 py-3 text-sm text-primary">
          Esta usuária é administradora e tem acesso total à plataforma.
        </p>
      ) : (
        <PermMatrix value={perms} onChange={setPerms} />
      )}
      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          onClick={removeUser}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> Remover da equipe
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-muted">
            Cancelar
          </button>
          {member.role !== "admin" && (
            <button
              onClick={save}
              disabled={loading}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar permissões"}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function PermMatrix({
  value,
  onChange,
}: {
  value: Record<string, PermLevel | "none">;
  onChange: (v: Record<string, PermLevel | "none">) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Módulo</th>
            <th className="px-3 py-2 text-center">Sem acesso</th>
            <th className="px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Ver
              </div>
            </th>
            <th className="px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-3 py-2 font-semibold">{m.label}</td>
              {(["none", "view", "edit"] as const).map((lvl) => (
                <td key={lvl} className="px-3 py-2 text-center">
                  <input
                    type="radio"
                    name={`p-${m.id}`}
                    checked={value[m.id] === lvl}
                    onChange={() => onChange({ ...value, [m.id]: lvl })}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overlay({
  children,
  title,
  icon,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                {icon}
              </div>
            )}
            <h3 className="text-lg font-black">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:.75rem;padding:.6rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
