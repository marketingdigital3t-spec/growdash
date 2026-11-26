# PROMPT MASTER — PURGAÇÃO DE TONS ROXOS/AZUIS E ALINHAMENTO VISUAL ESMERALDA PURO

**Data:** 2026-11-06  
**Status:** Executável / Obrigatório  
**Referência Visual Aprovada:** Imagem 2 (cards pretos com gradiente esmeralda escuro profundo, bordas finas verdes sutis, sparkline de pulso verde neon `#00FF88`/`#10B981` e valores brancos puros).

---

## 1. DIAGNÓSTICO DO ERRO GRAVE

Na Imagem 1 (rejeitada pelo usuário):
- Os cards de KPI exibiam um fundo azulado/slate (`rgba(15, 23, 42)` / HSL 222°).
- A nebulosa de fundo no app shell continha halos em `rgba(138, 43, 226)` (violeta/roxo).
- O gráfico de pizza/donut de "Distribuição por Plataforma" injetava azul intenso (`#0866FF`).
- A borda e reflexos de cards continham sobras do espectro roxo Obsidian.

Na Imagem 2 (aprovada 100% pelo usuário):
- Superfície dos cards: `linear-gradient(145deg, rgba(18, 37, 25, 0.96), rgba(10, 24, 16, 0.96))` no modo escuro.
- Borda dos cards: `rgba(16, 185, 129, 0.28)` fina, sem contorno cinza ou roxo.
- Ícone de status: caixa quadrada arredondada com `bg-emerald-500/10 border-emerald-500/25` e ícone de linha verde neon `#00FF88`.
- Texto: rótulo uppercase em cinza-esmeralda suave (`#94A3B8`/`#A7F3D0`), número grande em branco puro `#FFFFFF` tabular.
- Zero roxo, zero azul-marinho, zero slate em toda a plataforma.

---

## 2. REGRAS INEGOCIÁVEIS DE EXECUÇÃO

1. **Zero Roxo:** Nenhuma regra no CSS de produção pode conter roxo, violeta, magenta ou `#BC13FE`/`#A855F7`/`#7C3AED`.
2. **Zero Azul Marinho / Slate:** Eliminar `--surface-card: rgba(15, 23, 42, ...)` e trocar por fundo esmeralda florestal escuro autêntico da Imagem 2: `rgba(18, 37, 25, 0.96)` ou `#0B1610`.
3. **Fundo Geral (Canvas):** `#060B08` ou `#040906` profundo (quase preto, saturado em esmeralda), com nebulosa em tons verdes esmeralda suaves (`rgba(16, 185, 129, 0.12)`).
4. **Gráfico de Donut (Distribuição por Plataforma):** No tema esmeralda, Meta e outras plataformas devem usar escalas harmônicas de verde esmeralda e tons neutros, sem quebrar a paleta com azul gritante.
5. **Validação:** Todos os 809 testes devem passar e a verificação visual no browser deve comprovar a ausência total de azul/roxo nos cards.
