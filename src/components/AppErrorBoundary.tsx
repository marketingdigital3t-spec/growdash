import React from "react";
import { AlertTriangle, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erro crítico na interface", error, info);
  }

  private clearLocalState = () => {
    try {
      localStorage.removeItem("growthos:hero-visible");
      localStorage.removeItem("growthos:revenue-chart-type");
      localStorage.removeItem("dash:account");
      localStorage.removeItem("dash:campaigns");
      sessionStorage.removeItem("growthos:dashboard-hero-dismissed");
    } catch {}
    window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-xl rounded-lg border border-destructive/30 bg-card/85 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">A interface encontrou um erro</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O login está protegido, mas um componente falhou ao carregar. Use as ações abaixo para recarregar a
                plataforma sem perder sua conta.
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-white/10 bg-background/60 p-3 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              Detalhe técnico
            </div>
            <p className="break-words">{this.state.error.message || "Erro desconhecido no carregamento da tela."}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Recarregar
            </Button>
            <Button variant="outline" onClick={this.clearLocalState}>
              Restaurar filtros locais
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
