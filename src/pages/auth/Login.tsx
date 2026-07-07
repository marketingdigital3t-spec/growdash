import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const next = (loc.state as { from?: string } | null)?.from ?? "/chat-seguro";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) return setErr(error.message);
    nav(next, { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft to-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-black">Faça seu login</h1>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              placeholder="seu@email.com"
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
              placeholder="Senha (mín. 8 caracteres)"
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
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Não tem conta?{" "}
          <Link to="/cadastro" className="font-bold text-primary">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
