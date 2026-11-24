import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { setAuthPersistence, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import authCosmicScene from "@/assets/auth-cosmic-scene.webp";
import rocketFeathered from "@/assets/rocket-logo-feathered.webp";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Se o usuário já está autenticado, redireciona para o dashboard.
  // `Navigate` declarativo evita navegar durante o render, que o React
  // proíbe e que pode entrar em loop de renderização.
  if (user && (status === "authenticated" || status === "degraded")) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const emailValue = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAuthPersistence(true);
    let error: { status?: number; message?: string } | null = null;
    try {
      ({ error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password,
      }));
    } catch (requestError) {
      error = {
        status: 0,
        message: requestError instanceof Error ? requestError.message : "Falha de rede no serviço de autenticação.",
      };
    }
    setLoading(false);
    if (error) {
      toast({ title: "Acesso não reconhecido", description: error.message, variant: "destructive" });
      return;
    }
    setLaunched(true);
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 2200);
  }

  async function recover() {
    const recoveryEmail = (forgotEmail || email).trim();
    if (!recoveryEmail.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Production uses BrowserRouter, so a hash redirect lands on /auth and
    // prevents the password recovery screen from receiving the Supabase token.
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Recuperação não enviada", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Link de recuperação enviado" });
    setForgotOpen(false);
  }

  async function sendAccessLink() {
    const accessEmail = (forgotEmail || email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accessEmail)) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setAuthPersistence(true);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: accessEmail,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Link de acesso não enviado", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Link de acesso enviado", description: "Verifique a caixa de entrada e o spam para entrar sem a senha." });
  }

  if (launched) {
    return (
      <main
        className="auth-cosmic-viewport auth-cosmic-viewport--launching"
        style={{ backgroundImage: `url(${authCosmicScene})` }}
      >
        <div className="auth-cosmic-container">
          <section className="auth-cosmic-left-panel">
            <div className="auth-rocket-assembly auth-rocket-assembly--launch">
              <img
                src={rocketFeathered}
                alt="Growdash Rocket Mission"
                className="auth-rocket-hero-img"
              />
              <div className="auth-rocket-hero-glow auth-rocket-hero-glow--launch" />
              <div className="auth-rocket-exhaust">
                <div className="auth-exhaust-plume auth-exhaust-plume--launch" />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className="auth-cosmic-viewport"
      style={{ backgroundImage: `url(${authCosmicScene})` }}
    >
      <div className="auth-cosmic-container">
        <section className="auth-cosmic-left-panel">
          <div className="auth-rocket-assembly">
            <img
              src={rocketFeathered}
              alt="Growdash Rocket Mission"
              className="auth-rocket-hero-img auth-rocket-hero-img--float"
            />
            <div className="auth-rocket-hero-glow" />
            <div className="auth-rocket-exhaust">
              <div className="auth-exhaust-plume" />
            </div>
          </div>
          <div className="auth-smoke-field">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="auth-smoke auth-smoke--float"
                style={{ animationDelay: `${i * 1.2}s`, left: `${20 + i * 18}%` }}
              />
            ))}
          </div>
        </section>

        <section className="auth-cosmic-right-panel">
          <div className={cn("auth-card-docked")}>
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Seja Bem-Vindo(a)</h1>
              <p className="text-xs text-slate-400 mt-1.5">Acesse sua operação Growdash.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="auth-input-group">
                <label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border px-5 [&_svg]:h-5 [&_svg]:w-5">
                  <span className="shrink-0"><Mail className="h-4 w-4 text-sky-400" /></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    aria-label="E-mail"
                    autoComplete="email"
                    required
                    className="min-w-0 flex-1 bg-transparent text-lg outline-none text-white placeholder-slate-500"
                  />
                </label>
              </div>
              <div className="auth-input-group">
                <label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border px-5 [&_svg]:h-5 [&_svg]:w-5">
                  <span className="shrink-0"><LockKeyhole className="h-4 w-4 text-sky-400" /></span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-label="Senha"
                    autoComplete="current-password"
                    required
                    className="min-w-0 flex-1 bg-transparent text-lg outline-none text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-white"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Acesso mantido neste dispositivo</span>
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen((v) => !v);
                    setForgotEmail(email.includes("@") ? email : "");
                  }}
                  className="font-semibold text-sky-400 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              {forgotOpen && (
                <div className="rounded-xl border border-sky-400/30 bg-sky-950/30 p-3 text-xs text-slate-300 space-y-2">
                  <p>Recupere a senha ou receba um link de acesso por e-mail:</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu@email.com"
                      aria-label="E-mail para recuperação"
                      className="flex-1 bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={recover}
                      disabled={loading}
                      className="bg-primary text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-primary/90"
                    >
                      Enviar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={sendAccessLink}
                    disabled={loading}
                    className="text-sky-400 hover:underline text-[11px] block text-center w-full pt-1"
                  >
                    Enviar link de acesso sem senha
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-button w-full mt-6"
              >
                {loading ? "Acessando…" : "Entrar na Plataforma"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}