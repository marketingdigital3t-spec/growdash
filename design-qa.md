# Design QA — Growdash OS / mapa de salas

## Source visual truth

- Reference screenshot: `/Users/thiegojesus/Downloads/Captura de Tela 2026-10-17 à(s) 16.27.04.png`.
- Source pixels: 1179 × 512.
- Intended state: desktop, dark command map with the Growdash brain in the center and ten colored operating rooms around it.

## Rendered implementation

- Target route: `/agentes`.
- Local preview: `http://127.0.0.1:5173/agentes`.
- Attempted implementation capture: `/tmp/growdash-agents-implementation-blocked.png`.
- The local and production browser sessions available during this pass resolved to `/auth`; no authenticated workspace was available to render `/agentes`.

## Comparison evidence

- Full-view comparison: blocked. The source is readable, but the authenticated implementation surface could not be opened.
- Focused region comparison: blocked for the same reason. The implementation screenshot is the authentication screen, not the agent map, so it cannot be treated as evidence of the requested UI.

## Findings

- [P1] Browser evidence unavailable. The route requires an authenticated workspace and the available sessions are signed out. This is a validation blocker, not a visual finding in the changed code.
- Static review confirms the map now declares ten canonical rooms, a central Growdash node, real-agent status fallback, and room-level interaction. This is not a substitute for rendered visual QA.

## Required fidelity surfaces

- Fonts and typography: pending authenticated capture.
- Spacing and layout rhythm: pending authenticated capture at desktop and mobile widths.
- Colors and visual tokens: source and CSS tokens are available; rendered contrast remains pending capture.
- Image quality and asset fidelity: the implementation uses existing icon components and CSS/SVG neural surfaces; no new raster asset was required by the reference.
- Copy and content: the ten room labels and manager roles are present in the source.

## Validation already completed

- TypeScript: passed.
- ESLint: passed.
- Vitest: 99 files / 491 tests passed.
- Vite build: passed; existing large-chunk warning remains.
- `git diff --check`: passed.

## Current pass — funil metálico RD

### Referência

- Fonte: `/var/folders/h9/bngn7l491hl8tzl1w97rfpn80000gn/T/TemporaryItems/NSIRD_screencaptureui_gIBIIh/Captura de Tela 2026-10-20 às 14.01.23.png`
- Implementação: `https://growdash.com.br/analise-de-funis`
- Estado: conta CA02 — DRA RANNIELY SILVA, período Hoje, modo Visual
- Viewport observado: Chrome desktop, 1904 × 953 px

### Comparação

- A referência usa um funil escuro com segmentos metálicos, rails cromados e laterais retas inclinadas.
- A implementação mantém as oito etapas reais do RD, mas cada etapa agora usa um trapézio com `clip-path`, com recuo horizontal de 68 px para a altura de 68 px (aproximação de 45°).
- O fundo, os highlights, a sombra, a base e os rails permanecem escuros/metálicos; os textos, totais, percentuais, tempo médio, valor e tooltips continuam ligados aos dados reais.
- O espaçamento entre os segmentos foi zerado para que as etapas se encostem como uma única silhueta, sem voltar aos cartões arredondados.
- A regra mobile usa recuo de 52 px e remove a largura mínima para manter a geometria sem criar scroll horizontal dentro do card.

### Verificações

- `git diff --check`: aprovado
- `npx tsc --noEmit`: aprovado
- `npm run lint -- --quiet`: aprovado
- `npm run build`: aprovado
- Domínio principal retornou HTML 200 com `assets/app-Bp5Qkvd-.js` e `assets/index-CndQTfo4.css`.
- Screenshot live confirmou laterais diagonais retas, rails cromados e a base do funil; os dados visíveis permaneceram `4 negociações`, `Lead Novo 1`, `Sem contato 1` e `Venda Realizada 2`.

### Histórico de correções

1. Removidos os cartões coloridos e aplicado acabamento escuro metálico.
2. Removidas as bordas arredondadas e adicionada a silhueta trapezoidal com laterais inclinadas.
3. Segmentos encostados e rails reposicionados para reproduzir a referência sem alterar o contrato de dados.

final result: passed
