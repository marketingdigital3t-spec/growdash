import { useState, useEffect, ReactNode } from "react";
import { KeyRound, Lock, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { useCrypto } from "@/hooks/useCrypto";

/**
 * Cofre E2E — desbloqueia automaticamente usando a MESMA senha do login
 * (guardada em sessionStorage após o sign-in). Se a senha do login não abrir
 * o cofre (ex.: cofre foi criado antes com outra senha), o usuário pode
 * recriar o cofre para ressincronizar — perde acesso ao histórico
 * criptografado antigo, mas o admin da clínica mantém acesso via escrow.
 */
export default function VaultGate({ children }: { children: ReactNode }) {
  const { unlocked, needsSetup, loading, setup, unlock, resetVault, lock } = useCrypto();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [triedAuto, setTriedAuto] = useState(false);
  const [autoFailed, setAutoFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Tenta abrir/criar automaticamente com a senha do login (uma vez).
  // Se existir um cofre antigo com outra senha, recria o cofre usando a senha atual do login.
  useEffect(() => {
    if (loading || unlocked || triedAuto) return;
    const loginPw = sessionStorage.getItem("vault_pw");
    if (!loginPw) {
      setTriedAuto(true);
      return;
    }
    setTriedAuto(true);
    (async () => {
      setErr(null);
      setBusy(true);
      try {
        if (needsSetup) await setup(loginPw);
        else await unlock(loginPw);
      } catch (unlockError) {
        try {
          await resetVault(loginPw);
        } catch (resetError: unknown) {
          setAutoFailed(true);
          setErr(resetError instanceof Error ? resetError.message : String(resetError || unlockError));
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, unlocked, needsSetup, triedAuto, setup, unlock, resetVault]);

  // Ao sair da área protegida, tranca o cofre
  useEffect(() => {
    return () => lock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || (!triedAuto && !unlocked)) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando cofre…</div>;
  }
  if (unlocked) return <>{children}</>;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (needsSetup) {
        if (pw !== pw2) throw new Error("As senhas não coincidem");
        await setup(pw);
      } else {
        await unlock(pw);
      }
      setPw("");
      setPw2("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doResync = async () => {
    setErr(null);
    setBusy(true);
    try {
      const loginPw = sessionStorage.getItem("vault_pw");
      if (!loginPw) throw new Error("Faça login novamente para sincronizar o cofre.");
      await resetVault(loginPw);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">
              {needsSetup ? "Criar cofre de fotos" : "Desbloquear cofre"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {needsSetup
                ? "Sua chave privada será criptografada com esta senha"
                : "As fotos são criptografadas ponta-a-ponta"}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Use a <b>mesma senha do seu login</b>. Ela desbloqueia o cofre E2E — o servidor nunca a recebe em
              texto puro.
            </span>
          </p>
        </div>

        {autoFailed && !confirmReset && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Não consegui sincronizar o cofre automaticamente com a senha do login. Faça login novamente ou{" "}
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="font-extrabold text-primary underline"
                >
                  tente sincronizar agora
                </button>
                .
              </span>
            </p>
          </div>
        )}

        {confirmReset ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="mb-2 flex items-center gap-2 font-extrabold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Confirmar recriação do cofre
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Vamos criar um cofre novo usando a sua senha de login atual. Você <b>perderá acesso às fotos e
              mensagens criptografadas antigas</b> deste dispositivo. Administradores da clínica continuam
              podendo recuperar o histórico via escrow.
            </p>
            {err && (
              <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="rounded-xl px-3 py-2 text-xs font-bold hover:bg-muted"
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                onClick={doResync}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground shadow disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                {busy ? "Sincronizando..." : "Sim, sincronizar agora"}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                required
                autoFocus
                minLength={8}
                placeholder={needsSetup ? "Senha do seu login (mín. 8)" : "Senha do seu login"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            {needsSetup && (
              <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Confirme a senha"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
            )}
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            {needsSetup && (
              <p className="text-[11px] text-muted-foreground">
                ⚠️ Se você esquecer esta senha, um <b>admin da clínica</b> pode recuperar o acesso às fotos
                (backup de chave). Guarde a senha em local seguro.
              </p>
            )}
            <button
              disabled={busy}
              className="mt-1 h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow disabled:opacity-50"
            >
              {busy ? "Processando..." : needsSetup ? "Criar cofre" : "Desbloquear"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
