import { useEffect, useState, ReactNode } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Força ativação de 2FA (TOTP) para profissionais e admins antes de acessar
 * áreas sensíveis. Pacientes não são obrigados.
 */
export default function MfaGate({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  // Dono da plataforma (admin) não é obrigado a nada — acesso irrestrito.
  // 2FA continua obrigatório apenas para profissionais adicionadas.
  const mustHaveMfa = roles.includes("professional") && !roles.includes("admin");
  const [status, setStatus] = useState<"checking" | "ok" | "needs_setup" | "needs_verify">("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!mustHaveMfa) {
      setStatus("ok");
      return;
    }
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (!verified) {
        setStatus("needs_setup");
        return;
      }
      if (aal?.currentLevel !== "aal2") {
        setFactorId(verified.id);
        setStatus("needs_verify");
        return;
      }
      setStatus("ok");
    })();
  }, [user, mustHaveMfa, roles]);

  const startEnroll = async () => {
    setErr(null);
    setBusy(true);
    try {
      // Remove qualquer fator TOTP não verificado antigo
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Chat Seguro" });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!factorId) return;
    setErr(null);
    setBusy(true);
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      await supabase.from("security_events").insert({
        user_id: user!.id,
        event_type: "mfa_verified",
        user_agent: navigator.userAgent,
      });
      setStatus("ok");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Verificando 2FA…</div>;
  }
  if (status === "ok") return <>{children}</>;

  return (
    <div className="grid h-full place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">
              {status === "needs_setup" ? "Ative o 2FA" : "Confirme com 2FA"}
            </h2>
            <p className="text-xs text-muted-foreground">Segundo fator é obrigatório para profissional/admin</p>
          </div>
        </div>

        {status === "needs_setup" && !qr && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Instale um app autenticador (Google Authenticator, 1Password, Authy) e clique abaixo para gerar o QR
              Code.
            </p>
            {err && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            <button
              onClick={startEnroll}
              disabled={busy}
              className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow disabled:opacity-50"
            >
              {busy ? "Gerando..." : "Gerar QR Code"}
            </button>
          </>
        )}

        {status === "needs_setup" && qr && (
          <div className="flex flex-col gap-3">
            <div
              className="mx-auto grid h-48 w-48 place-items-center rounded-2xl border border-border bg-background p-2"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            {secret && (
              <p className="rounded-lg bg-muted px-3 py-2 text-center font-mono text-xs">
                {secret}
              </p>
            )}
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-primary"
            />
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            <button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow disabled:opacity-50"
            >
              {busy ? "Verificando..." : "Ativar 2FA"}
            </button>
          </div>
        )}

        {status === "needs_verify" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Digite o código atual do seu autenticador.</p>
            <input
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-primary"
            />
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            <button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow disabled:opacity-50"
            >
              {busy ? "Verificando..." : "Confirmar"}
            </button>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> A sessão é elevada para AAL2 após a confirmação.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
