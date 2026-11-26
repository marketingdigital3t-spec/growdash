import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionExpiredBannerProps {
  onRetry: () => void;
}

export function SessionExpiredBanner({ onRetry }: SessionExpiredBannerProps) {
  const navigate = useNavigate();

  return (
    <section
      className="grid min-h-[44vh] place-items-center px-4 text-center"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-sm rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <span className="font-bold text-destructive">Sessão expirada</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua sessão da Growdash expirou. Entre novamente para continuar acessando tráfego, leads e funil.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              onRetry();
              navigate("/auth", { replace: true });
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <LogIn className="h-4 w-4 mr-2" aria-hidden="true" />Entrar novamente
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold transition hover:bg-muted"
          >
            Tentar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
