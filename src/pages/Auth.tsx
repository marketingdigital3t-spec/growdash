import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const EMAIL_SUFFIX = "@users.local";

export default function Auth() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const raw = identifier.trim();
    const email = raw.includes("@") ? raw : `${raw.toLowerCase()}${EMAIL_SUFFIX}`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: "Usuário ou senha inválidos", variant: "destructive" });
    } else {
      navigate("/", { replace: true });
    }

    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "A recuperação só funciona para contas com email real (ex: gmail.com).",
        variant: "destructive",
      });
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Email enviado",
      description: "Verifique sua caixa de entrada para redefinir a senha.",
    });
    setForgotOpen(false);
    setForgotEmail("");
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md"
      >
      <Card className="w-full shadow-xl border-0 relative">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Meta Ads Analytics</CardTitle>
            <CardDescription className="mt-2">Acesso restrito</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Usuário"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                required
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-opacity duration-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <Button
                type="submit"
                className="w-full transition-opacity duration-200"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Carregando...
                  </span>
                ) : "Entrar"}
              </Button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotOpen((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>

          {forgotOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
              onSubmit={handleForgot}
              className="mt-4 space-y-3 border-t pt-4"
            >
              <p className="text-xs text-muted-foreground">
                Digite o email da sua conta. Enviaremos um link para redefinir a senha.
              </p>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </motion.form>
          )}
        </CardContent>
      </Card>

      </motion.div>
    </div>
  );
}
