import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#020202] p-4 text-white">
    <div className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(circle_at_8%_18%,rgba(218,158,25,.28),transparent_25%),radial-gradient(circle_at_88%_72%,rgba(185,118,9,.2),transparent_28%),linear-gradient(125deg,transparent_0_20%,rgba(220,163,35,.08)_30%,transparent_42%_70%,rgba(220,163,35,.09)_82%,transparent_92%)]" />
    <div className="pointer-events-none absolute inset-y-0 left-[4%] w-px bg-gradient-to-b from-transparent via-[#ad7a16]/50 to-transparent" />
    <div className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-gradient-to-b from-transparent via-[#ad7a16]/35 to-transparent" />
    <motion.section initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .45 }} className="relative w-full max-w-[720px] rounded-[28px] border border-[#8b691e]/45 bg-black/85 px-5 py-8 shadow-[0_25px_90px_rgba(0,0,0,.75),inset_0_0_65px_rgba(181,126,18,.05)] backdrop-blur-xl sm:px-12 sm:py-10">
      <img src="./growdash-logo-full.png" alt="Growdash" className="mx-auto h-20 w-auto object-contain sm:h-24" />
      <h1 className="mt-6 text-center text-3xl font-semibold sm:text-5xl">Bem-vindo(a)</h1>
      <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl bg-[#0b0909] p-1.5">
        <button type="button" onClick={() => setMode("login")} className={cn("rounded-xl px-4 py-4 text-lg font-bold transition", mode === "login" ? "bg-[#171313] text-white" : "text-white/65 hover:text-white")}>Entrar</button>
        <button type="button" onClick={() => setMode("register")} className={cn("rounded-xl px-4 py-4 text-lg font-bold transition", mode === "register" ? "bg-[#171313] text-white" : "text-white/65 hover:text-white")}>Cadastrar</button>
      </div>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {mode === "register" && <GoldInput icon={<UserRound />} type="text" value={name} onChange={setName} placeholder="Nome completo" autoComplete="name" />}
        <GoldInput icon={<Mail />} type="text" value={identifier} onChange={setIdentifier} placeholder="Email" autoComplete="username" />
        <GoldInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="Senha" autoComplete={mode === "login" ? "current-password" : "new-password"} trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button>} />
        {mode === "register" && <GoldInput icon={<LockKeyhole />} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmar senha" autoComplete="new-password" />}
        {mode === "login" && <div className="flex justify-end"><button type="button" onClick={() => { setForgotOpen((value) => !value); setForgotEmail(identifier.includes("@") ? identifier : ""); }} className="text-sm font-semibold text-[#d4a52b] hover:text-[#ffe175]">Esqueci minha senha</button></div>}
        {forgotOpen && <div className="rounded-xl border border-[#7a5a18]/50 bg-[#100d08] p-4"><p className="mb-3 text-xs text-white/60">Enviaremos um link seguro para criar uma nova senha.</p><div className="flex flex-col gap-2 sm:flex-row"><input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-[#6f531b] bg-black px-3 outline-none focus:border-[#e5b733]" placeholder="seu@email.com" /><button type="button" onClick={recover} className="rounded-lg border border-[#c39625] px-4 text-sm font-bold text-[#e8bd42]">Enviar link</button></div></div>}
        <button type="submit" disabled={loading} className="group flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-[#ffe781] bg-gradient-to-r from-[#ffe275] via-[#ffc12f] to-[#e88b08] text-xl font-black text-[#2f2106] shadow-[0_0_30px_rgba(241,181,42,.25)] transition hover:brightness-110 disabled:opacity-60">{loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}<ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" /></button>
      </form>
      <div className="my-6 flex items-center gap-4 text-sm uppercase tracking-[.2em] text-[#a47a1d]"><span className="h-px flex-1 bg-[#6e5016]" />ou<span className="h-px flex-1 bg-[#6e5016]" /></div>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => social("google")} className="flex h-14 items-center justify-center gap-3 rounded-xl bg-white text-lg font-bold text-[#292929] transition hover:bg-white/90"><span className="text-xl font-black text-[#4285f4]">G</span>Google</button><button type="button" onClick={() => social("apple")} className="flex h-14 items-center justify-center gap-3 rounded-xl border border-[#6b521b]/70 bg-black text-lg font-bold text-white transition hover:bg-[#0d0d0d]"><span className="text-2xl" aria-hidden="true"></span>Apple</button></div>
    </motion.section>
  </main>;
}

function GoldInput({ icon, type, value, onChange, placeholder, autoComplete, trailing }: { icon: React.ReactNode; type: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; trailing?: React.ReactNode }) {
  return <label className="flex h-16 items-center gap-4 rounded-2xl border border-[#6d521b]/60 bg-black/80 px-5 text-[#d3a426] focus-within:border-[#e0ae29] focus-within:shadow-[0_0_18px_rgba(214,161,37,.12)] [&_svg]:h-5 [&_svg]:w-5"><span className="shrink-0">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} required className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/55" /><span className="shrink-0">{trailing}</span></label>;
}
