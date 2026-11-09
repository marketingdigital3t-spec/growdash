import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { setAuthPersistence, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandLogo";
import rocketLogo from "@/assets/rocket-logo.jpg";

type Mode = "login" | "register";

function isTransientAuthError(error: { status?: number; message?: string } | null | undefined) {
  return !!error && ([0, 408, 429, 500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530].includes(Number(error.status)) || /HTTP\s*5\d\d|upstream|temporar|tempo de carregamento|timed out|timeout|network|fetch failed/i.test(error.message || ""));
}

function authErrorMessage(error: { status?: number; message?: string } | null | undefined) {
  if (isTransientAuthError(error)) return "O serviço de autenticação está temporariamente indisponível. Tente novamente em alguns instantes; sua conta e senha não foram alteradas.";
  return error?.message || "Não foi possível concluir o acesso.";
}

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const email = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Informe um e-mail válido", description: "Use o e-mail completo cadastrado na Growdash.", variant: "destructive" });
      return;
    }
    if (mode === "register" && password !== confirmPassword) { toast({ title: "As senhas não coincidem", variant: "destructive" }); return; }
    if (mode === "register" && !legalAccepted) { toast({ title: "Aceite os documentos legais", description: "Leia e aceite os Termos de Uso e a Política de Privacidade para criar sua conta.", variant: "destructive" }); return; }
    setLoading(true);
    if (mode === "login") {
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
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    setLoading(false);
    if (error) { toast({ title: "Não foi possível criar a conta", description: authErrorMessage(error), variant: "destructive" }); return; }
    if (data.session) {
      await (supabase as any).rpc("record_legal_consent", { _terms_version: "1.0", _privacy_version: "1.0" });
      setLaunching(true);
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1600);
    }
    else toast({ title: "Cadastro realizado", description: "Confirme seu email para acessar a Growdash." });
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

  async function social(provider: "google" | "apple") {
    setAuthPersistence(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
    if (error) toast({ title: `Login ${provider === "google" ? "Google" : "Apple"} indisponível`, description: "Confira se o provedor está habilitado no Supabase.", variant: "destructive" });
  }

  return (
    <main className="auth-cosmic-viewport">
      {/* COLUNA ESQUERDA: Foguete, Jato de Fogo, Faíscas e Narrativa da Missão */}
      <section className={cn("auth-cosmic-left-panel", launching && "launching")}>
        <div className="auth-cosmic-left-bg">
          <img src={rocketLogo} alt="Growdash Rocket Mission" />
          <div className="auth-cosmic-left-overlay" />

          {/* Jato de fogo azul/ciano na base do foguete */}
          <div className="auth-left-thruster">
            <div className="auth-left-flame-plume" />
            <div className="auth-left-flame-core" />
            {/* Faíscas de energia subindo pela fuselagem */}
            {[...Array(10)].map((_, i) => (
              <span
                key={i}
                className="auth-spark"
                style={{
                  left: `${30 + (i * 4.5)}%`,
                  top: `${15 + (i * 7.5)}%`,
                  animationDelay: `${i * 0.18}s`,
                  ["--spark-x" as any]: `${(i % 2 === 0 ? 1 : -1) * (12 + i * 3)}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Conteúdo textual da missão no rodapé da coluna esquerda */}
        <div className="auth-cosmic-left-content">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-400/40 bg-sky-950/60 text-sky-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-3 shadow-[0_0_20px_rgba(0,168,255,0.4)] backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
            Growdash Mission Control
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_25px_rgba(0,0,0,0.9)]">
            Da Terra à Galáxia: lance, acelere e escale seu negócio.
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-lg leading-relaxed drop-shadow-[0_2px_15px_rgba(0,0,0,0.9)]">
            Tráfego, leads, funil e faturamento alimentando o combustível da sua missão. Suba de fase em tempo real.
          </p>
          <p className="mt-4 text-xs font-semibold text-sky-400/90 tracking-wide uppercase">
            Sua jornada começa na Terra, ganha órbita e conquista a Galáxia.
          </p>
        </div>
      </section>

      {/* COLUNA DIREITA: Card de Autenticação */}
      <section className="auth-cosmic-right-panel">
        <div className={cn("auth-card-docked", launching && "launching")}>
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {mode === "login" ? "Seja Bem-Vindo(a)" : "Criar conta"}
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              {mode === "login" ? "Acesse sua operação Growdash." : "Crie o acesso da sua operação."}
            </p>
          </div>

          {mode === "register" && (
            <div className="auth-mode-switch mb-4" role="tablist" aria-label="Tipo de acesso">
              <button type="button" role="tab" aria-selected={false} onClick={() => setMode("login")}>
                Entrar
              </button>
              <button type="button" role="tab" aria-selected className="is-active">
                Cadastrar
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <PremiumInput icon={<UserRound />} type="text" value={name} onChange={setName} placeholder="Nome completo" autoComplete="name" />
            )}
            <PremiumInput label="E-mail" icon={<Mail />} type="email" value={identifier} onChange={setIdentifier} placeholder="seu@email.com" autoComplete="email" />
            <PremiumInput label="Senha" icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} trailing={<button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-white" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
            {mode === "register" && (
              <PremiumInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmar senha" autoComplete="new-password" />
            )}
            {mode === "register" && (
              <label className="flex items-start gap-2 text-[11px] text-slate-400">
                <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} required className="mt-0.5" />
                <span>Li e aceito os <Link to="/termos" target="_blank" className="font-bold text-sky-400 hover:underline">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" className="font-bold text-sky-400 hover:underline">Política de Privacidade</Link>.</span>
              </label>
            )}
            {mode === "login" && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Acesso mantido neste dispositivo</span>
                <button type="button" onClick={() => { setForgotOpen((v) => !v); setForgotEmail(identifier.includes("@") ? identifier : ""); }} className="font-semibold text-sky-400 hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            )}
            {forgotOpen && (
              <div className="rounded-xl border border-sky-400/30 bg-sky-950/30 p-3 text-xs text-slate-300 space-y-2">
                <p>Recupere a senha ou receba um link de acesso por e-mail:</p>
                <div className="flex gap-2">
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com" className="flex-1 bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  <button type="button" onClick={recover} disabled={loading} className="bg-primary text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-primary/90">Enviar</button>
                </div>
                <button type="button" onClick={sendAccessLink} disabled={loading} className="text-sky-400 hover:underline text-[11px] block text-center w-full pt-1">
                  Enviar link de acesso sem senha
                </button>
              </div>
            )}
            <button type="submit" disabled={loading || launching} className="auth-submit-button w-full mt-4">
              {launching ? "Decolando missão..." : loading ? "Acessando..." : mode === "login" ? "Entrar na Plataforma" : "Criar conta"}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-4 text-center text-xs text-slate-400">
              Ainda não tem acesso? <button type="button" className="text-sky-400 font-bold hover:underline" onClick={() => setMode("register")}>Criar conta</button>
            </p>
          )}

          <div className="auth-divider"><span />ou continue com<span /></div>
          <div className="auth-social-grid">
            <button type="button" onClick={() => social("Claude Opus 5")}><span className="auth-google-mark">G</span>Continuar com Claude Opus 5</button>
            <button type="button" onClick={() => social("apple")}><span className="auth-apple-mark" aria-hidden="true"></span>Continuar com iCloud</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function PremiumInput({ label, icon, type, value, onChange, placeholder, autoComplete, trailing }: { label?: string; icon: React.ReactNode; type: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; trailing?: React.ReactNode }) {
  return <div className="auth-input-group">{label && <span>{label}</span>}<label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border px-5 [&_svg]:h-5 [&_svg]:w-5"><span className="shrink-0">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label || placeholder} autoComplete={autoComplete} required className="min-w-0 flex-1 bg-transparent text-lg outline-none" /><span className="shrink-0">{trailing}</span></label></div>;
}
