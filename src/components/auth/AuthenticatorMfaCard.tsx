import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type TotpFactor = { id: string; friendly_name?: string; status?: string };
type Enrollment = { id: string; qrCode: string; secret: string };

export function AuthenticatorMfaCard() {
  const { toast } = useToast();
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");

  const loadFactors = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setBusy(false);
    setLoaded(true);
    if (error) {
      toast({ title: "Não foi possível verificar o 2FA", description: error.message, variant: "destructive" });
      return;
    }
    setFactors(((data as any)?.totp || []).filter((factor: TotpFactor) => factor.status === "verified"));
  };

  const beginEnrollment = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Growdash Authenticator" });
    setBusy(false);
    if (error || !data?.totp) {
      toast({ title: "Authenticator indisponível", description: error?.message || "O Supabase não retornou os dados de ativação.", variant: "destructive" });
      return;
    }
    setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  };

  const confirmEnrollment = async () => {
    if (!enrollment || !/^\d{6}$/.test(code)) {
      toast({ title: "Código inválido", description: "Digite os 6 números exibidos no aplicativo Authenticator.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    setBusy(false);
    if (error) {
      toast({ title: "Código não confirmado", description: error.message, variant: "destructive" });
      return;
    }
    setEnrollment(null);
    setCode("");
    toast({ title: "Autenticação em duas etapas ativada", description: "Os próximos logins exigirão o código do seu Authenticator." });
    await loadFactors();
  };

  const cancelEnrollment = async () => {
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
    setEnrollment(null);
    setCode("");
  };

  const disableFactor = async (factorId: string) => {
    if (!window.confirm("Remover este Authenticator? A conta voltará a depender apenas da senha.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      toast({ title: "Não foi possível remover o 2FA", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Authenticator removido" });
    await loadFactors();
  };

  if (!loaded) {
    return <section className="rounded-2xl border border-border bg-muted/25 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span><div className="min-w-0 grow"><h2 className="font-black">Authenticator (2FA)</h2><p className="text-xs text-muted-foreground">Proteja a conta com códigos temporários de seis dígitos.</p></div><Button variant="outline" onClick={loadFactors} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}</Button></div></section>;
  }

  return <section className="rounded-2xl border border-border bg-muted/25 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{factors.length ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}</span>
      <div className="min-w-0 grow"><h2 className="font-black">Authenticator (2FA)</h2><p className="text-xs text-muted-foreground">{factors.length ? "Ativo. A sessão só entra na plataforma após validar o segundo fator." : "Inativo. Recomendado para proprietários e administradores."}</p></div>
      {!factors.length && !enrollment && <Button onClick={beginEnrollment} disabled={busy}><KeyRound className="mr-2 h-4 w-4" />Ativar</Button>}
    </div>

    {factors.map((factor) => <div key={factor.id} className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"><div><b className="text-sm">{factor.friendly_name || "Aplicativo Authenticator"}</b><p className="text-[10px] text-muted-foreground">Fator verificado</p></div><Button variant="outline" size="sm" onClick={() => disableFactor(factor.id)} disabled={busy}>Remover</Button></div>)}

    {enrollment && <div className="mt-5 grid gap-5 border-t border-border pt-5 md:grid-cols-[190px_1fr]">
      <div className="rounded-2xl bg-white p-3"><img src={enrollment.qrCode} alt="QR Code para cadastrar a Growdash no Authenticator" className="aspect-square w-full" /></div>
      <div className="space-y-4"><div><h3 className="font-black">1. Escaneie o QR Code</h3><p className="mt-1 text-xs text-muted-foreground">Use Google Authenticator, Microsoft Authenticator, 1Password ou outro aplicativo TOTP.</p></div><div><p className="text-xs font-bold">Chave para cadastro manual</p><code className="mt-1 block break-all rounded-lg border border-border bg-background p-3 text-xs">{enrollment.secret}</code></div><div><label className="text-xs font-bold" htmlFor="totp-enrollment-code">2. Confirme o código de 6 dígitos</label><Input id="totp-enrollment-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 max-w-48 text-center text-lg tracking-[.35em]" placeholder="000000" /></div><div className="flex flex-wrap gap-2"><Button onClick={confirmEnrollment} disabled={busy || code.length !== 6}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar e ativar</Button><Button variant="ghost" onClick={cancelEnrollment} disabled={busy}>Cancelar</Button></div></div>
    </div>}
  </section>;
}
