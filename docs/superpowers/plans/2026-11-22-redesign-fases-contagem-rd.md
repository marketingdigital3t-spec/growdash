# Redesign das Fases e Contagem RD — Plano de Implementação

**Data:** 2026-11-22
**Status:** Em execução
**Decisão:** Implementar redesign das 3 fases (terra/orbita/galáxia) e corrigir contagem de negociações RD

## Contexto Técnico

- Projeto: Growdash (Next.js/React, TypeScript, Vite, Supabase)
- Branch atual: `fix/render-error-useworkspace`
- Problemas identificados:
  1. Modo órbita tem dourado sem saturação/vibração
  2. Modo terra tem muitos elementos azuis misturados
  3. Vendas realizadas contadas por data de criação em vez de fechamento (diferença com RD Station)
  4. Regras de RLS em insight_actions fazem scan sem filtro de conta (query mais cara do sistema)

## Regras Obrigatórias (AGENTS.md)

1. Código local: verificar árvore Git, diff, arquivos relacionados e testes locais antes de alterar
2. GitHub/remoto: consultar branch atual, `git fetch` e divergência com `origin/main`
3. Cloudflare Pages: conferir deployment de produção ativo antes de afirmar que está publicado
4. Navegador: somente depois das três verificações anteriores, abrir a rota autenticada e testar

## Plano de Execução

### Task 1: Analisar cores atuais e documentar problemas ✅ COMPLETO

Arquivos verificados:
- `src/index.css` (linhas 2503-2688) — variáveis CSS de --phase-color, --phase-glow, .brand-shell por fase
- `src/components/space/SpacePhaseBackground.tsx` — renderização visual das fases
- `src/hooks/useAccentTheme.ts` — cores de tema por fase

Problemas identificados:
- Terra: azul intenso (#00a8ff), mas elementos visuais misturam cores
- Órbita: dourado (#ffc107) sem saturação/vibração suficiente
- Galaxia: púrpura/neon (#a855f7), precisa de mais contraste

### Task 2: Redesenhar cores dos 3 modos (EM ANDAMENTO)

Arquivos a modificar:
- Create: `src/lib/phase/phaseColors.ts` ✅ CRIADO
- Modify: `src/index.css` (variáveis CSS por fase) — PARCIALMENTE FEITO (terra)
- Modify: `src/components/space/SpacePhaseBackground.tsx` (cores de planeta, anéis, estrelas, névoa)
- Modify: `src/hooks/useAccentTheme.ts` (cores de tema por fase) — PARCIALMENTE FEITO

### Task 3: Corrigir contagem de vendas realizadas (data de fechamento vs criação)

Arquivos a verificar/modificar:
- Modify: `src/lib/canonicalMetrics.ts` (isCanonicalWonDealInPeriod)
- Modify: `src/lib/rdDealStatus.ts` (isWonRDStageName — verificar)
- Read: `src/components/crm/CRMAdvancedFiltersSheet.tsx` (filtros de data)

### Task 4: Verificar mapeamento de status do RD

Arquivos a verificar:
- Read: `src/lib/rdDealStatus.ts` (isWonRDStageName)
- Read: `src/hooks/useRDDeals.ts` (filtros de status)

### Task 5: Testar e validar

Arquivos:
- Test: `npm test` (suíte completa)
- Test: `npm run build` (build de produção)
- Verify: navegador na rota autenticada

## Critérios de Aceitação

- [ ] Modo terra: azul intenso e prateado, sem elementos azuis misturados excessivamente
- [ ] Modo órbita: dourado solar vibrante e saturado
- [ ] Modo galáxia: púrpura/neon com contraste adequado
- [ ] Vendas realizadas contadas por data de fechamento (closed_at)
- [ ] Outras etapas contadas por data de criação (lead_created_at)
- [ ] Contagem de negociações bate 100% com RD Station
- [ ] Suíte de testes: 100% passando
- [ ] Build de produção: aprovado
- [ ] Navegador: rota autenticada testada e funcionando

## Fora de Escopo

- Alterar schema do banco de dados
- Criar novas funcionalidades de negócio
- Alterar autenticação ou permissões
