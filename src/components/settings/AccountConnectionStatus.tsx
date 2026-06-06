import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Status = "connected" | "disconnected" | "unknown" | string | null | undefined;

interface Props {
  status: Status;
  errorMessage?: string | null;
  errorCode?: number | null;
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  onReconnect?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

function instructions(code: number | null | undefined, message?: string | null): string {
  if (code === 190 || /OAuthException|expired|token/i.test(message || "")) {
    return "Token expirado ou revogado. Gere um novo System User Token no Gerenciador de Negócios (Configurações do Negócio → Usuários do Sistema → seu usuário → Gerar Token) com as permissões ads_read, ads_management e business_management e cole no campo Token abaixo.";
  }
  if (code === 100 || /permission|not.*allowed|cannot.*access/i.test(message || "")) {
    return "O usuário do sistema perdeu acesso a essa conta de anúncios. No Gerenciador de Negócios, vá em Contas de Anúncios → selecione a conta → Atribuir Usuários do Sistema e adicione novamente com permissão total.";
  }
  if (code === 200) {
    return "Permissão insuficiente. Confirme que o System User tem ads_read e ads_management e que a conta está vinculada ao mesmo BM do token.";
  }
  return "Verifique se o token ainda é válido e se a conta continua vinculada ao mesmo Gerenciador de Negócios. Se persistir, gere um novo System User Token.";
}

export function AccountConnectionStatus({
  status,
  errorMessage,
  errorCode,
  lastAttemptAt,
  lastSuccessAt,
  onReconnect,
  onRetry,
  retrying,
}: Props) {
  const isConnected = status === "connected";
  const isDisconnected = status === "disconnected";
  const lastSuccess = fmtDate(lastSuccessAt);
  const lastAttempt = fmtDate(lastAttemptAt);

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isConnected && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        isDisconnected && "bg-destructive/15 text-destructive",
        !isConnected && !isDisconnected && "bg-muted text-muted-foreground"
      )}
    >
      {isConnected && <CheckCircle2 className="h-3 w-3" />}
      {isDisconnected && <AlertTriangle className="h-3 w-3" />}
      {!isConnected && !isDisconnected && <HelpCircle className="h-3 w-3" />}
      {isConnected ? "Conectada" : isDisconnected ? "Desconectada" : "Nunca sincronizada"}
    </span>
  );

  if (!isDisconnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {badge}
        {lastSuccess && <span>Última sync: {lastSuccess}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {badge}
        {lastSuccess ? (
          <span>Última sync OK: {lastSuccess}</span>
        ) : (
          <span>Nunca sincronizou com sucesso</span>
        )}
      </div>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Conta desconectada da Meta
            </p>
            {errorMessage && (
              <p className="text-xs text-destructive/90 break-words">
                <span className="font-medium">Erro Meta{errorCode ? ` (cód. ${errorCode})` : ""}:</span> {errorMessage}
              </p>
            )}
            <p className="text-xs text-foreground/80">
              {instructions(errorCode, errorMessage)}
            </p>
            {lastAttempt && (
              <p className="text-[11px] text-muted-foreground">
                Última tentativa: {lastAttempt}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {onReconnect && (
            <Button size="sm" variant="default" onClick={onReconnect}>
              Atualizar Token
            </Button>
          )}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
              <RefreshCw className={cn("h-3 w-3 mr-1", retrying && "animate-spin")} />
              Tentar sincronizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
