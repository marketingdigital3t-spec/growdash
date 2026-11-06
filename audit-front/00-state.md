# Estado do Frontend Growdash — 00-state.md

Data da auditoria: 2026-11-05
Auditor: Engenheiro Principal de Frontend & Design System
Escopo: Frontend, Design System, Temas Esmeralda & Obsidian e Percepção Visual

---

## 1. Stack Tecnológica e Runtime

- **Framework:** React 18.3.1 (SPA client-side via React Router DOM v7.18.2).
- **Bundler & Tooling:** Vite v8.2.1, TypeScript 5.8.3, PostCSS 8.5.26, Autoprefixer 10.4.21.
- **Estratégia de Estilo:** Tailwind CSS 3.4.17 + CSS Variables nativas (`hsl(...)` e hexadecimais), plugin `tailwindcss-animate`, folhas `src/index.css` (15.706 linhas) e `src/styles/tokens.css` (98 linhas).
- **Gerenciador de Temas Atual:** `next-themes` v0.3.0 controlando classe `.dark` em `<html>`, complementado por `useAccentTheme.ts` manipulando o atributo `data-accent="emerald" | "metallic-gold"` no `<html>`.
- **Bibliotecas de UI:** Radix UI primitives (`@radix-ui/*`), shadcn/ui derivado, `lucide-react` (0.462.0), `cmdk` (1.1.1), `sonner` (1.7.4), `vaul` (0.9.9), `class-variance-authority` (0.7.1).
- **Bibliotecas de Gráficos e Visualização:** `recharts` 2.15.4, `d3-scale` 4.0.2, `react-simple-maps` 3.0.0, `framer-motion` 12.35.0, `three` 0.185.1 (usado em visualizações 3D pontuais), `@excalidraw/excalidraw` 0.18.1.
- **Gerenciamento de Estado de Servidor:** `@tanstack/react-query` 5.83.0.
- **Fontes Carregadas:** `@fontsource/inter` (5.3.0) e `@fontsource/nunito` (5.2.7), sem preload explícito no HTML, sem fallbacks sistemáticos com tracking ajustado para números.
- **Comandos Oficiais:**
  - `npm run dev`: inicia Vite server em `::8080`
  - `npm run build`: `vite build` (geração em `dist/`)
  - `npm run test`: `vitest run` (798 testes passando em 177 suítes)
  - `npm run lint`: `eslint .`
  - `npm run test:visual`: `playwright test`

---

## 2. Mapa Estrutural de Componentes

### 2.1 Primitivos (`src/components/ui/`)
- **Ações e Controles:** `button.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `toggle.tsx`, `toggle-group.tsx`, `slider.tsx`.
- **Entrada de Dados:** `input.tsx`, `password-input.tsx`, `input-otp.tsx`, `CurrencyInput.tsx`, `select.tsx`, `form.tsx`, `label.tsx`.
- **Apresentação e Estrutura:** `card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`, `avatar.tsx`, `aspect-ratio.tsx`, `scroll-area.tsx`, `resizable.tsx`, `growdash-primitives.tsx`.
- **Navegação:** `breadcrumb.tsx`, `navigation-menu.tsx`, `menubar.tsx`, `pagination.tsx`, `sidebar.tsx`.
- **Overlays e Feedback:** `dialog.tsx`, `alert-dialog.tsx`, `drawer.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx`, `hover-card.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `alert.tsx`, `sonner.tsx`.
- **Visualização:** `chart.tsx`, `progress.tsx`, `carousel.tsx`, `command.tsx`, `calendar.tsx`.

### 2.2 Componentes de Dados e Negócio (`src/components/dashboard/`, `src/components/funnel*/`)
- **Métricas e KPIs:** `MetricCard.tsx`, `KPIWidget.tsx`, `FinancialOverviewWidgets.tsx`, `DashboardGoalProgress.tsx`, `AnimatedNumber.tsx`.
- **Radar e Controle:** `ControlTowerRadar.tsx` (Torre de controle / radar operacional), `TrafficClassAlerts.tsx`, `AlertsSection.tsx`.
- **Funis de Conversão:** `CampaignFunnel.tsx`, `FunnelStepsSelect.tsx`, `FunnelChartView.tsx`, `FunnelStageConversion.tsx`, `FunnelBottlenecks.tsx`, `FunnelSalesAttribution.tsx`.
- **Tabelas e Gráficos:** `CampaignResultsTable.tsx`, `ChartWidgets.tsx`, `PerformanceLineChart.tsx`, `PaymentChart.tsx`, `BrazilMap.tsx`, `BestPeriodOfDayWidget.tsx`.

### 2.3 Componentes Órfãos ou Duplicados Detectados
1. `src/styles/tokens.css` vs `src/index.css`: Duplicidade parcial. `tokens.css` define variáveis `--gd-*` mas a maioria absoluta das páginas consome variáveis Tailwind `hsl(var(--...))` ou classes de cores hardcoded (`text-emerald-500`, `text-amber-400`, `bg-card`).
2. `src/components/dashboard/widgets/FinancialOverviewWidgets.tsx` vs `src/components/dashboard/KPIWidget.tsx`: Ambos calculam e renderizam cartões de métricas financeiras com estruturas DOM e classes de borda distintas.
3. `src/components/funnel/FunnelChartView.tsx` vs `src/components/dashboard/CampaignFunnel.tsx` vs `src/components/funnel-analysis/FunnelStageConversion.tsx`: 3 implementações diferentes de funil visual no mesmo repositório, com tokens, setas e gradientes discrepantes.

---

## 3. Mapa de Telas e As 6 Mais Críticas

1. **Dashboard Principal (`/` e `/dashboard` -> `src/pages/Index.tsx` / `FullDashboard` / `DefaultDashboardContent.tsx`)**:
   - Tela primária do executivo e gestor de tráfego. Exibe meta de faturamento, combustível/progresso, cards de KPI (Impressões, ROAS, CPL, Leads), Radar de Anomalias e Funil de Vendas.
2. **Funil e Análise de Funis (`/analise-de-funis` -> `src/pages/FunnelAnalysis.tsx`)**:
   - Tela de gargalos, conversão por etapa, CAC e LTV por canal.
3. **Radar de Anomalias e Alertas (`/alertas` e `ControlTowerRadar.tsx`)**:
   - Torre de controle de contas Meta/Google, alertas de desvio de rota, estouro de CPL e pausa emergencial.
4. **Personalização de Tema e Configurações (`/settings` -> `src/pages/Settings.tsx` & `src/hooks/useAccentTheme.ts`)**:
   - Ponto central onde o usuário alterna Modo Claro / Escuro e os temas Esmeralda e Obsidian.
5. **Gestão de Campanhas e Tráfego (`/campanhas` -> `src/growdash/TrafficPage.tsx`)**:
   - Gerenciamento detalhado de anúncios, criativos, UTMs e ROAS.
6. **Centro de Inteligência / CRM (`/crm` -> `src/growdash/CrmPage.tsx`)**:
   - Distribuição de leads, oportunidades e fechamentos por canal.

---

## 4. Auditoria de Tokenização e Valores Hardcoded

### 4.1 Contagem de Valores Hardcoded
- **Cores Hexadecimais Literais fora de CSS:** Mais de **240 ocorrências** em arquivos `.tsx` e `.ts`.
  - `#FFF` / `#ffffff`: 82 ocorrências
  - `#34d399` / `#10b981` / `#047857` (verdes esmeralda desregulados): 38 ocorrências
  - `#d8b65c` / `#b57a20` / `#F5A623` / `#c98a24` (dourados/âmbar remanescentes): 46 ocorrências
  - `#050505` / `#070706` / `#1e1e1e` / `#121212` (pretos não tokenizados): 34 ocorrências
  - `#fb7185` / `#f43f5e` (vermelho/rosa hardcoded): 18 ocorrências
- **Estilos Inline (`style={{...}}`):** **119 arquivos `.tsx`** contêm estilos inline injetando cores, larguras arbitrárias, posições e sombras manuais.
- **Classes Utilitárias de Cores Fixas:** 420+ ocorrências de classes como `text-emerald-500`, `bg-emerald-500/10`, `border-amber-500/25`, `bg-rose-500/12` ignorando se o tema é claro ou escuro.

### 4.2 Classificação do Nível de Tokenização Atual
- **Classificação:** **PARCIAL E FRAGMENTADO**.
- **Diagnóstico:** O Tailwind possui mapeamento HSL padrão de shadcn (`--background`, `--card`, `--primary`), porém:
  1. O arquivo `src/index.css` possui 15.706 linhas com dezenas de sobrescritas manuais e seletores aninhados `html[data-accent="..."]` com hardcoded hex.
  2. Os componentes de dados e widgets usam classes arbitrárias de cores Tailwind (`emerald-500`, `amber-500`, `rose-500`) em vez de tokens semânticos (`var(--color-status-success)`, `var(--color-status-warning)`).
  3. Faltam tokens dedicados para brilho de borda (`glow`), efeitos de vidro (`glass`), profundidade de 4 camadas e ruído sutil de textura.

---

## 5. Gate da Fase 1: STATUS VERIFICADO
- [x] Inventário completo de stack, versões e comandos.
- [x] Mapeamento de componentes primitivos, dados e detecção de duplicidades.
- [x] Mapeamento das 6 telas críticas para o negócio.
- [x] Contagem rigorosa de hexadecimais literais (240+) e estilos inline (119 arquivos).
- [x] Arquivo `/audit-front/00-state.md` gerado e pronto.
