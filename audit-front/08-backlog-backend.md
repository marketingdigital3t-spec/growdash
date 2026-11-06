# Backlog de Achados de Backend — 08-backlog-backend.md

Conforme o Briefing Mestre (Seção 0):
*"Backend, banco, autenticação, integrações, IA, MCP e RAG NÃO fazem parte deste documento e serão tratados em sessão separada. Se você encontrar problema de backend, registre em /audit-front/08-backlog-backend.md com ID e evidência, sem corrigir."*

---

## Lista de Achados Registrados Durante o Reconhecimento

### ID: GRO-BK-001
- **Título:** Plugin MCP do GitHub desconectado no ambiente local por formato de cabeçalho de autorização
- **Evidência:** `plugin:github:github (400): "Error POSTing to endpoint: bad request: Authorization header is badly formatted"` reportado no status de inicialização do harness.
- **Impacto no Backend/CI:** Não afeta a aplicação em runtime do usuário final, mas impede automações de issue/PR via MCP local.
- **Ação futura sugerida:** Revalidar o Personal Access Token ou configuração OAuth da integração GitHub no MCP.

### ID: GRO-BK-002
- **Título:** Múltiplas integrações declaradas como indisponíveis por ausência de autorização OAuth local
- **Evidência:** Servidores MCP `cloudflare`, `figma`, `hubspot`, `supabase` exigem fluxo de autenticação via `/mcp`.
- **Impacto no Backend/CI:** As ferramentas auxiliares externas estão inativas nesta sessão de desenvolvimento.
- **Ação futura sugerida:** Autenticar os conectores via CLI `/mcp` quando o escopo de backend/integrações for iniciado.

### ID: GRO-BK-003
- **Título:** Rota pública de reset de senha e tokens de lead report sem rate limiting no cliente
- **Evidência:** `src/pages/ResetPassword.tsx` e `src/pages/SharedLeadReport.tsx` consom diretamente `supabase.auth` sem debounce defensivo contra força bruta no client.
- **Impacto no Backend/CI:** Potencial saturação de chamadas ao Auth do Supabase em caso de script malicioso.
- **Ação futura sugerida:** Configurar rate-limit nativo no Supabase e Edge Functions para endpoints sensíveis.
