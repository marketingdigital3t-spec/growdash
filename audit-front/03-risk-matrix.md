# Matriz de Risco e Ordem de Execução — 03-risk-matrix.md

Ordem rigorosa baseada no critério do briefing:
1. Acessibilidade bloqueante primeiro
2. Performance que degrada carregamento segundo
3. Inconsistência e tokenização terceiro
4. Percepção visual e camadas de valor quarto
5. Polimento por último

---

## Tabela Priorizada de Execução

| Ordem | ID | Área | Severidade | Impacto no Negócio | Esforço | Dependência | Descrição da Ação |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | `GRO-A11Y-001` | acessibilidade | CRÍTICO | Alto (Ilegibilidade sob luz diurna em modo claro) | P | Nenhuma | Corrigir contraste de `text-muted` no tema Esmeralda para > 4.8:1 |
| **2** | `GRO-A11Y-002` | acessibilidade | ALTO | Médio (Dificuldade de leitura de badges em tema escuro) | P | `GRO-A11Y-001` | Ajustar escala de roxo neon, separando uso de texto vs brilho |
| **3** | `GRO-TOK-001` | consistência | ALTO | Alto (Troca de tema quebrava componentes legados) | G | `GRO-A11Y-002` | Implementar fundação de tokens CSS e eliminar cores fixas nos primitivos |
| **4** | `GRO-PERF-001` | performance | ALTO | Alto (CSS monólito de 781 KB atrasando FCP) | G | `GRO-TOK-001` | Modularizar tokens e expurgar classes legadas redundantes em `index.css` |
| **5** | `GRO-UI-001` | visual | ALTO | Crítico (Demanda direta do cliente: amadorismo por falta de vidro e glow) | M | `GRO-TOK-001` | Aplicar arquitetura de 4 camadas: Vidro (glass), Borda com brilho e Nebulosa |
| **6** | `GRO-UI-002` | visual | MÉDIO | Médio (Alinhamento numérico financeiro instável) | P | `GRO-UI-001` | Implementar `tabular-nums` e tracking negativo nos cards de KPI |
| **7** | `GRO-UI-003` | visual | MÉDIO | Alto (Ajuste de copy: SaaS premium sem caricatura espacial) | M | `GRO-UI-001` | Refinar linguagem do dashboard para produto executivo de alta conversão |
| **8** | `GRO-PERF-002` | performance | ALTO | Médio (Chunks pesados de bibliotecas 3D e Excalidraw) | M | `GRO-PERF-001` | Lazy-loading sob demanda para módulos não críticos de fluxo |

---

## Estratégia de Mitigação de Riscos

1. **Risco de regressão visual em páginas secundárias:**
   - *Mitigação:* As variáveis clássicas de shadcn (`--background`, `--card`, `--primary`, `--border`) são mantidas como aliases diretos dos novos tokens semânticos, garantindo compatibilidade reversa total.
2. **Risco de custo de paint e queda de FPS por múltiplos blurs:**
   - *Mitigação:* O filtro `backdrop-filter: blur(...)` é limitado a no máximo `16px` em cards de primeiro plano e desativado em elementos que sofrem transformações rápidas de rolagem em mobile.
3. **Risco de flash de tema errado (FOUC):**
   - *Mitigação:* Script de bootstrap síncrono injetado no `<head>` de `index.html` que aplica a classe e o atributo do tema antes do primeiro ciclo de pintura do navegador.
