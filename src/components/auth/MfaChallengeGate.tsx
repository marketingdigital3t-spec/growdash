import { useEffect, useState, type ReactNode } from "react";
import { Loader2, LockKeyhole, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GateState = "checking" | "clear" | "challenge";

export function MfaChallengeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
        const { data } = await supabase.auth.mfa.listFactors();
        const factor = ((data as any)?.totp || []).find((item: any) => item.status === "verified");
        if (factor) {
          setFactorId(factor.id);
          setState("challenge");
          return;
        }
      }
      setState("clear");
    })();
    return () => { active = false; };
  }, []);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError("Digite o código de 6 números.");
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setError("Código inválido ou expirado. Gere um novo código e tente novamente.");
      return;
    }
    setState("clear");
  };

  if (state === "clear") return <>{children}</>;
  if (state === "checking") return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Verificando segurança da sessão" /></div>;

  return <main className="brand-shell grid min-h-screen place-items-center p-4"><section className="gd-panel w-full max-w-md p-6 text-center sm:p-8"><BrandLogo eager className="mx-auto h-20 w-52" /><span className="mx-auto mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-4 text-2xl font-black">Confirme que é você</h1><p className="mt-2 text-sm text-muted-foreground">Digite o código temporário do seu aplicativo Authenticator para abrir a Growdash.</p><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => event.key === "Enter" && void verify()} inputMode="numeric" autoComplete="one-time-code" autoFocus className="mx-auto mt-6 h-12 max-w-56 text-center text-xl tracking-[.4em]" placeholder="000000" aria-label="Código do Authenticator" />{error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}<Button onClick={verify} disabled={busy || code.length !== 6} className="mt-5 w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Validar acesso</Button><button type="button" onClick={() => void supabase.auth.signOut()} className="mx-auto mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" />Sair da conta</button></section></main>;
}
