const UPSTREAM_API = "https://vps70762.publiccloud.com.br/janaina-api";

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  const incomingUrl = new URL(request.url);
  const suffix = incomingUrl.pathname.replace(/^\/agente-sdr-api/, "") || "/";
  const upstreamUrl = new URL(`${UPSTREAM_API}${suffix}`);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
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
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.set("cache-control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
