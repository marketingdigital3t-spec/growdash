import { ArrowRight, Construction, DatabaseZap, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { findModule } from "./navigation";
import { PageHeading } from "./shared";

export default function ModulePage() {
  const { pathname } = useLocation();
  const module = findModule(pathname);
  if (!module) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeading eyebrow="Growdash" title={module.label} description={module.description} />
      <section className="gd-panel overflow-hidden">
        <div className="border-b border-border bg-gradient-to-r from-[#fff8e4] to-transparent p-6 dark:from-[#211b0e]">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground"><Construction className="h-6 w-6" /></span>
          <h2 className="mt-5 text-xl font-black">Módulo em implementação segura</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Esta área ainda não possui uma fonte de dados real finalizada. Os números demonstrativos foram removidos para impedir decisões baseadas em informações fictícias.
          </p>
        </div>
        <div className="grid gap-3 p-6 md:grid-cols-2">
          <article className="rounded-xl border border-border p-4"><div className="flex items-center gap-3"><DatabaseZap className="h-5 w-5 text-[#a17817]" /><b className="text-sm">Dados verificáveis</b></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">O módulo será liberado quando consultas, estados vazios, sincronização e tratamento de erro estiverem conectados ao Supabase.</p></article>
          <article className="rounded-xl border border-border p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[#43845a]" /><b className="text-sm">Sem dados falsos</b></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Nenhum KPI, gráfico ou alerta é inventado para preencher a tela.</p></article>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border p-6">
          <Link to="/integracoes" className="gd-button">Verificar integrações <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/saude-dos-dados" className="gd-button">Saúde dos dados <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
