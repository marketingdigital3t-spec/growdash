import { useEffect, useState, type ReactNode } from "react";
import { Loader2, LockKeyhole, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MFA_CHECK_TIMEOUT_MS, MFA_VERIFY_TIMEOUT_MS, mfaCheckErrorMessage, mfaVerifyErrorMessage } from "@/lib/mfaAvailability";
import { recordRuntimeDiagnostic } from "@/lib/resilience";

type GateState = "checking" | "clear" | "challenge" | "unavailable";

export function MfaChallengeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: aal, error: aalError } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel(), MFA_CHECK_TIMEOUT_MS);
        if (aalError) throw aalError;
        if (!aal?.currentLevel) throw new Error("Resposta de segurança incompleta.");
        if (!active) return;
        if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
          const { data, error: factorsError } = await withTimeout(supabase.auth.mfa.listFactors(), MFA_CHECK_TIMEOUT_MS);
          if (factorsError) throw factorsError;
          const factor = ((data as any)?.totp || []).find((item: any) => item.status === "verified");
          if (!factor?.id) throw new Error("Nenhum fator MFA verificado foi encontrado.");
          setFactorId(factor.id);
          setState("challenge");
          return;
        }
        setState("clear");
      } catch (checkError) {
        recordRuntimeDiagnostic("auth:mfa-check", new Error(`mfa_check:${mfaCheckErrorMessage(checkError)}`));
        if (active) {
          setError(mfaCheckErrorMessage(checkError));
          setState("unavailable");
        }
      }
    })();
    return () => { active = false; };
  }, [checkAttempt]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError("Digite o código de 6 números.");
    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await withTimeout(supabase.auth.mfa.challengeAndVerify({ factorId, code }), MFA_VERIFY_TIMEOUT_MS);
      if (verifyError) throw verifyError;
      setState("clear");
    } catch (verifyError) {
      recordRuntimeDiagnostic("auth:mfa-verify", new Error(`mfa_verify:${mfaVerifyErrorMessage(verifyError)}`));
      setError(mfaVerifyErrorMessage(verifyError));
    } finally {
      setBusy(false);
    }
  };

  if (state === "clear") return <>{children}</>;
  if (state === "checking") return <div className="grid min-h-screen place-items-center bg-background"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-label="Verificando segurança da sessão" /><p className="mt-3 text-sm text-muted-foreground">Verificando segurança da sessão…</p></div></div>;

  if (state === "unavailable") return <main className="brand-shell grid min-h-screen place-items-center p-4"><section className="gd-panel w-full max-w-md p-6 text-center sm:p-8"><BrandLogo eager className="mx-auto h-20 w-52" /><span className="mx-auto mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-4 text-2xl font-black">Não foi possível verificar sua sessão</h1><p role="alert" className="mt-3 text-sm text-muted-foreground">{error || "A conexão com a autenticação falhou."}</p><Button type="button" onClick={() => { setError(""); setState("checking"); setCheckAttempt((value) => value + 1); }} className="mt-5 w-full">Tentar novamente</Button><button type="button" onClick={() => void supabase.auth.signOut()} className="mx-auto mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" />Sair da conta</button></section></main>;

  return <main className="brand-shell grid min-h-screen place-items-center p-4"><section className="gd-panel w-full max-w-md p-6 text-center sm:p-8"><BrandLogo eager className="mx-auto h-20 w-52" /><span className="mx-auto mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-4 text-2xl font-black">Confirme que é você</h1><p className="mt-2 text-sm text-muted-foreground">Digite o código temporário do seu aplicativo Authenticator para abrir a Growdash.</p>{error && <p role="alert" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-200">{error}</p>}<Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => event.key === "Enter" && void verify()} inputMode="numeric" autoComplete="one-time-code" autoFocus className="mx-auto mt-6 h-12 max-w-56 text-center text-xl tracking-[.4em]" placeholder="000000" aria-label="Código do Authenticator" /><Button onClick={verify} disabled={busy || code.length !== 6} className="mt-5 w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Validar acesso</Button><Button type="button" variant="outline" onClick={() => { setError(""); setState("checking"); setCheckAttempt((value) => value + 1); }} className="mt-2 w-full">Tentar verificar novamente</Button><button type="button" onClick={() => void supabase.auth.signOut()} className="mx-auto mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" />Sair da conta</button></section></main>;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("timeout")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}
