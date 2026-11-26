# Achados Técnicos e Visuais do Frontend — 02-frontend-findings.md

Data: 2026-11-05  
Projeto: Growdash  
Escopo: Exclusivamente Frontend, Design System, Temas Esmeralda & Obsidian e Percepção Visual.

---

## 1. Achados de Performance (GRO-PERF)

### ID: GRO-PERF-001
**Título:** Monólito de estilo `src/index.css` com 15.706 linhas e 781 KB bloqueia renderização inicial
- **Área:** performance
- **Severidade:** ALTO
- **Evidência:** `src/index.css:1-15706` pesa 781,5 KB. Contém centenas de regras legadas repetitivas, seletores `html[data-accent="..."]` gigantescos e animações complexas que competem com o parser de CSS crítico.
- **Impacto no usuário:** Aumento de First Contentful Paint (FCP) e delay de compilação em conexões móveis.
- **Impacto na percepção de valor:** Flash de layout sem estilo ou engasgo de animação ao carregar páginas pesadas de métricas.
- **Correção proposta:** Extrair o design system e tokens para folhas enxutas e modulares, eliminando 12.000+ linhas de estilos legados não utilizados ou duplicados.
- **Arquivos afetados:** `src/index.css`, `src/styles/tokens.css`, `tailwind.config.ts`.
- **Esforço:** G
- **Dependências:** Nenhuma
- **Teste de verificação:** Medir tamanho final do asset CSS no `vite build` (meta: < 120 KB gzipado).
- **Risco da correção:** Regressão visual se classes legadas não mapeadas forem removidas sem verificação.

### ID: GRO-PERF-002
**Título:** Chunks gigantescos no build (`dist/assets/chunk-Bwlv9Jf-.js` com 1,82 MB / 744 KB gzip)
- **Área:** performance
- **Severidade:** ALTO
- **Evidência:** `vite build` acusa: `(!) Some chunks are larger than 500 kB after minification. dist/assets/chunk-Bwlv9Jf-.js: 1,820.99 kB │ gzip: 744.20 kB` e `chunk-DFiRt5XK.js: 1,020.62 kB`.
- **Impacto no usuário:** Download inicial pesado de código de visualização 3D (`three`) e editor de fluxos (`@excalidraw/excalidraw`) mesmo para usuários que apenas visualizam o Dashboard principal.
- **Impacto na percepção de valor:** Tempo de abertura da plataforma percebido como lento.
- **Correção proposta:** Isolar bibliotecas especializadas (`@excalidraw/excalidraw`, `three`, mapas) com `React.lazy` nas rotas secundárias em `src/App.tsx` e `vite.config.ts`.
- **Arquivos afetados:** `vite.config.ts`, `src/App.tsx`, `src/components/GrowdashFlow/ExcalidrawFlowEditor.tsx`.
- **Esforço:** M
- **Dependências:** GRO-PERF-001
- **Teste de verificação:** `vite build` sem alertas de chunks acima de 500 kB fora de vendors isolados.
- **Risco da correção:** Pequeno flash de loading ao abrir a rota específica de fluxo 3D ou Excalidraw.

---

## 2. Achados de Acessibilidade (GRO-A11Y)

### ID: GRO-A11Y-001
**Título:** Falha de contraste WCAG AA em textos secundários e mutados no modo claro (2.20:1)
- **Área:** acessibilidade
- **Severidade:** CRÍTICO
- **Evidência:** Contraste medido matematicamente: `Fundo claro (#f5f8fe) vs Text Muted (#a1aab8) = 2.20:1` (mínimo exigido para texto comum é 4.5:1). Rótulos de métricas e legendas ficam ilegíveis sob luz ambiente.
- **Impacto no usuário:** Usuários com baixa acuidade visual ou telas com brilho reduzido não conseguem ler rótulos e subtextos.
- **Impacto na percepção de valor:** Visual parece desbotado e descuidado ("cinza lavado").
- **Correção proposta:** Redefinir a escala de neutros semânticos para garantir que `text-muted` no modo claro seja no mínimo `#525866` (contraste > 5.2:1).
- **Arquivos afetados:** `src/styles/tokens.css`, `src/index.css`.
- **Esforço:** P
- **Dependências:** GRO-TOK-001
- **Teste de verificação:** Cálculo matemático automatizado de contraste WCAG comprovando > 4.5:1 em todos os pares de texto/fundo.
- **Risco da correção:** Nenhum.

### ID: GRO-A11Y-002
**Título:** Contraste limítrofe do roxo neon (#8A2BE2) sobre fundos escuros (3.23:1 em texto pequeno)
- **Área:** acessibilidade
- **Severidade:** ALTO
- **Evidência:** `Dark bg (#0b0f14) vs Purple Neon (#8a2be2) = 3.23:1`. Passa apenas para textos grandes ou elementos gráficos, falhando em microcopys e labels normais.
- **Impacto no usuário:** Informações essenciais renderizadas em roxo neon (taxas de conversão, status) somem sobre fundo quase preto.
- **Impacto na percepção de valor:** Falta de refinamento tipográfico e legibilidade comprometida.
- **Correção proposta:** Calibrar a cor de acento roxo: usar tom luminoso (#A855F7 ou #C084FC) para texto sobre fundo escuro e tom profundo (#6B21A8 ou #581C87) sobre fundo claro, reservando o neon saturado apenas para bordas com brilho e glows decorativos.
- **Arquivos afetados:** `src/styles/tokens.css`, `src/index.css`.
- **Esforço:** P
- **Dependências:** GRO-TOK-001
- **Teste de verificação:** Verificador de contraste atestando > 4.5:1 para todo texto em roxo.
- **Risco da correção:** Nenhum.

---

## 3. Achados de Consistência e Tokenização (GRO-TOK)

### ID: GRO-TOK-001
**Título:** 240+ valores de cor hexadecimais literais e 119 arquivos com estilo inline
- **Área:** consistência
- **Severidade:** ALTO
- **Evidência:** `grep -rohE "#[0-9a-fA-F]{3,8}" src/` identificou 240+ ocorrências em arquivos `.tsx`. Estilos inline presentes em 119 arquivos aplicando `style={{ color: ..., width: ..., backgroundColor: ... }}`.
- **Impacto no usuário:** Ao alternar entre os temas Claro (Esmeralda) e Escuro (Obsidian), partes da tela continuam com cores fixas douradas, cinzas opacas ou pretas duras.
- **Impacto na percepção de valor:** Sensação de plataforma incompleta ("patchwork"), onde cada tela parece ter sido desenvolvida por uma equipe diferente.
- **Correção proposta:** Substituir todas as cores literais e estilos inline por tokens semânticos de design system vinculados a variáveis CSS dinâmicas.
- **Arquivos afetados:** Componentes em `src/components/dashboard/`, `src/components/funnel/`, `src/pages/`.
- **Esforço:** G
- **Dependências:** Nenhuma
- **Teste de verificação:** Script de lint que barra cores hexadecimais em arquivos `.tsx` e auditoria de estilo inline.
- **Risco da correção:** Necessidade de mapear cuidadosamente cada estado para não quebrar componentes legados.

---

## 4. Diagnóstico Visual da Percepção de Valor (GRO-UI)

### ID: GRO-UI-001
**Título:** Ausência de camadas de profundidade e bordas duras 1px cinza uniforme
- **Área:** visual
- **Severidade:** ALTO
- **Evidência:** `src/components/ui/card.tsx:9` aplica `rounded-lg border bg-card text-card-foreground shadow-sm`. Borda cinza estática uniforme sem sensação de vidro, sem gradiente luminoso e sem relevo.
- **Impacto no usuário:** Dificuldade em perceber hierarquia de informação e foco em métricas prioritárias.
- **Impacto na percepção de valor:** O visual se torna plano, corporativo antiquado e amador. O cliente declarou explicitamente a falta de efeito de vidro (glass), gradientes, fumaça/textura e bordas com brilho.
- **Correção proposta:** Implementar a arquitetura de 4 camadas: Nível 0 (fundo com textura sutil e nebulosa em baixa opacidade), Nível 1 (card glass com backdrop-filter blur, saturação, fundo translúcido e borda de 1px com gradiente/luz superior), Nível 2 (hover com glow suave), Nível 3 (modais/drawers).
- **Arquivos afetados:** `src/components/ui/card.tsx`, `src/styles/tokens.css`, `src/index.css`.
- **Esforço:** M
- **Dependências:** GRO-TOK-001
- **Teste de verificação:** Inspeção visual DevTools comprovando `backdrop-filter: blur(...)` e gradiente na borda.
- **Risco da correção:** Custo de paint em navegadores sem aceleração de GPU (mitigado com limites de blur < 20px).

### ID: GRO-UI-002
**Título:** Números de KPI sem tratamento tipográfico tabular e hierarquia visual fraca
- **Área:** visual
- **Severidade:** MÉDIO
- **Evidência:** Em `src/components/dashboard/widgets/FinancialOverviewWidgets.tsx`, `ControlTowerRadar.tsx` e `CampaignFunnel.tsx`, números utilizam fontes sem tracking negativo em tamanhos grandes e sem `font-variant-numeric: tabular-nums` generalizado.
- **Impacto no usuário:** Ao atualizar métricas em tempo real, os números "dançam" e mudam de largura horizontal.
- **Impacto na percepção de valor:** Dashboards financeiros premium de Wall Street / SaaS de elite usam números tabulares densos, tracking refinado e contraste hierárquico absoluto entre rótulo e valor.
- **Correção proposta:** Padronizar todos os valores numéricos com `font-variant-numeric: tabular-nums`, tracking negativo `-0.02em` a `-0.04em` e rótulos pequenos em uppercase sutil com tracking positivo.
- **Arquivos afetados:** `src/components/dashboard/MetricCard.tsx`, `KPIWidget.tsx`, `FinancialOverviewWidgets.tsx`.
- **Esforço:** P
- **Dependências:** GRO-TOK-001
- **Teste de verificação:** Verificação de CSS em todos os cards de métricas.
- **Risco da correção:** Nenhum.

### ID: GRO-UI-003
**Título:** Fragmentação conceitual entre metáfora espacial ("nave/órbita") e SaaS operacional
- **Área:** visual
- **Severidade:** MÉDIO
- **Evidência:** O dashboard de referência traz metáforas de ficção científica ("Combustível da Missão", "Fase Galáxia", foguete no funil, "Tripulação"). No código real convivem termos corporativos e termos galácticos sem padronização.
- **Impacto no usuário:** Ruído cognitivo para empresários e analistas que precisam de clareza de conversão e receita.
- **Impacto na percepção de valor:** O cliente quer a atmosfera estética (fundo preto profundo, nebulosa violeta, borda neon, status luminoso), mas sem cair no caricato de ficção científica.
- **Correção proposta:** Preservar 100% da atmosfera cromática (Obsidian + nebulosa roxa + acento esmeralda de ação), aplicando linguagem de produto SaaS de alto padrão (ex.: "Meta de Faturamento", "Funil de Conversão", "Torre de Controle Operacional").
- **Arquivos afetados:** Telas de Dashboard, Funil e Radar.
- **Esforço:** M
- **Dependências:** Nenhuma
- **Teste de verificação:** Revisão de copy e alinhamento visual com a premissa 3.10 do briefing.
- **Risco da correção:** Nenhum.

---

## 5. Gate da Fase 2: STATUS VERIFICADO
- [x] Achados categorizados com IDs estáveis (`GRO-PERF-*`, `GRO-A11Y-*`, `GRO-TOK-*`, `GRO-UI-*`).
- [x] Todas as medições comprovadas com arquivos, linhas e cálculos matemáticos reais.
- [x] Diagnóstico formal das causas do aspecto amador documentado.
