import { Link } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";

export default function Signup() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-2xl font-black">Cadastro restrito</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Esta plataforma é de acesso privado. Não há cadastro público — somente clínicas assinantes
          e as pacientes convidadas por elas conseguem entrar.
        </p>
        <div className="mb-5 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="mb-2 flex items-center gap-2 font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Como conseguir acesso
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Se você é <b>profissional/clínica assinante</b>, acesse com o e-mail e senha recebidos.</li>
            <li>Se você é <b>paciente</b>, sua clínica precisa criar o seu login e enviar suas credenciais.</li>
          </ul>
        </div>
        <Link
          to="/login"
          className="grid h-12 w-full place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg hover:opacity-90"
        >
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
