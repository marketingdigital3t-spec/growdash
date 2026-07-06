import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    // Cadastro público é sempre paciente. Profissionais e admins só via convite.
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pw,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name, role: "patient" },
      },
    });
    setLoading(false);
    if (error) return setErr(error.message);
    nav("/chat-seguro", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft to-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(340_85%_60%)] text-white shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">Criar conta de paciente</h1>
            <p className="text-xs text-muted-foreground">Cadastro exclusivo para pacientes assinantes.</p>
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary-soft/50 p-3 text-xs font-semibold text-foreground/80">
          Profissionais e equipe da clínica não se cadastram por aqui — o acesso é criado pela administradora
          no menu <span className="font-bold">Configurações → Usuários</span>.
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
            <User className="h-4 w-4 text-muted-foreground" />
            <input
              required
              maxLength={120}
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Senha (mín. 8, sem senhas vazadas)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
          <button
            disabled={loading}
            className="mt-2 h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-bold text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
