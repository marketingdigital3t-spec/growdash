import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, Radar, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { GROWDASH_BRAND_ICON, GROWDASH_BRAND_LOGO, GROWDASH_BRAND_NAME } from "@/lib/companySettings";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [glow, setGlow] = useState({ x: 50, y: 46 });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      sessionStorage.removeItem("growthos:dashboard-hero-dismissed");
    } catch {}

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: "E-mail ou senha inválidos", variant: "destructive" });
    }

    setLoading(false);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#05020c] p-4 text-white"
      style={
        {
          "--growdash-glow-x": `${glow.x}%`,
          "--growdash-glow-y": `${glow.y}%`,
        } as React.CSSProperties
      }
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setGlow({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.1)_1px,transparent_1px)] bg-[size:72px_72px] opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--growdash-glow-x)_var(--growdash-glow-y),rgba(139,92,246,0.42),rgba(192,38,255,0.18)_22%,transparent_48%)] transition-[background] duration-300" />
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-violet-700/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="hidden space-y-8 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-violet-300/35 bg-black/35 shadow-[0_0_42px_rgba(139,92,246,0.42)]">
              <img src={GROWDASH_BRAND_LOGO} alt={GROWDASH_BRAND_NAME} className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-100">{GROWDASH_BRAND_NAME}</div>
              <div className="text-xs text-violet-200/65">Revenue intelligence cockpit</div>
            </div>
          </div>
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-100 shadow-[0_0_24px_rgba(168,85,247,0.16)]">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Sistema operacional de crescimento
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-normal">
              Tráfego, CRM e vendas em uma operação de receita inteligente.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-violet-100/65">
              Acesse um cockpit seguro para conectar mídia paga, RD Station, CRM e time comercial em decisões executivas rastreáveis.
            </p>
          </div>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { label: "Previsão", value: "30/90d", icon: Radar },
              { label: "ROAS", value: "Blended", icon: TrendingUp },
              { label: "Permissões", value: "Multiempresa", icon: ShieldCheck },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-violet-200/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
                <item.icon className="mb-5 h-5 w-5 text-violet-200" />
                <div className="text-lg font-semibold">{item.value}</div>
                <div className="mt-1 text-xs uppercase text-violet-100/50">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <Card className="w-full border-violet-200/15 bg-[#0d071b]/88 text-white shadow-2xl shadow-violet-950/40 backdrop-blur-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-violet-300/35 bg-black/35 shadow-[0_0_44px_rgba(139,92,246,0.38)]">
              <img src={GROWDASH_BRAND_LOGO} alt={GROWDASH_BRAND_NAME} className="h-full w-full object-contain" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold">Acesse o cockpit</CardTitle>
              <CardDescription className="mt-2 text-violet-100/55">Entre com o usuário liberado pelo administrador da Growdash</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Usuário ou e-mail"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                required
                className="h-12 border-violet-200/10 bg-black/25 text-white placeholder:text-violet-100/40 focus-visible:ring-violet-400"
              />
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-12 border-violet-200/10 bg-black/25 pr-11 text-white placeholder:text-violet-100/40 focus-visible:ring-violet-400"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-100/50 transition-opacity duration-300 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="submit"
                className="h-12 w-full gap-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 text-white shadow-[0_18px_50px_rgba(168,85,247,0.28)] transition-all duration-200 hover:from-violet-400 hover:via-fuchsia-400 hover:to-purple-400"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
