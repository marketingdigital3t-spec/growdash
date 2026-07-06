import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Lock, Mail, User, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SetupAdmin() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("marketingdigital3t@gmail.com");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadySet, setAlreadySet] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Verifica se já existe admin — usa a função edge que retorna 403 se sim
      try {
        const { error } = await supabase.functions.invoke("bootstrap-owner", {
          body: { probe: true },
        });
        // 400 (dados inválidos) = pode configurar; 403 = já existe admin
        if (error && /Já existe/.test(error.message ?? "")) setAlreadySet(true);
      } catch {
        // ignora
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 10) return setErr("A senha precisa ter no mínimo 10 caracteres.");
    if (pw !== pw2) return setErr("As senhas não conferem.");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("bootstrap-owner", {
      body: { full_name: name.trim(), email: email.trim().toLowerCase(), password: pw },
    });
    setLoading(false);
    if (error || !data?.ok) {
      const msg =
        (data as { error?: string } | null)?.error ??
        error?.message ??
        "Não foi possível criar o administrador.";
      if (/Já existe/.test(msg)) setAlreadySet(true);
      return setErr(msg);
    }
    // Faz login automaticamente
    const { error: sErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pw,
    });
    if (sErr) return setErr("Conta criada, mas o login falhou: " + sErr.message);
    nav("/", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft to-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(340_85%_60%)] text-primary-foreground shadow-lg">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">Primeiro acesso do dono</h1>
            <p className="text-xs text-muted-foreground">Configuração única — cria o administrador da plataforma.</p>
          </div>
        </div>

        {checking && (
          <p className="rounded-lg bg-muted p-3 text-center text-xs font-semibold text-muted-foreground">
            Verificando...
          </p>
        )}

        {!checking && alreadySet && (
          <div className="rounded-2xl border border-[hsl(0_85%_92%)] bg-[hsl(0_85%_98%)] p-4">
            <p className="text-sm font-bold text-[hsl(0_70%_40%)]">Já existe um administrador nesta plataforma.</p>
            <p className="mt-1 text-xs font-semibold text-[hsl(0_60%_35%)]">
              Por segurança, esta tela só pode ser usada uma vez. Novos acessos devem ser criados pelo menu
              Configurações → Usuários.
            </p>
            <button
              onClick={() => nav("/login")}
              className="mt-3 h-10 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              Ir para o login
            </button>
          </div>
        )}

        {!checking && !alreadySet && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                required
                maxLength={120}
                placeholder="Seu nome completo"
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
                minLength={10}
                placeholder="Senha (mín. 10 caracteres)"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={10}
                placeholder="Confirme a senha"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            <button
              disabled={loading}
              className="mt-2 h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar administrador e entrar"}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Depois disso, esta tela fica travada automaticamente.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
