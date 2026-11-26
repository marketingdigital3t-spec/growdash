import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { setAuthPersistence, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
      ({ error } = await supabase.auth.signInWithPassword({ email: emailValue, password }));
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
    setTimeout(() => navigate("/", { replace: true }), 2200);
  }

  async function recover() {
    const recoveryEmail = (forgotEmail || email).trim();
    if (!recoveryEmail.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setLoading(true);
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
      <main className="auth-preview auth-preview--launched" aria-label="Acesso confirmado">
        <div className="auth-preview-frame" aria-hidden="true">
          <span className="auth-preview-orbit" />
          <span className="auth-preview-check">✓</span>
        </div>
        <p className="auth-preview-confirmation">Preparando seu espaço de trabalho</p>
      </main>
    );
  }

  return (
    <main className="auth-preview">
      <div className="auth-preview-glow" aria-hidden="true" />
      <section className="auth-preview-dashboard" aria-hidden="true">
        <div className="auth-preview-topbar"><span className="auth-preview-brand-mark" /><span className="auth-preview-topline" /><span className="auth-preview-avatar" /></div>
        <div className="auth-preview-workspace">
          <div className="auth-preview-rail"><i /><i /><i /><i /></div>
          <div className="auth-preview-content">
            <div className="auth-preview-heading"><span /><b /></div>
            <div className="auth-preview-metrics">
              <div className="auth-preview-metric"><small>Receita</small><b>R$ 48.290</b><i /></div>
              <div className="auth-preview-metric"><small>Conversões</small><b>1.284</b><i /></div>
              <div className="auth-preview-metric"><small>Investimento</small><b>R$ 6.420</b><i /></div>
            </div>
            <div className="auth-preview-panels"><div className="auth-preview-chart"><span /><i /><i /><i /><i /><i /></div><div className="auth-preview-sources"><b /><i /><i /><i /><i /></div></div>
          </div>
        </div>
      </section>
      <div className="auth-preview-shade" aria-hidden="true" />
      <section className="auth-preview-login" aria-labelledby="auth-title">
        <div className="auth-preview-brand"><span className="auth-preview-brand-mark" /><span>growdash</span></div>
        <div className="auth-card-docked">
          <div className="auth-login-heading">
            <p className="auth-login-kicker">Seu espaço de crescimento</p>
            <h1 id="auth-title">Tudo pronto para avançar?</h1>
            <p>Acesse sua operação e acompanhe o que move o seu negócio.</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-login-form">
            <label className="auth-input-group">
              <span>E-mail</span>
              <span className="auth-input-premium"><Mail aria-hidden="true" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail" autoComplete="email" required /></span>
            </label>
            <label className="auth-input-group">
              <span>Senha</span>
              <span className="auth-input-premium"><LockKeyhole aria-hidden="true" /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" aria-label="Senha" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>
            </label>
            <div className="auth-login-utility"><span>Acesso seguro à sua conta</span><button type="button" onClick={() => { setForgotOpen((v) => !v); setForgotEmail(email.includes("@") ? email : ""); }}>Esqueceu a senha?</button></div>
            {forgotOpen && (
              <div className="auth-recovery-box">
                <p>Recupere a senha ou receba um link de acesso por e-mail:</p>
                <div className="auth-recovery-row"><input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail para recuperação" /><button type="button" onClick={recover} disabled={loading}>Enviar</button></div>
                <button type="button" className="auth-recovery-link" onClick={sendAccessLink} disabled={loading}>Enviar link de acesso sem senha</button>
              </div>
            )}
            <button type="submit" disabled={loading} className="auth-submit-button">{loading ? "Acessando…" : "Entrar na Plataforma"}</button>
          </form>
          <p className="auth-login-footnote">Seus dados, campanhas e resultados em um só lugar.</p>
        </div>
      </section>
    </main>
  );
}
