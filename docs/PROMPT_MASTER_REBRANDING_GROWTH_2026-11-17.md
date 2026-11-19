# Prompt Master — Rebranding e Growth Intelligence da Growdash

> Documento executável. Cada item é um ataque fechado: código, teste, build e
> deploy. Nenhuma pergunta fica em aberto — as decisões já foram tomadas com
> base no estado real do repositório e nos dados do banco.

**Data-base:** 17/11/2026
**Branch:** `audit/growdash-completa-2026-11-16`
**Banco:** `cixnvosxqlacjbpymjha` (produção)
**Domínio de entrega:** `audit-growdash-completa-2026.growdash.pages.dev`

---

## Contexto verificado do repositório

Antes de atacar, o estado real (lido no código, não suposto):

| Item | Estado real verificado |
|---|---|
| Foguete espacial | `src/components/space/SpaceRocket.tsx` — SVG inline 96×96, sem imagem raster, sem chama |
| Foguete da tela de login | `src/assets/rocket-logo-feathered.webp` (736×736) + `src/assets/auth-cosmic-scene.webp` |
| Textura da Terra | `src/assets/growth/earth-8k-300dpi.jpg` (3,7 MB) existe mas **não é usada** — o fundo usa `earth-2k-web.jpg` |
| Meteoros | `.space-phase-meteors` em `src/index.css:2522` — 4 riscos de 90px, opacidade 0→0,8, `grayscale(1)` dentro do `.brand-shell` (`src/index.css:2747`) |
| Transição de fase | `data-phase` em `<html>` + `src/styles/themes.css` com 3 blocos (Terra/Órbita/Galáxia) — troca de token, **sem transição animada** entre fases |
| Comercial | `src/growdash/CommercialPage.tsx:285` — `CrewRanking` vem **primeiro**, `CommercialLeaderboard` depois |
| Painel de performance por vendedor | `src/lib/commercialRanking.ts` já produz `count`, `revenue`, `performance` por vendedor — existe, mas não é o primeiro bloco |
| Análise de funil | `src/pages/FunnelAnalysis.tsx` (1070 linhas) — abas `media`, `distribution`, `conversion`, `bottlenecks`, `losses`, `weekdays`, `attribution` |
| Leads Meta no funil | `useMetaTrafficMetrics` existe; a aba `media` compara Meta × RD |
| Leads por venda | **Não existe** em nenhum lugar do código |
| Financeiro | `src/growdash/FinancePage.tsx:325` tem `weeklyInvestment` (16 semanas, gasto real com imposto Meta de 12,15%) e `monthlyHistory` — **não compara com meta** |
| Tráfego pago | `src/growdash/TrafficPage.tsx` (478 linhas) + `src/pages/Campaigns.tsx` |
| Radar de anomalias | Dados **fixos e inventados** — corrigido no lote anterior (`src/lib/missionAnomalies.ts`) |
| KPIs do funil orbital | 4 colunas quebravam para 2 linhas — corrigido no lote anterior |

---

## BLOCO A — Identidade visual (rebranding)

### A1. Foguete 8K 300 DPI com chama de combustão

**Decisão:** o foguete espacial deixa de ser SVG e passa a ser raster
ultra-realista renderizado a partir de `earth-8k-300dpi.jpg`? Não — a Terra é
outro corpo. O foguete 8K é uma **nova arte** e, sem origem licenciada
pronta no repositório, a solução honesta é **renderizar o foguete em alta
resolução em SVG com muito mais detalhe** (o SVG escala para 8K sem perda) e
**com a chama de combustão animada**.

- `SpaceRocket.tsx`: redesenhar o SVG com casco em gradiente multicamada,
  IRC, aletas, vidro com reflexo, rebites, painel de bordo e **chama de
  combustão em 3 camadas** (núcleo branco-ciano, corpo azul, fumaça quente)
  com animação de pulso e partículas.
- Animação da chama: `prefers-reduced-motion` respeitada (o contrato
  `src/pages/A11yReducedMotionContract.test.ts` já exige isso).
- Viewbox ampliado para 512×512 com `preserveAspectRatio` — o navegador
  rasteriza na densidade de tela, então continua nítido em 8K.

**Por que não uma foto 8K:** não existe asset 8K de foguete no repositório e
não posso gerar/licenciar uma imagem fotorrealista sem origem. Um SVG
ultra-detalhado é a alternativa que entrega o mesmo resultado perceptual sem
inventar arquivo que não existe. **O `earth-8k-300dpi.jpg` (3,7 MB) entra
nesta onda como a textura do planeta Terra** — ele já existe no repositório e
está sendo desperdiçado.

### A2. Textura 8K da Terra em uso real

- `SpacePhaseBackground.tsx`: trocar `earth-2k-web.jpg` por `earth-8k-300dpi.jpg`
  **com carregamento progressivo**: a textura 8K entra como `background-image`
  de baixa prioridade e a 2K como `background` de fallback.
- O bundle não pode crescer 3,1 MB. Estratégia: a 8K é servida por URL
  separada (não importada no bundle JS), o Vite a vira asset e o CSS a
  referencia por caminho — o browser baixa só quando o elemento aparece.
- **Fallback obrigatório:** sem WebP/AVIF e sem a 8K, a textura 2K sustenta o
  visual.

### A3. Meteoros de verdade

Hoje: 4 riscos de 90px com `grayscale(1)` dentro do `.brand-shell` — é
literalmente um risco cinza, não um meteoro.

**Decisão:** substituir por meteoros reais com cauda, brilho de cabeça e
rastro que desaparece:
- Cada meteoro é um elemento com **três camadas**: cabeça (radial-gradient
  branco-ciano com `filter: blur`), cauda (linear-gradient transparente →
  cor da fase → transparente, com `transform: rotate`) e um segundo rastro
  fino de 1px.
- **Remover o `grayscale(1)`** — o meteoro tem a cor da fase.
- Mais meteoros em Terra (6), Órbita (10) e Galáxia (14).
- Cada um com `animation-delay` e duração próprios para não sincronizar.
- `prefers-reduced-motion: reduce` → ocultos (regra já existe).

### A4. Transição de fase Terra → Órbita → Galáxia

Hoje a fase muda por token instantâneo. **Decisão:** transição real de 1,4s
em três eixos:
1. **Fundo:** cross-fade entre nebulosas (a nebula da fase entra com
   `opacity` e `filter: blur(18px)` → `blur(0)`).
2. **Paleta:** as variáveis CSS de cor fazem interpolação. CSS não interpola
   `hsl()` custom properties sem `@property` — registrar `--primary`,
   `--accent`, `--palette-accent` com `@property` e `syntax: "<color>"` para
   que a troca anime.
3. **Elementos:** a Terra/planeta dá lugar a um anel de órbita (escala +
   rotação) e depois a uma galáxia (expansão radial). O foguete ganha
   velocidade: a trilha de chama estica durante a transição.

### A5. Liquid glass unificado

Hoje o glass está espalhado em várias regras (`gd-glass-card`, `.gd-panel`,
`backdrop-filter` em meia dúzia de lugares). **Decisão:** um único conjunto
de utilitários:
- `gd-glass` — base (blur, saturate, borda de 1px com gradiente, sombra
  interna, highlight superior).
- `gd-glass-strong` — para painéis de foco.
- `gd-glass-subtle` — para blocos internos.
- Barreira de specularidade: `::before` com gradiente linear a 120° que
  simula o reflexo da luz na borda superior.

---

## BLOCO B — Tráfego pago (bugado, quebrado)

### B1. Diagnóstico antes de mexer

Antes de mudar layout: rodar a rota `/campanhas` autenticada, listar **todo**
elemento com `overflow`, `z-index` ou `position` que vaza do container, e
conferir o console. O problema reportado ("tudo bugado, quebrado o visual,
codigo, layout") costuma ser: (a) `overflow-x` não habilitado no shell, (b)
tabelas com `min-width` maior que o container, (c) `z-index` de sticky
conflitando com overlay, (d) cards com altura fixa herdada.

### B2. Correções estruturais

- O shell de tráfego passa a ter `min-w-0` em todos os wrappers flex (a causa
  clássica de "quebrado" em grid/flex com tabela).
- Tabelas: wrapper com `overflow-x-auto` e `min-width` declarado na tabela,
  nunca no pai.
- Colunas fixas (`sticky`) com `z-index` abaixo do header do shell e
  `background` opaco (o `bg-card/85` deixa a coluna vaza o conteúdo que
  passa por baixo).
- Altura: remover `h-[...]` fixo dos cards e deixar o grid fluir.

---

## BLOCO C — Comercial: performance primeiro

### C1. Ordem dos blocos

**Decisão:** inverter. `CommercialLeaderboard` (painel de performance) vira o
primeiro bloco da página; `CrewRanking` (rank da tripulação) desce para
**depois** do painel — o usuário foi explícito: "o rank da tripulação precisa
estar la em baixo, a primeira coisa que precisa mostrar é painel de
performance".

### C2. Painel de performance por vendedor

Cada vendedor precisa de:
- **Quantidade de vendas** no período (já existe: `seller.count`).
- **Meta** do vendedor no mês (hoje derivada de forma grosseira: `revenue /
  performance`).
- **% para bater a meta** (já existe: `seller.performance`).
- **Quantas vendas ainda faltam** para bater a meta, calculada a partir do
  **valor do produto**: `faltam = ceil((meta - realizado) / ticketMédio)`.

O ticket médio por vendedor precisa ser real: `revenue / count` quando
`count > 0`. Sem isso, "quantas vendas faltam" não tem base.

**Fonte da meta:** `sales_goals` já é consultado pela página
(`useSalesGoals`). A meta por vendedor precisa ser lida dessa tabela
corretamente — quando não houver meta cadastrada para o vendedor, o painel
mostra "sem meta" em vez de inventar um número.

---

## BLOCO D — Análise de funil: leads Meta + RD e leads por venda

### D1. Um bloco único de leads

**Decisão:** juntar Meta e RD em **um só bloco**. Hoje a aba `media`
compara os dois em colunas separadas, o que obriga o usuário a somar de
cabeça. O novo bloco:
- **Total de leads** = leads Meta + leads RD (com a ressalva explícita de
  que um mesmo lead pode existir nas duas fontes — o bloco mostra o total
  combinado e, em tooltip, a composição de cada fonte).
- Um segundo bloco: **quantos leads são necessários para 1 venda**.

### D2. Leads por venda (a informação que não existe)

O exemplo do usuário: Dra. Ranniely Aluna — **112 leads, 8 vendas → 14
leads por venda**.

Cálculo: `leadsPorVenda = leadsTotais / vendasRealizadas` no mesmo recorte
(funil, período e escopo) — misturar escopos produz número falso.
- Guarda contra divisão por zero.
- Arredondamento para 1 casa decimal e exibição como "1 venda a cada 14
  leads".
- Quando o denominador é 0, mostrar "—" em vez de "∞".

### D3. Rastreamento do formulário nativo

O rastreamento do formulário nativo (lead da Meta) não chega completo à
Growdash. Já existe a migration `20261118090000_meta_form_answers_to_rd_deal.sql`
com as funções `extract_meta_form_answer` e `copy_meta_form_answers_to_rd_deal`.
**Verificar em produção se o sync está populando `meta_leads`** e se o
trigger dispara. Se o gap for de escopo (só algumas contas), o painel de
análise de funil precisa mostrar a **cobertura do rastreamento** — quantos
leads do período vieram com `meta_lead_id` preenchido — para que o usuário
saiba se o ratio é confiável.

---

## BLOCO E — Financeiro: investimento semanal vs meta

### E1. Bloco "Investimento em tráfego por semana"

Hoje existe `weeklyInvestment` (gasto real, 16 semanas) e um gráfico de
barras. **Falta a comparação com a meta.** Novo bloco:
- Para cada semana: **investido**, **meta da semana**, **% da meta** e
  **diferença** (acima/abaixo).
- A meta semanal deriva de:
  - `sales_goals` do período, quando houver meta de mídia cadastrada;
  - **ou** do orçamento de investimento do período dividido pelas semanas.
- O imposto Meta de **12,15%** precisa ficar explícito na linha (o dado
  bruto permanece intacto, como já diz o texto atual).
- A diferença entre "quanto foi colocado" (aporte/saldo added) e "quanto foi
  investido" (spend) precisa aparecer: **posto vs investido** por semana.

### E2. "Quanto foi colocado"

`fundingTransactions` já existe no módulo. Cruzar com o spend semanal:
- **Colocado:** soma dos aportes confirmados na semana.
- **Investido:** gasto real da semana (com e sem imposto).
- **Saldo:** diferença.

---

## BLOCO F — Prompt master (artefato)

Este documento é o prompt master. Cada bloco é executado em ordem, com
teste, build e deploy.

---

## Ordem de execução

1. **A2** (textura 8K em uso) — ganho de identidade, baixo risco
2. **A3** (meteoros) — ganho visual, baixo risco
3. **A1** (foguete + chama) — identidade central
4. **A4** (transição de fase) — depende de A1 e A3
5. **A5** (liquid glass unificado)
6. **D1 + D2** (análise de funil: leads Meta+RD + leads por venda) — é o
   pedido de *dado de growth*, o mais valuable
7. **C1 + C2** (comercial: performance primeiro, painel por vendedor)
8. **E1 + E2** (financeiro: semana vs meta, posto vs investido)
9. **B1 + B2** (tráfego pago) — diagnóstico primeiro, porque é o mais
   incerto

Cada passo: teste → suíte completa → build → commit → push → deploy →
verificação no navegador.

---

## Critérios de aceite (verificáveis)

| # | Critério | Como se prova |
|---|---|---|
| 1 | Meteoros têm cauda e cor da fase, não são riscos cinza | Screenshot + teste de contrato que proíbe `grayscale(1)` em `.space-phase-meteors` |
| 2 | Foguete tem chama de combustão visível e animada | Teste de contrato exige o grupo da chama no SVG |
| 3 | Transição de fase é animada, não um corte | Teste exige `@property` com `syntax: "<color>"` nas cores de fase |
| 4 | Leads Meta e RD aparecem no mesmo bloco | Teste de contrato do `FunnelAnalysis` |
| 5 | Leads por venda calculado e exibido | Teste unitário do cálculo + verificação no browser |
| 6 | Painel de performance é o primeiro bloco do Comercial | Teste de contrato: índice do painel < índice do `CrewRanking` |
| 7 | Cada vendedor mostra vendas, meta, % e quantas faltam | Teste unitário do cálculo |
| 8 | Financeiro mostra investido vs meta por semana | Teste de contrato da `FinancePage` |
| 9 | Tráfego pago sem overflow horizontal | Verificação no browser a 1440px e 1920px |
| 10 | Nada quebra: suíte completa verde | `vitest run` + `tsc --noEmit` + `npm run build` |
