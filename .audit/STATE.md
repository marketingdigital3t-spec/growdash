# STATE — Auditoria Growdash

```yaml
ciclo: 1
timestamp_iso: "2026-11-21T09:55:00-03:00"
branch: "audit/ciclo-1"
pr: "https://github.com/marketingdigital3t-spec/growdash/pull/3"
gate_anterior: "blocked (1 finding: npm run lint exit 1)"
gate_atual: "APROVADO localmente (detect: 0 findings)"
proximo_ciclo_iso: "2026-11-21T10:20:00-03:00"
prazo_iso: "2026-11-21T11:00:00-03:00"
achados: { P0: 1, P1: 3, P2: 5, P3: 2 }
achados_abertos: 9
achados_corrigidos: 3
achados_bloqueados: 0
```

## Achado raiz do ciclo 1 (P0-00 corrigido)

`.next/` (artefato de build do Next.js 16.4.6 que falhou) foi versionado em `ef944b9` e nunca removido. O ESLint varr `.next/types/*.ts` porque o flat config só ignorava `dist`, produzindo 71 erros falsos. `npm run lint` retornava exit 1, o step `detect` do loop-engineering terminava em `blocked`, e todo run agendado falhava ("All jobs have failed"). Correção: `.next/` removido (32 arquivos) e adicionado ao `.gitignore`. Loop local: `blocked` → `detected` (0 findings).

## Pendências

- P1-01: `fetch` a provedor externo sem timeout em 13 Edge Functions restantes (Graph API, OpenAI, HubSpot, WhatsApp) — `rd-list-funnels` já corrigido.
- P1-02: comparação de segredo com `===` em `rd-resync-cron` (timing attack).
- P1-03: `generate-intelligence-snapshot` chama OpenAI sem timeout e sem `stream: false` explícito.
- P2-02: `rd-discover-fields` faz fetch sem timeout ao RD em loop de até 10 páginas.
- P2-03: `rd-enrich-states` faz fetch sem timeout ao RD.
- P2-04: `traffic-agent-analyze` / `traffic-agent-execute-approved` chamam Graph API sem timeout.
- P2-05: `meta-manage-entity` faz 4 chamadas Graph API sem timeout.
- P3-01: `rd-reconcile-metrics`/`rd-resync-cron` comparam segredo com `===` (constante de tempo).
- P3-02: `.env.example` não bate com o formato real da publishable key (`sb_publishable_`).

## Itens bloqueados

- Nenhum até o momento.

## Decisões (ver DECISIONS.md)

- D-01, D-02, D-03, D-04.

## Commits do ciclo

- `08a0675` fix(auth): impede que placeholder do .env quebre o login em produção [P0-00]
- `f76c70d` fix(trafego): alinha o trilho de áreas e adota a cor da fase ativa [P2-06]
- `b521f12` fix(ci): destrava o loop-engineering que falhava em todo run [P0-00]
- `88cbb79` chore(repo): remove artefatos de build do Next.js versionados por engano [P0-00]
- `e93da7d` chore(audit): permissões, guia de níveis e primeira leva de correções
- `e4cc6d5` chore(repo): remove cópias scratch versionadas

## Gate do ciclo 1

```
npm run lint                     →  0 errors, 28 warnings
npx tsc --noEmit                 →  0 errors
npx vitest run                   →  1163 passed (239 files)
npm run build                    →  built in 12.39s
npm run loop-engineering:detect  →  status: "detected", findings: 0
```

**gate: APROVADO** (local). Pendente para gate completo: merge do PR #3 na `main`
(dispara o workflow `loop-engineering` em `main`) e verificação em `www.growdash.com.br`.

## Verificação em produção (realizada neste ciclo)

- `www.growdash.com.br/auth` — login funciona; sessão autenticada confirmada no navegador (dashboard carregando dados reais).
- Trilho de áreas vs. sidebar esquerda: ambos `top: 0 → 869`; primeiros ícones ambos em `top: 88` (medição via DOM, não screenshot).
- Cor por fase: `--brand-gold` = `#00a8ff` (Terra) / `#ffc107` (Órbita) / `#a855f7` (Galáxia); verde de identidade eliminado.
