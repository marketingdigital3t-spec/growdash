import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { setAuthPersistence, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import authCosmicScene from "@/assets/auth-cosmic-scene.webp";
import rocketFeathered from "@/assets/rocket-logo-feathered.webp";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launched, setLaunched] = useState(false);

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
