import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { clearRecoveryAttempts, consumeRecoveryAttempt, isRecoverableChunkError, recordRuntimeDiagnostic, recoverLatestBuildOnce } from "@/lib/resilience";

type Props = { children: ReactNode; resetKey: string; scope?: string };
type State = { error: Error | null; retryBlocked: boolean; attempts: number };

/** Keeps a broken route from unmounting navigation, session and all other modules. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryBlocked: false, attempts: 0 };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordRuntimeDiagnostic(this.props.scope || this.props.resetKey, error);
    console.error("Growdash route render error", error, info.componentStack);
    // A stale lazy chunk is recoverable only by receiving the latest shell.
    // This runs once per route and then fails closed to the visible recovery UI.
    if (recoverLatestBuildOnce(this.props.scope || this.props.resetKey, error)) return;
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      clearRecoveryAttempts(this.props.scope || this.props.resetKey);
      this.setState({ error: null, retryBlocked: false, attempts: 0 });
    }
  }

  retry = () => {
    const recovery = consumeRecoveryAttempt(this.props.scope || this.props.resetKey);
    if (recovery.blocked) {
      this.setState({ retryBlocked: true, attempts: recovery.attempts });
      return;
    }
    this.setState({ error: null, retryBlocked: false, attempts: recovery.attempts });
  };

  reloadLatest = () => {
    const recovery = consumeRecoveryAttempt(this.props.scope || this.props.resetKey);
    if (recovery.blocked) {
      this.setState({ retryBlocked: true, attempts: recovery.attempts });
      return;
    }
    window.location.reload();
  };

  goHome = () => {
    clearRecoveryAttempts(this.props.scope || this.props.resetKey);
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;
    const refreshRequired = isRecoverableChunkError(this.state.error);
    return <section className="gd-panel grid min-h-[52vh] place-items-center p-6 text-center" role="alert" aria-live="assertive">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
        <h1 className="mt-4 text-lg font-black">{this.state.retryBlocked ? "Este módulo continua indisponível" : "Não foi possível carregar este módulo"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{this.state.retryBlocked ? "As tentativas foram interrompidas para impedir um loop. Escolha outra tela ou volte ao início." : refreshRequired ? "Uma atualização substituiu os arquivos desta tela. Atualize uma única vez para abrir a versão atual." : "A navegação e seus dados continuam seguros. Tente este módulo novamente."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!this.state.retryBlocked && <button type="button" onClick={this.retry} className="gd-button"><RefreshCw className="h-4 w-4" /> Tentar módulo</button>}
          {refreshRequired && !this.state.retryBlocked && <button type="button" onClick={this.reloadLatest} className="gd-button">Atualizar versão</button>}
          <button type="button" onClick={this.goHome} className="gd-button">Ir para o início</button>
        </div>
      </div>
    </section>;
  }
}
