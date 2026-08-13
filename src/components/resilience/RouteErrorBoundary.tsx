import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isRecoverableChunkError, recordRuntimeDiagnostic } from "@/lib/resilience";

type Props = { children: ReactNode; resetKey: string; scope?: string };
type State = { error: Error | null };

/** Keeps a broken route from unmounting navigation, session and all other modules. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordRuntimeDiagnostic(this.props.scope || this.props.resetKey, error);
    console.error("Growdash route render error", error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  retry = () => this.setState({ error: null });

  reloadLatest = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("gd_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (!this.state.error) return this.props.children;
    const refreshRequired = isRecoverableChunkError(this.state.error);
    return <section className="gd-panel grid min-h-[52vh] place-items-center p-6 text-center" role="alert" aria-live="assertive">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
        <h1 className="mt-4 text-lg font-black">Não foi possível carregar este módulo</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{refreshRequired ? "Uma atualização acabou de substituir arquivos desta tela. Atualize apenas uma vez para abrir a versão atual." : "A navegação e seus dados continuam seguros. Tente abrir este módulo novamente."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={this.retry} className="gd-button"><RefreshCw className="h-4 w-4" /> Tentar módulo</button>
          {refreshRequired && <button type="button" onClick={this.reloadLatest} className="gd-button">Atualizar versão</button>}
        </div>
      </div>
    </section>;
  }
}
