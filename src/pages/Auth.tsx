import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandLogo";

type Mode = "login" | "register";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [remember, setRemember] = useState(true);
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
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast({ title: "Não foi possível entrar", description: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos. Se necessário, use a recuperação de acesso." : error.message, variant: "destructive" }); return; }
      navigate("/", { replace: true });
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    setLoading(false);
    if (error) { toast({ title: "Não foi possível criar a conta", description: error.message, variant: "destructive" }); return; }
    if (data.session) navigate("/", { replace: true });
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
    if (error) toast({ title: "Recuperação não enviada", description: error.message, variant: "destructive" });
    else { toast({ title: "Link de recuperação enviado" }); setForgotOpen(false); }
  }

  async function social(provider: "google" | "apple") {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
    if (error) toast({ title: `Login ${provider === "google" ? "Google" : "Apple"} indisponível`, description: "Confira se o provedor está habilitado no Supabase.", variant: "destructive" });
  }

  return <main className="auth-premium-shell">
    <div className="auth-ambient-grid" aria-hidden="true" /><div className="auth-ambient-glow auth-glow-a" aria-hidden="true" /><div className="auth-ambient-glow auth-glow-b" aria-hidden="true" />
    <section className="auth-hero-panel" aria-label="Growdash">
      <div className="auth-neural-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="auth-hero-smoke auth-hero-smoke-a" aria-hidden="true" /><div className="auth-hero-smoke auth-hero-smoke-b" aria-hidden="true" />
      <div className="auth-hero-symbol" aria-hidden="true"><BrandMark /></div>
      <div className="auth-hero-copy">
        <p className="auth-hero-tagline">Sua Jornada de Crescimento<br />Digital Começa Aqui</p>
        <p className="auth-hero-kicker">Growdash Intelligence System</p>
      </div>
      <p className="auth-hero-description"><BarChart3 />Gestão de tráfego, funis e crescimento em um só lugar</p>
    </section>
    <motion.section initial={{ opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .5, ease: "easeOut" }} className="auth-card-premium">
      <div className="auth-card-symbol" aria-hidden="true"><BrandMark /></div>
      <div className="auth-card-top"><div><h1>{mode === "login" && <span className="sr-only">Entrar na Growdash. </span>}{mode === "login" ? "Seja Bem-Vindo(a)" : "Criar conta"}</h1><p aria-hidden="true">{mode === "login" ? "Acesse sua operação Growdash." : "Crie o acesso da sua operação."}</p></div></div>
      {mode === "register" && <div className="auth-mode-switch" role="tablist" aria-label="Tipo de acesso"><button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Entrar</button><button type="button" role="tab" aria-selected className="is-active">Cadastrar</button></div>}
      <form onSubmit={handleSubmit} className="auth-form-premium">
        {mode === "register" && <PremiumInput icon={<UserRound />} type="text" value={name} onChange={setName} placeholder="Nome completo" autoComplete="name" />}
        <PremiumInput label="E-mail" icon={<Mail />} type="email" value={identifier} onChange={setIdentifier} placeholder="seu@email.com" autoComplete="email" />
        <PremiumInput label="Senha" icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button>} />
        {mode === "register" && <PremiumInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmar senha" autoComplete="new-password" />}
        {mode === "login" && <div className="auth-forgot-row"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Lembrar de mim</label><button type="button" onClick={() => { setForgotOpen((value) => !value); setForgotEmail(identifier.includes("@") ? identifier : ""); }} className="auth-link">Esqueceu a senha?</button></div>}
        {forgotOpen && <div className="auth-recovery-box"><p>Enviaremos um link seguro para criar uma nova senha.</p><div className="auth-recovery-row"><input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="seu@email.com" /><button type="button" onClick={recover}>Enviar link</button></div></div>}
        <button type="submit" disabled={loading} className="auth-submit-button">{loading ? "Entrando…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
      </form>
      <div className="auth-divider"><span />ou continue com<span /></div>
      <div className="auth-social-grid"><button type="button" onClick={() => social("google")}><span className="auth-google-mark">G</span>Continuar com Google</button><button type="button" onClick={() => social("apple")}><span className="auth-apple-mark" aria-hidden="true"></span>Continuar com iCloud</button></div>
      <div className="auth-card-footer"><ShieldCheck className="h-3.5 w-3.5" /> Não tem uma conta? <button type="button" onClick={() => setMode("register")}>Criar conta</button></div>
    </motion.section>
  </main>;
}

function PremiumInput({ label, icon, type, value, onChange, placeholder, autoComplete, trailing }: { label?: string; icon: React.ReactNode; type: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; trailing?: React.ReactNode }) {
  return <div className="auth-input-group">{label && <span>{label}</span>}<label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border px-5 [&_svg]:h-5 [&_svg]:w-5"><span className="shrink-0">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} required className="min-w-0 flex-1 bg-transparent text-lg outline-none" /><span className="shrink-0">{trailing}</span></label></div>;
}
