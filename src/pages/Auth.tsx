import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Radar, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const EMAIL_SUFFIX = "@users.local";
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
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const raw = identifier.trim();
    const email = raw.includes("@") ? raw : `${raw.toLowerCase()}${EMAIL_SUFFIX}`;
    if (mode === "register" && password !== confirmPassword) { toast({ title: "As senhas não coincidem", variant: "destructive" }); return; }
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast({ title: "Não foi possível entrar", description: "Verifique o email e a senha ou use a recuperação de acesso.", variant: "destructive" }); return; }
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password` });
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
    <section className="auth-hero-panel" aria-label="Posicionamento da Growdash">
      <div className="auth-hero-kicker"><Radar className="h-3.5 w-3.5" /> GROWdash intelligence network</div>
      <BrandLogo eager className="auth-hero-logo" />
      <p className="auth-hero-tagline">Mantenha todas as suas campanhas no ar.<br /><span>Nenhuma cai sem você saber.</span></p>
      <div className="auth-hero-orb" aria-hidden="true"><span className="auth-orb-core"><BrainCircuit /></span><i className="orb-ring ring-a" /><i className="orb-ring ring-b" /><i className="orb-ring ring-c" />{Array.from({ length: 12 }, (_, index) => <b key={index} style={{ "--orb-angle": `${index * 30}deg`, "--orb-delay": `${-(index * .32)}s` } as React.CSSProperties} />)}</div>
      <div className="auth-hero-points"><span><CheckCircle2 /> Visão total multi-conta</span><span><Zap /> Alertas antes do desvio</span><span><ShieldCheck /> Dados protegidos por workspace</span></div>
      <small className="auth-hero-foot"><Sparkles /> Torre de controle do crescimento</small>
    </section>
    <motion.section initial={{ opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .5, ease: "easeOut" }} className="auth-card-premium">
      <div className="auth-card-top"><div><span className="auth-card-kicker">ACESSO SEGURO</span><h1>{mode === "login" ? "Entre na sua operação" : "Abra sua torre de controle"}</h1><p>{mode === "login" ? "Continue exatamente de onde sua equipe parou." : "Centralize campanhas, vendas e decisões em um só lugar."}</p></div><span className="auth-status-pill"><i /> Online</span></div>
      <div className="auth-mode-switch" role="tablist" aria-label="Tipo de acesso"><button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={cn(mode === "login" && "is-active")}>Entrar</button><button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")} className={cn(mode === "register" && "is-active")}>Cadastrar</button></div>
      <form onSubmit={handleSubmit} className="auth-form-premium">
        {mode === "register" && <GoldInput icon={<UserRound />} type="text" value={name} onChange={setName} placeholder="Nome completo" autoComplete="name" />}
        <GoldInput icon={<Mail />} type="text" value={identifier} onChange={setIdentifier} placeholder="Email" autoComplete="username" />
        <GoldInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="Senha" autoComplete={mode === "login" ? "current-password" : "new-password"} trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button>} />
        {mode === "register" && <GoldInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmar senha" autoComplete="new-password" />}
        {mode === "login" && <div className="auth-forgot-row"><span>Primeiro acesso?</span><button type="button" onClick={() => { setForgotOpen((value) => !value); setForgotEmail(identifier.includes("@") ? identifier : ""); }} className="auth-link">Esqueci minha senha</button></div>}
        {forgotOpen && <div className="auth-recovery-box"><p>Enviaremos um link seguro para criar uma nova senha.</p><div className="auth-recovery-row"><input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="seu@email.com" /><button type="button" onClick={recover}>Enviar link</button></div></div>}
        <button type="submit" disabled={loading} className="auth-submit-button group">{loading ? "Sincronizando…" : mode === "login" ? "Entrar na Growdash" : "Criar minha conta"}<ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></button>
      </form>
      <div className="auth-divider"><span />ou continue com<span /></div>
      <div className="auth-social-grid"><button type="button" onClick={() => social("google")}><span className="auth-google-mark">G</span> Google</button><button type="button" onClick={() => social("apple")}><span className="auth-apple-mark" aria-hidden="true"></span> Apple</button></div>
      <div className="auth-card-footer"><ShieldCheck className="h-3.5 w-3.5" /> Criptografia e permissões por workspace</div>
    </motion.section>
  </main>;
}

function GoldInput({ icon, type, value, onChange, placeholder, autoComplete, trailing }: { icon: React.ReactNode; type: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; trailing?: React.ReactNode }) {
  return <label className="auth-input-premium flex h-16 items-center gap-4 rounded-2xl border border-[#6d521b]/60 bg-black/80 px-5 text-[#d3a426] focus-within:border-[#e0ae29] focus-within:shadow-[0_0_18px_rgba(214,161,37,.12)] [&_svg]:h-5 [&_svg]:w-5"><span className="shrink-0">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} required className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/55" /><span className="shrink-0">{trailing}</span></label>;
}
