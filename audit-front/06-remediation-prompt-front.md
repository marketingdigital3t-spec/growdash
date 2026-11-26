# PROMPT MASTER DE EXECUÇÃO DO REDESIGN — GROWDASH FRONTEND

> **Instrução para o Agente Executor:**
> Você é o Engenheiro Especialista em Frontend e Design System da Growdash.
> Este documento é um prompt operacional autônomo e executável.
> Execute a sequência rigorosa de 6 etapas abaixo, criando exatamente **um commit semântico por etapa** e validando com evidências antes de avançar.

---

## DIRETRIZES FUNDAMENTAIS E INEGOCIÁVEIS
1. **Sem cores literais fora do token:** É expressamente proibido o uso de `#hex`, `rgb(...)` ou classes fixas como `text-emerald-500` fora dos arquivos de token e variantes centralizadas.
2. **Sem estilos inline:** Estilos do tipo `style={{ color: ..., width: ... }}` são proibidos para cores, espaçamentos e sombras.
3. **Dois temas obrigatórios:** Todo componente e tela deve funcionar com contraste WCAG AA (> 4.5:1) tanto no tema **Obsidian** (dark profundo, cósmico fosco) quanto no tema **Esmeralda** (light elegante, translúcido).
4. **Atmosfera de alto padrão:** Incorporar efeito de vidro (`backdrop-filter: blur(16px)`), bordas com brilho (`gd-glow-border`), nebulosa de fundo com gradientes lentos e textura de ruído sutil.
5. **Linguagem de Produto SaaS:** Preservar a atmosfera estética da referência cósmica, mas utilizando terminologia corporativa premium ("Funil de Conversão", "Torre de Controle Operacional", "Meta de Faturamento").

---

## ETAPA 1: FUNDAÇÃO DE TOKENS E SISTEMA DE TEMAS

### 1.1 Objetivo
Estabelecer o motor de tokens dinâmicos, garantindo os dois temas (Obsidian e Esmeralda), a alternância de tema persistida e o script anti-flash no `<head>`.

### 1.2 Arquivos a Modificar / Criar
- `src/styles/tokens.css` (redefinir com a especificação numérica de `/audit-front/05-design-system.md`)
- `src/hooks/useAccentTheme.ts` (suporte a `"obsidian"` e `"emerald"` com tipagem estrita)
- `index.html` (script inline síncrono antes do paint para evitar FOUC)
- `tailwind.config.ts` (estender tokens semânticos: `gd-bg`, `gd-surface`, `gd-border`, `gd-glow`)

### 1.3 Procedimento
1. Declarar as variáveis completas de `--gd-*` para `:root` (tema Esmeralda) e `html.dark` ou `html[data-theme="obsidian"]`.
2. Configurar classes utilitárias de assinatura em `tokens.css`: `.gd-glass-card`, `.gd-glow-border`, `.gd-nebula-bg`, `.gd-noise-overlay`, `.gd-tabular`.
3. Injetar o bootstrap no `index.html`:
```html
<script>
  (function() {
    try {
      var theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      var accent = localStorage.getItem('growdash:accent-theme') || 'obsidian';
      document.documentElement.dataset.accent = accent;
    } catch (e) {}
  })();
</script>
```
4. **Verificação da Etapa:** Rodar `npm run test` e verificar via preview do browser a alternância sem erros de console.
5. **Commit:** `feat(design-system): implement token foundation and anti-fouc theme bootstrap`

---

## ETAPA 2: REFATORAÇÃO DE PRIMITIVOS DE UI

### 2.1 Objetivo
Migrar os componentes primitivos para consumirem exclusivamente tokens semânticos, bordas iluminadas e efeitos de foco acessíveis.

### 2.2 Componentes Chave
- `src/components/ui/card.tsx` -> aplicar `.gd-glass-card` e `.gd-glow-border` por padrão em cards de elevação.
- `src/components/ui/button.tsx` -> refatorar variantes: `default` (Esmeralda com glow sutil), `secondary` (translúcido roxo com borda leve), `destructive` e `ghost`.
- `src/components/ui/input.tsx` e `select.tsx` -> fundo com `var(--surface-raised)`, borda com `var(--border-subtle)` e foco em `var(--accent-primary)`.
- `src/components/ui/badge.tsx` -> variantes `success`, `warning`, `destructive`, `purple` e `emerald` com bordas luminosas em 1px.
- `src/components/ui/skeleton.tsx` -> shimmer refinado com máscara gradiente.

### 2.3 Verificação da Etapa
- Conferir foco visível via teclado (`Tab`) em todos os controles.
- **Commit:** `feat(ui-primitives): adapt core components to glassmorphism and glow tokens`

---

## ETAPA 3: COMPONENTES DE DADO, KPIS E GRÁFICOS

### 3.1 Objetivo
Transformar a visualização de métricas em um cockpit financeiro de alto impacto visual.

### 3.2 Componentes a Refatorar
1. `src/components/dashboard/MetricCard.tsx` e `KPIWidget.tsx`:
   - Adicionar tratamento tipográfico tabular: `font-variant-numeric: tabular-nums`, `letter-spacing: -0.03em`.
   - Rótulos em uppercase compacto com tracking largo (`letter-spacing: 0.12em`).
   - Sparklines e badges de tendência com contraste AA garantido.
2. `src/components/dashboard/DashboardGoalProgress.tsx`:
   - Barra de combustível/faturamento com gradiente contínuo roxo-galáxia para esmeralda luminoso e animação suave.
3. `src/components/dashboard/CampaignFunnel.tsx` e `FunnelStageConversion.tsx`:
   - Substituir caixas duras por funil cilíndrico/orbital com gradiente translúcido e setas de conversão contrastadas.
4. `src/components/dashboard/ControlTowerRadar.tsx`:
   - Círculos concêntricos luminosos em roxo sutil e pontos de anomalia pulsantes nas cores semânticas (verde, âmbar, vermelho).

### 3.3 Verificação da Etapa
- Testar 3 densidades de dados (zero, valores típicos e números de 8 dígitos) sem estouro de layout.
- **Commit:** `feat(dashboard-data): elevate KPI cards, radar and funnel with glow effects`

---

## ETAPA 4: ATMOSFERA GLOBAL, SUPERFÍCIES E PROFUNDIDADE

### 4.1 Objetivo
Aplicar a camada 0 de ambientação (nebulosa profunda e textura) no layout principal sem penalizar o framerate.

### 4.2 Arquivos a Modificar
- `src/components/AppLayout.tsx` e `src/growdash/GrowdashLayout.tsx`:
  - Aplicar classe `.gd-nebula-bg` no container mestre.
  - Adicionar a camada `.gd-noise-overlay` fixa de baixa opacidade (3.5%).
- `src/components/AppSidebar.tsx`:
  - Estilizar a navegação com transparência escura refinada, divisor com gradiente de 1px e item ativo com pílula de luz esmeralda.

### 4.3 Verificação da Etapa
- Medir FPS de rolagem no DevTools (meta: 60 FPS contínuos, sem repaint excessivo).
- **Commit:** `feat(layout): apply cosmic nebula atmosphere and noise texture to shell`

---

## ETAPA 5: MIGRAÇÃO TELA POR TELA

Executar uma migração completa e dedicada por tela, commitando individualmente:

1. **Dashboard Principal (`src/pages/Index.tsx` e widgets):**
   - Header do cockpit, barra de faturamento mensal, grid de KPIs, Torre de Controle e Funil.
   - **Commit:** `feat(screens): migrate main dashboard to premium obsidian and emerald theme`
2. **Funil de Conversão (`src/pages/FunnelAnalysis.tsx`):**
   - Gráficos de gargalo, conversão por etapa e matriz de canais.
   - **Commit:** `feat(screens): migrate funnel analysis screen with glass data surfaces`
3. **Radar de Anomalias e Alertas (`src/pages/Alerts.tsx`):**
   - Lista de exceções, status de impacto financeiro e procedimentos de mitigação.
   - **Commit:** `feat(screens): elevate alerts and anomaly radar with luminous status indicators`
4. **Personalização e Configurações (`src/pages/Settings.tsx`):**
   - Seletor visual interativo entre o tema **Obsidian** (Galáxia Dark) e **Esmeralda** (Light Luxo), com preview instantâneo.
   - **Commit:** `feat(screens): introduce dedicated theme selector in settings`
5. **Gestão de Campanhas e Tráfego (`src/growdash/TrafficPage.tsx`):**
   - Tabela de resultados com colunas resizáveis, badges de status das campanhas e métricas de ROAS.
   - **Commit:** `feat(screens): refine paid traffic management view`

---

## ETAPA 6: POLIMENTO, ACESSIBILIDADE E AUDITORIA FINAL

### 6.1 Ações Finais
- Verificar contraste WCAG AA (> 4.5:1) em 100% dos textos com a ferramenta de cálculo.
- Confirmar suporte estrito a `prefers-reduced-motion`.
- Validar estados vazios (empty state), skeletons de carregamento e mensagens de erro.
- Executar a suíte de testes automatizados (`npm run test`).
- **Commit:** `chore(polish): verify WCAG AA compliance, reduced motion and final test suite`

---

## DEFINITION OF DONE DO PROMPT
- Zero cores literais em arquivos `.tsx`.
- Alternância entre Obsidian e Esmeralda 100% funcional sem flash.
- Build do Vite executando em menos de 5 segundos sem quebras.
- 798+ testes unitários passando.
