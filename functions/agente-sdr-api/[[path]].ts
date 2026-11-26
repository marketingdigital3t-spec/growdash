const UPSTREAM_API = "https://vps70762.publiccloud.com.br/janaina-api";

// O proxy só encaminha o que o painel de atendimento usa de fato. Sem allowlist
// ele vira relay aberto para o VPS: qualquer caminho, inclusive traversal, e
// qualquer header do cliente (incluindo Authorization) chegaria lá.
const ALLOWED_PREFIXES = [
  "/auth",
  "/login",
  "/logout",
  "/me",
  "/tickets",
  "/contacts",
  "/users",
  "/queues",
  "/quickAnswers",
  "/settings",
  "/connections",
  "/whatsapp",
  "/messages",
  "/files",
  "/media",
  "/notifications",
];

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  const incomingUrl = new URL(request.url);
  const suffix = incomingUrl.pathname.replace(/^\/agente-sdr-api/, "") || "/";

  // Resolve o caminho e confere que ele continua dentro do prefixo da API,
  // para que "/agente-sdr-api/../outra-coisa" não altere o destino.
  const resolvedPath = new URL(suffix, "https://internal.invalid").pathname;
  const isAllowed = resolvedPath === "/" ||
    ALLOWED_PREFIXES.some((prefix) => resolvedPath === prefix || resolvedPath.startsWith(`${prefix}/`));
  if (resolvedPath.includes("..") || !isAllowed) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstreamUrl = new URL(`${UPSTREAM_API}${resolvedPath}`);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");

  // Authorization do cliente só é encaminhado em rotas de auth declaradas (/auth, /login, /me, /logout).
  const isAuthRoute = resolvedPath === "/auth" || resolvedPath.startsWith("/auth/") ||
    resolvedPath === "/login" || resolvedPath.startsWith("/login/") ||
    resolvedPath === "/me" || resolvedPath.startsWith("/me/") ||
    resolvedPath === "/logout" || resolvedPath.startsWith("/logout/");
  if (!isAuthRoute) {
    headers.delete("authorization");
  }

  headers.set("origin", "https://vps70762.publiccloud.com.br");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const response = await fetch(new Request(upstreamUrl, init));
  const responseHeaders = new Headers(response.headers);
  // Preserva o CORS do upstream; define apenas controle de cache.
  responseHeaders.set("cache-control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
