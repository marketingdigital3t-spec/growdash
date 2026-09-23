(() => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") === "success" ? "success" : "error";
  const message = params.get("message") || (status === "success" ? "As contas de anúncio foram importadas." : "Não foi possível concluir a conexão.");
  const accounts = Number(params.get("accounts") || 0);
  const title = document.getElementById("title");
  const text = document.getElementById("message");
  if (title) {
    title.className = status;
    title.textContent = status === "success" ? "Meta Ads conectado" : "Não foi possível conectar";
  }
  if (text) text.textContent = message;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "growdash-meta-oauth", status, message, accounts }, "https://growdash.com.br");
    }
  } catch (_) { /* the visible page remains usable if the opener is gone */ }
  if (status === "success") window.setTimeout(() => window.close(), 1800);
})();
