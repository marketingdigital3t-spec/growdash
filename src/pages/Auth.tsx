import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { setAuthPersistence, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import rocketFeathered from "@/assets/rocket-logo-feathered.webp";
import authCosmicScene from "@/assets/auth-cosmic-scene.webp";

function isTransientAuthError(error: { status?: number; message?: string } | null | undefined) {
  return !!error && ([0, 408, 429, 500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530].includes(Number(error.status)) || /HTTP\s*5\d\d|upstream|temporar|tempo de carregamento|timed out|timeout|network|fetch failed/i.test(error.message || ""));
}

function authErrorMessage(error: { status?: number; message?: string } | null | undefined) {
  if (isTransientAuthError(error)) return "O serviço de autenticação está temporariamente indisponível. Tente novamente em alguns instantes; sua conta e senha não foram alteradas.";
  return error?.message || "Não foi possível concluir o acesso.";
}

export default function Auth() {
  const mode = "login" as const;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const email = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Informe um e-mail válido", description: "Use o e-mail completo cadastrado na Growdash.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAuthPersistence(true);
    let error: { status?: number; message?: string } | null = null;
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch (requestError) {
      error = { status: 0, message: requestError instanceof Error ? requestError.message : "Falha de rede no serviço de autenticação." };
    }
    setLoading(false);
    if (error) {
      const invalidCredentials = error.message === "Invalid login credentials";
      if (invalidCredentials) {
        setForgotEmail(email);
        setForgotOpen(true);
      }
      toast({
        title: invalidCredentials ? "Acesso não reconhecido" : "Não foi possível entrar",
        description: invalidCredentials
          ? "A senha foi recusada. Use a recuperação ou envie um link de acesso abaixo; a conta e os dados não foram alterados."
          : authErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    setLaunching(true);
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 1600);
  }

  async function recover() {
    const email = (forgotEmail || identifier).trim();
    if (!email.includes("@")) { toast({ title: "Informe um email válido", variant: "destructive" }); return; }
    setLoading(true);
    // Production uses BrowserRouter, so a hash redirect lands on /auth and
    // prevents the password recovery screen from receiving the Supabase token.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) toast({ title: "Recuperação não enviada", description: authErrorMessage(error), variant: "destructive" });
    else { toast({ title: "Link de recuperação enviado" }); setForgotOpen(false); }
  }

  async function sendAccessLink() {
    const email = (forgotEmail || identifier).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast({ title: "Informe um email válido", variant: "destructive" }); return; }
    setAuthPersistence(true);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) toast({ title: "Link de acesso não enviado", description: authErrorMessage(error), variant: "destructive" });
    else toast({ title: "Link de acesso enviado", description: "Verifique a caixa de entrada e o spam para entrar sem a senha." });
  }

  return (
    <main
      className="auth-cosmic-viewport"
      style={{ backgroundImage: `url(${authCosmicScene})` }}
    >
      <div className="auth-cosmic-container">
        {/* COLUNA ESQUERDA: a arte cósmica com o foguete e a copy da missão já vivem
            no fundo de tela cheia com alta fidelidade. O texto permanece no DOM como
            camada acessível (sr-only no desktop e legível em leitores de tela). */}
        <section className={cn("auth-cosmic-left-panel", launching && "launching")}>
          {/* Abaixo de 980px a arte de tela cheia não cabe: a nave entra com
              alfa suave sobre o céu do espaço e o texto volta a ser visível. */}
          <div className="auth-rocket-hero-frame lg:hidden">
            <img src={rocketFeathered} alt="Growdash Rocket Mission" className="auth-rocket-hero-img" />
            <div className="auth-rocket-hero-glow" />
          </div>

          {/* Texto semântico da missão (acessibilidade para leitor de tela / SEO) */}
          <div className="auth-cosmic-left-content pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-400/40 bg-sky-950/70 text-sky-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 shadow-[0_0_20px_rgba(0,168,255,0.45)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
              Growdash Mission Control
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white tracking-tight leading-[1.12]">
              Da Terra à Galáxia: lance, acelere e escale seu negócio.
            </h2>
            <p className="mt-3.5 text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
              Tráfego, leads, funil e faturamento alimentando o combustível da sua missão. Suba de fase em tempo real.
            </p>
            <p className="mt-4 text-xs font-bold text-sky-400 tracking-wider uppercase">
              Sua jornada começa na Terra, ganha órbita e conquista a Galáxia.
            </p>
          </div>
        </section>

        {/* COLUNA DIREITA: Card de Autenticação Equilibrado no Grid */}
        <section className="auth-cosmic-right-panel">
          <div className={cn("auth-card-docked", launching && "launching")}>
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Seja Bem-Vindo(a)</h1>
              <p className="text-xs text-slate-400 mt-1.5">Acesse sua operação Growdash.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <PremiumInput label="E-mail" icon={<Mail />} type="email" value={identifier} onChange={setIdentifier} placeholder="seu@email.com" autoComplete="email" />
              <PremiumInput label="Senha" icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" trailing={<button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-white" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Acesso mantido neste dispositivo</span>
                  <button type="button" onClick={() => { setForgotOpen((v) => !v); setForgotEmail(identifier.includes("@") ? identifier : ""); }} className="font-semibold text-sky-400 hover:underline">
                    Esqueceu a senha?
                  </button>
              </div>
              {forgotOpen && (
                <div className="rounded-xl border border-sky-400/30 bg-sky-950/30 p-3 text-xs text-slate-300 space-y-2">
                  <p>Recupere a senha ou receba um link de acesso por e-mail:</p>
                  <div className="flex gap-2">
                    <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail para recuperação" className="flex-1 bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-white" />
                    <button type="button" onClick={recover} disabled={loading} className="bg-primary text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-primary/90">Enviar</button>
                  </div>
                  <button type="button" onClick={sendAccessLink} disabled={loading} className="text-sky-400 hover:underline text-[11px] block text-center w-full pt-1">
                    Enviar link de acesso sem senha
                  </button>
                </div>
              )}
              <button type="submit" disabled={loading || launching} className="auth-submit-button w-full mt-4">
                {launching ? "Decolando missão..." : loading ? "Acessando..." : "Entrar na Plataforma"}
              </button>
            </form>


          </div>
        </section>
      </div>
    </main>
  );
}

function PremiumInput({ label, icon, type, value, onChange, placeholder, autoComplete, trailing }: { label?: string; icon: React.ReactNode; type: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; trailing?: React.ReactNode }) {
  return <div className="auth-input-group">{label && <span>{label}</span>}<label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border px-5 [&_svg]:h-5 [&_svg]:w-5"><span className="shrink-0">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label || placeholder} autoComplete={autoComplete} required className="min-w-0 flex-1 bg-transparent text-lg outline-none" /><span className="shrink-0">{trailing}</span></label></div>;
}
