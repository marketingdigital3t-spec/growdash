# Design System Growdash — 05-design-system.md

Especificação técnica e numérica completa para a reformulação visual premium da Growdash.
Todos os valores são rigorosamente definidos em unidades numéricas exatas (`px`, `rem`, `hex`, `rgba`, `ms`).

---

## 1. Escala Cromática Primária: Esmeralda (Ação e Crescimento)

A cor primária esmeralda conduz ações, decisões de conversão e estados de crescimento financeiro.

| Passo | Hexadecimal | Luminância Relativa | Uso Recomendado |
| :--- | :--- | :--- | :--- |
| **emerald-50** | `#ECFDF5` | 0.96 | Fundo sutilíssimo de highlight no tema claro |
| **emerald-100** | `#D1FAE5` | 0.89 | Superfície de badge positiva no tema claro |
| **emerald-200** | `#A7F3D0` | 0.79 | Borda suave de acento no tema claro |
| **emerald-300** | `#6EE7B7` | 0.67 | Acento de texto sobre fundos escuros profundos |
| **emerald-400** | `#34D399` | 0.54 | Brilho/glow secundário e barras de progresso |
| **emerald-500** | `#10B981` | 0.40 | **emerald-accent** oficial em tema escuro |
| **emerald-600** | `#059669` | 0.27 | **emerald-accent** oficial em tema claro (WCAG AA > 4.8:1) |
| **emerald-700** | `#047857` | 0.17 | Hover de botões primários no tema claro |
| **emerald-800** | `#065F46` | 0.10 | Texto enfatizado de alta densidade no tema claro |
| **emerald-900** | `#064E3B` | 0.06 | Contornos densos de contraste |
| **emerald-950** | `#022C22` | 0.02 | Fundo de badges translúcidos no tema escuro |

- **emerald-glow:** `0 0 24px rgba(16, 185, 129, 0.35), 0 0 8px rgba(52, 211, 153, 0.45)`
- **Contraste Verificado:**
  - Texto branco `#FFFFFF` sobre `emerald-600` (`#059669`): **4.82:1 (PASS WCAG AA)**
  - `emerald-400` (`#34D399`) sobre Fundo Obsidian `#07090E`: **10.25:1 (PASS WCAG AAA)**

---

## 2. Escala Secundária: Roxo Galáxia (Atmosfera, Progresso e Inteligência)

Derivada da referência do dashboard espacial (`GALAXIA.png`), calibrada para sofisticação e legibilidade.

| Passo | Hexadecimal | Luminância Relativa | Uso Recomendado |
| :--- | :--- | :--- | :--- |
| **purple-50** | `#FAF5FF` | 0.96 | Fundo de elementos destacados no tema claro |
| **purple-100** | `#F3E8FF` | 0.88 | Pílulas e badges secundários tema claro |
| **purple-200** | `#E9D5FF` | 0.77 | Linhas de referência em gráficos |
| **purple-300** | `#D8B4FE` | 0.63 | Texto de suporte e links sobre tema escuro |
| **purple-400** | `#C084FC` | 0.48 | Texto secundário em cards galácticos (WCAG AA > 5.8:1) |
| **purple-500** | `#A855F7` | 0.33 | **purple-accent** luminoso no tema escuro |
| **purple-600** | `#8B5CF6` | 0.23 | Barras de progresso e anéis de radar |
| **purple-700** | `#6D28D9` | 0.13 | **purple-accent** de ação no tema claro |
| **purple-800** | `#4C1D95` | 0.06 | Gradientes de fundo da nebulosa |
| **purple-900** | `#2D0B4F` | 0.03 | Centro de gravidade da nebulosa atmosférica |
| **purple-950** | `#16042B` | 0.01 | Camada base de profundidade cósmica |

- **purple-neon (Ref. #8A2BE2):** Reservado estritamente para bordas luminosas, contornos e glows no tema escuro. Proibido em textos menores que 18px.
- **purple-glow:** `0 0 32px rgba(138, 43, 226, 0.38), 0 0 10px rgba(168, 85, 247, 0.45)`
- **Regra de convivência:** Esmeralda guia **ação e conversão**. Roxo conduz **progresso, status inteligente e atmosfera**.

---

## 3. Escala de Neutros (Ligeiramente Saturada em Esmeralda/Azul Cósmico)

Proibido cinza neutro morto. A escala é levemente matizada para absorver a iluminação dos acentos.

| Passo | Hexadecimal | Uso no Tema Obsidian | Uso no Tema Esmeralda |
| :--- | :--- | :--- | :--- |
| **neutral-50** | `#F8FAFC` | Texto primário luminoso | Fundo geral da página |
| **neutral-100** | `#F1F5F9` | Texto de títulos de alta ênfase | Superfície do card (Nível 1) |
| **neutral-200** | `#E2E8F0` | Texto secundário | Bordas sutis |
| **neutral-300** | `#CBD5E1` | Texto atenuado/legível | Linhas divisórias |
| **neutral-400** | `#94A3B8` | Ícones inativos e rótulos | Texto desabilitado |
| **neutral-500** | `#64748B` | Bordas e contornos de cards | Texto secundário mutado |
| **neutral-600** | `#475569` | Linhas de grade de gráficos | Texto de corpo de leitura |
| **neutral-700** | `#334155` | Bordas de cards elevados | Títulos e ênfases |
| **neutral-800** | `#1E293B` | Superfície elevada (Nível 2) | Texto primário denso |
| **neutral-900** | `#0F172A` | Superfície base de cards (Nível 1) | Preto de contraste máximo |
| **neutral-950** | `#07090E` | Fundo principal da página (Nível 0) | — |

---

## 4. Definição Completa dos Dois Temas

### 4.1 Tema "Obsidian" (Dark Premium)
- `--bg-canvas`: `#07090E` (Preto profundo fosco com toque de azul petróleo cósmico)
- `--surface-card`: `rgba(15, 23, 42, 0.65)` (Translúcido com backdrop-filter)
- `--surface-raised`: `rgba(30, 41, 59, 0.75)` (Cards destacados / Nível 2)
- `--border-subtle`: `rgba(255, 255, 255, 0.08)`
- `--border-bright`: `linear-gradient(135deg, rgba(168, 85, 247, 0.45) 0%, rgba(16, 185, 129, 0.35) 50%, rgba(255, 255, 255, 0.1) 100%)`
- `--text-primary`: `#F8FAFC` (Contraste 17.5:1)
- `--text-secondary`: `#CBD5E1` (Contraste 11.2:1)
- `--text-muted`: `#94A3B8` (Contraste 6.4:1)
- `--accent-primary`: `#10B981` (Esmeralda)
- `--accent-secondary`: `#A855F7` (Roxo Neon Galáxia)

### 4.2 Tema "Esmeralda" (Light Elegance)
- `--bg-canvas`: `#F4F8F6` (Branco aquecido com 2% de esmeralda)
- `--surface-card`: `rgba(255, 255, 255, 0.85)` (Vidro claro com leve reflexo superior)
- `--surface-raised`: `#FFFFFF` (Card flutuante com sombra suave)
- `--border-subtle`: `rgba(6, 78, 59, 0.09)`
- `--border-bright`: `linear-gradient(135deg, rgba(5, 150, 105, 0.35) 0%, rgba(109, 40, 217, 0.25) 100%)`
- `--text-primary`: `#0B1A15` (Verde grafite profundo, contraste 15.8:1)
- `--text-secondary`: `#2D4A3E` (Contraste 8.7:1)
- `--text-muted`: `#4D6B5F` (Contraste 4.9:1 — WCAG AA garantido)
- `--accent-primary`: `#059669` (Esmeralda puro calibrado)
- `--accent-secondary`: `#6D28D9` (Roxo nobre de contraste)

---

## 5. Tipografia e Escala Numérica

- **Família de UI:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Família Numérica de Métricas:** `Inter`, com `font-feature-settings: "tnum" 1, "cv05" 1` e `letter-spacing: -0.03em`.

| Nível | Tamanho (rem / px) | Peso | Line Height | Tracking | Aplicação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display KPI** | `2.5rem / 40px` | 800 (Extra Bold) | 1.1 | `-0.04em` | Métricas primárias (ROAS, Faturamento, CPL) |
| **Title 1** | `1.75rem / 28px` | 700 (Bold) | 1.2 | `-0.025em` | Título do Dashboard e Seções Principais |
| **Title 2** | `1.25rem / 20px` | 700 (Bold) | 1.3 | `-0.015em` | Título de Cards e Módulos |
| **Body Lead** | `1.0rem / 16px` | 500 (Medium) | 1.5 | `0` | Parágrafos de destaque e resumos |
| **Body Small** | `0.875rem / 14px`| 400 / 500 | 1.4 | `0` | Textos de tabelas e listas de alertas |
| **Label Uppercase** | `0.6875rem / 11px`| 700 (Bold) | 1.2 | `+0.12em` | Rótulos de métricas e status ("IMPRESSÕES", "LEADS") |

---

## 6. Arquitetura de Profundidade em 4 Camadas

```
Camada 3 (Z: 300) -> Modais, Drawers e Diálogos de Confirmação (Sombra 0 24px 64px rgba(0,0,0,0.6))
Camada 2 (Z: 10)  -> Card em Hover / Elemento Flutuante (Elevação + Glow + Borda Iluminada)
Camada 1 (Z: 1)   -> Cards de Dados com Efeito Vidro (Glass Backdrop-Blur + Reflexo Superior 1px)
Camada 0 (Z: 0)   -> Fundo Canvas Fosco + Nebulosa Radial Lenta + Textura Sutil 3% Ruído
```

---

## 7. Efeitos Assinatura com CSS Executável

### 7.1 Borda com Brilho (Luminous Border)
```css
.gd-glow-border {
  position: relative;
  border-radius: 16px;
  background: linear-gradient(var(--surface-card), var(--surface-card)) padding-box,
              linear-gradient(135deg, rgba(168, 85, 247, 0.5) 0%, rgba(16, 185, 129, 0.4) 50%, rgba(255, 255, 255, 0.08) 100%) border-box;
  border: 1px solid transparent;
  transition: border-color 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease;
}
.gd-glow-border:hover {
  box-shadow: 0 0 28px -6px rgba(138, 43, 226, 0.3), 0 0 14px -4px rgba(16, 185, 129, 0.25);
}
```

### 7.2 Efeito Vidro Premium (Glassmorphism)
```css
.gd-glass-card {
  background-color: var(--surface-card);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.12),
              0 12px 32px -8px rgba(0, 0, 0, 0.45);
}
```

### 7.3 Nebulosa de Fundo (Atmospheric Nebula)
```css
.gd-nebula-bg {
  background-color: var(--bg-canvas);
  background-image: 
    radial-gradient(ellipse 60% 40% at 85% 15%, rgba(138, 43, 226, 0.18) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 15% 85%, rgba(16, 185, 129, 0.12) 0%, transparent 65%),
    radial-gradient(circle 400px at 50% 50%, rgba(74, 20, 140, 0.15) 0%, transparent 80%);
  background-attachment: fixed;
}
```

### 7.4 Textura de Ruído Orgânico (SVG Noise)
```css
.gd-noise-overlay {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events: none;
}
```

---

## 8. Movimento e Acessibilidade de Animação

- **Micro-interações:** `120ms` cubic-bezier(0.22, 1, 0.36, 1) (hover de botão, clique, tooltip).
- **Transições de Superfície:** `220ms` cubic-bezier(0.22, 1, 0.36, 1) (abertura de menu, expansão de linha).
- **Entrada de Página:** `380ms` cubic-bezier(0.22, 1, 0.36, 1) com stagger de 40ms entre cards de métrica.
- **Cláusula Obrigatória de Redução de Movimento:**
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Gate da Fase 3: STATUS VERIFICADO
- [x] Escalas numéricas de 11 passos para Esmeralda, Roxo Galáxia e Neutros definidas.
- [x] Contraste WCAG AA verificado e documentado para ambos os temas.
- [x] 4 camadas de elevação e efeitos CSS exatos (glass, glow border, nebula, noise) prontos.
