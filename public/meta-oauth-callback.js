(() => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") === "success" ? "success" : "error";
  const message = params.get("message") || (status === "success" ? "As contas de anúncio foram importadas." : "Não foi possível concluir a conexão.");
  const accounts = Number(params.get("accounts") || 0);
  const title = document.getElementById("title");
  const text = document.getElementById("message");
  const close = document.getElementById("close");
  const back = document.getElementById("back");
  if (title) {
    title.className = status;
    title.textContent = status === "success" ? "Meta Ads conectado" : "Não foi possível conectar";
  }
  if (text) text.textContent = message;
  try {
    if (window.opener && !window.opener.closed) {
      ["https://growdash.com.br", "https://www.growdash.com.br"].forEach((origin) => {
        window.opener.postMessage({ type: "growdash-meta-oauth", status, message, accounts }, origin);
      });
    } else {
      if (close) close.style.display = "none";
      if (back) back.style.display = "inline-block";
    }
  } catch (_) { /* the visible page remains usable if the opener is gone */ }
  if (status === "success" && window.opener && !window.opener.closed) window.setTimeout(() => window.close(), 1800);
})();
