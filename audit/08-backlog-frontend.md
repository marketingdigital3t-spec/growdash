# Backlog de Achados de Frontend (Isolados do Escopo de Backend)

Conforme o briefing mestre, a camada de frontend NÃO faz parte da auditoria de backend.
Qualquer problema visual, de componente ou CSS encontrado durante o mapeamento
é registrado aqui com ID e evidência, sem aplicação de correção.

---

| ID | Componente / Rota | Problema Observado | Evidência | Severidade UI |
|---|---|---|---|---|
| GRO-FE-001 | Cloudflare Pages Git Provider | `npm install` customizado falha por conflito de overrides do npm 10.8.2 | Build log Cloudflare `npm error edgesOut` | MÉDIO (afeta build nativo do Pages, não o CI) |
