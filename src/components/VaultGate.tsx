import { useState, useEffect, ReactNode } from "react";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useCrypto } from "@/hooks/useCrypto";

/**
 * Bloqueia o conteúdo até que o usuário configure ou desbloqueie o cofre E2E.
 * A senha do cofre é distinta da senha de login, é única por usuário e nunca
 * é enviada ao servidor. Ao sair da área protegida, o cofre é travado
 * automaticamente — na próxima entrada a chave deverá ser digitada de novo.
 */
export default function VaultGate({ children }: { children: ReactNode }) {
  const { unlocked, needsSetup, hasKeypair, loading, setup, unlock, lock } = useCrypto();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sempre que a área protegida for desmontada (usuário troca de rota, fecha aba),
  // o cofre é apagado da memória. Isso força o pedido da chave a cada acesso.
  useEffect(() => {
    return () => lock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando cofre…</div>;
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

  return (
    <div className="grid h-full place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">{needsSetup ? "Criar cofre de fotos" : "Desbloquear cofre"}</h2>
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
              A senha do cofre <b>não é a mesma do login</b> e nunca sai deste dispositivo. Nem a Lovable, nem o
              servidor conseguem ler suas fotos.
            </span>
          </p>
        </div>

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
              minLength={10}
              placeholder={needsSetup ? "Senha do cofre (mín. 10)" : "Senha do cofre"}
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
                minLength={10}
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
              ⚠️ Se você esquecer esta senha, um <b>admin da clínica</b> pode recuperar o acesso às fotos (backup de
              chave). Guarde a senha em local seguro.
            </p>
          )}
          <button
            disabled={busy}
            className="mt-1 h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow disabled:opacity-50"
          >
            {busy ? "Processando..." : needsSetup ? "Criar cofre" : "Desbloquear"}
          </button>
        </form>
      </div>
    </div>
  );
}
