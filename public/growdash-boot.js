// Keep a broken/blocked entry module from leaving the app on a permanent
// loading screen. React marks the boot only after it commits a visible shell,
// not merely when the entry module begins evaluating.
window.setTimeout(function () {
  var root = document.getElementById("root");
  if (!root) return;
  if (window.__GROWDASH_BOOTED__ || root.dataset.growdashBooted === "true") return;
  root.innerHTML = '<div style="display:grid;min-height:100vh;place-items:center;background:#0B0D10;color:#F5F7FA;font:600 15px Inter,system-ui,sans-serif;text-align:center;padding:24px"><div style="max-width:420px;border:1px solid #2A313B;border-radius:14px;background:#12161C;padding:28px;box-shadow:0 24px 70px #000"><p style="font-weight:800">A Growdash demorou mais do que o esperado.</p><p style="opacity:.72;margin-top:8px;line-height:1.5">A recarga automática foi bloqueada para evitar loops. Confirme manualmente o carregamento da versão mais recente.</p><button type="button" onclick="location.reload()" style="margin-top:18px;border:1px solid #D5A84A;border-radius:10px;background:#D5A84A;color:#151A21;padding:10px 16px;font-weight:800;cursor:pointer">Tentar novamente</button></div></div>';
}, 15000);
