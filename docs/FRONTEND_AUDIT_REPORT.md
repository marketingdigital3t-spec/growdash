# Growdash — auditoria de front-end

Data da execução: 2026-10-22 (America/Sao_Paulo)

## Escopo e evidências

- Commit auditado: `5a01235`.
- Rotas foram conferidas em `src/App.tsx` e `src/growdash/navigation.ts`.
- `npm test`: 121 arquivos e 566 testes aprovados.
- `npm run test:visual`: 6 testes aprovados e 54 testes autenticados ignorados por ausência de estado de sessão no runner.
- `npm run lint`: 0 erros e 20 avisos preexistentes de Fast Refresh.
- `npx tsc --noEmit` e `npm run build`: aprovados anteriormente para o commit auditado.
- Produção: `https://growdash.com.br` respondeu HTTP 200; rotas críticas carregaram em aba nova sem erros de console.

## Rotas inventariadas

Públicas: `/auth`, `/reset-password`, `/termos`, `/privacidade`, `/cookies`, `/dpa`, `/sla`, `/cancelamento`, `/relatorios/:shareToken`, `/nota-fiscal/:token`, `/diagnostico-marca/:token`, `/questionario-expert/:token`.

Autenticadas e módulos: `/`, `/painel-expert`, `/crm`, `/comercial`, `/campanhas`, `/inteligencia`, `/analise-de-funis`, `/alertas`, `/agenda-turmas`, `/leads-incompletos`, `/automacoes`, `/growdash-flow`, `/estrategia`, `/saude-dos-dados`, `/produtos`, `/configuracoes`, `/usuarios`, `/financeiro`, `/armazenamento`, `/integracoes`, `/perfil`, `/midia-social`, `/kanban`, `/chamados`, `/anuncios`, `/marcas`, `/marcas/:brandId`, `/agentes`, `/gestor-trafego`, `/whatsapp`, `/quadro`, `/neural-core`, `/life-sim`.

Redirecionamentos e aliases também foram localizados no `App.tsx`; não foram tratados como telas independentes.

## Achados reproduzíveis

| ID | Severidade | Rota | Tema | Breakpoint | Tipo | Descrição | Reprodução | Evidência | Correção | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AUD-001 | baixo | global | ambos | todos | qualidade de código | Existem 20 avisos ESLint `react-refresh/only-export-components`; eles não quebram o build, mas dificultam a manutenção do HMR. | Executar `npm run lint`. | Saída do ESLint, arquivos em `src/components`, `src/contexts`. | Separar exports de componentes e helpers em arquivos próprios, sem mudar API pública. | pendente de lote de manutenção |
| AUD-002 | alto de cobertura | rotas autenticadas | ambos | mobile/tablet/desktop | teste | 54 testes de rotas autenticadas são pulados no Playwright porque o runner não possui sessão persistida. Isso impede afirmar cobertura automatizada completa dessas telas. | Executar `npm run test:visual` sem `PLAYWRIGHT_STORAGE_STATE`. | Resultado: 6 passed, 54 skipped. | Configurar estado de sessão de teste seguro e dados não produtivos; não colocar tokens no repositório. | bloqueado por sessão |
| AUD-003 | alto de cobertura | backend/Supabase | N/A | N/A | infraestrutura | `supabase migration list` não concluiu por timeout ao criar a login role. | Executar `npx supabase migration list`. | `DbConfigLoginRoleStatusError` / connection timeout. | Repetir em janela de disponibilidade do projeto ou via MCP autenticado; não alterar schema por tentativa. | bloqueado por serviço externo |

## Verificações sem falha reproduzida

- Não foi reproduzido erro de realtime na rota WhatsApp após a correção do commit `5a01235`.
- As rotas críticas testadas em produção abriram sem tela de erro e sem erros de console na aba nova.
- Não foi observado overflow nas verificações visuais públicas disponíveis.

## Limitações

Não foi possível validar operações que exigem credenciais reais da Meta, RD Station, Google ou WhatsApp, nem afirmar paridade completa de dados sem executar uma sessão autenticada controlada. Essas limitações não foram convertidas em “bugs” sem reprodução.
