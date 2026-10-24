export const AUTH_SESSION_TIMEOUT_MS = 12_000;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

export function authSessionErrorMessage(error: unknown) {
  const message = errorText(error);
  if (/failed to fetch|network|timeout|timed out|tempo de carregamento|temporar|upstream|HTTP\s*5\d\d/i.test(message)) {
    return "O serviço de autenticação está temporariamente indisponível. Tente novamente em alguns instantes; sua sessão não foi removida.";
  }
  return "Não foi possível validar sua sessão. Tente novamente sem recarregar a página.";
}
