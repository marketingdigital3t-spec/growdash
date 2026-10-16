# Prompt master — Growdash Flow inspirado em Excalidraw

## Objetivo

Evoluir o canvas existente do Growdash Flow para um quadro operacional rápido, previsível e acessível, inspirado nos padrões de interação observados no Excalidraw. O produto continua sendo Growdash: não copiar marca, assets, código ou telas proprietárias do Excalidraw e não substituir integrações Meta/RD.

## Estudo aplicado

Na versão pública observada do Excalidraw, o fluxo central foi confirmado com captura visual e árvore de acessibilidade: seleção por ferramenta e atalhos, desenho de retângulo/losango/elipse/linha/seta/freehand/texto/sticky, pan com mão/espaço/roda, zoom fixo no canto, undo/redo, seleção múltipla, alças de resize/rotação, painel contextual de estilo/cor/espessura/opacidade/camadas, duplicar/apagar, texto inline, setas com bindings e edição de pontos, biblioteca, exportação e colaboração. O editor informa os atalhos no próprio controle e mantém os estados de seleção legíveis.

## Contrato do Growdash Flow

- `FlowData` permanece a fonte persistida do quadro: `elements`, `zoom`, `panOffset`, `showGrid`, `snapToGrid`, `updatedAt`.
- Cada `DrawElement` mantém geometria, estilo, camada, lock e bindings. `textColor` é opcional para preservar compatibilidade com quadros já salvos.
- Meta/RD e dados de conta não são escritos pelo canvas. O Flow apenas lê métricas vinculadas pelos hooks existentes.
- Falhas de salvamento não podem apagar o último quadro válido; exportações são operações locais e explícitas.

## Interações obrigatórias

1. Seleção: clique, Shift para seleção múltipla, arraste para marquee e Delete/Backspace para remover.
2. Movimento: arraste, setas para um passo, Espaço ou ferramenta mão para pan; roda para zoom ancorado no cursor.
3. Criação: cada ferramenta tem atalho visível; por padrão retorna para seleção após desenhar. O botão “Manter ferramenta ativa” permite criação repetida sem reativar a ferramenta.
4. Conectores: linhas/setas podem iniciar em um elemento, encaixar em outro e continuar ligadas quando os elementos se movem.
5. Texto: Enter/double click edita inline; o tamanho automático evita caixas vazias; texto multilinha permanece visível e exportável.
6. Estilo: preencher, borda, texto, espessura, opacidade, rotação, camadas, duplicação, lock e exclusão ficam no painel contextual.
7. Histórico: toda ação mutável deve gerar checkpoint; Ctrl/⌘ Z, Ctrl/⌘ Shift Z e Ctrl/⌘ Y funcionam sem perder o estado selecionado.
8. Exportação: PNG, SVG e JSON devem representar os elementos e quebras de linha do quadro atual.

## Legibilidade e acessibilidade

- Usar tokens semânticos no chrome e foco visível em controles.
- Nunca forçar texto preto em superfícies escuras nem branco em superfícies claras.
- Para sticky/texto sem cor explícita, escolher foreground por contraste da superfície; uma cor definida pelo autor sempre vence a heurística.
- Todo controle precisa de `aria-label`, estado pressed/disabled e tooltip/atalho quando aplicável.
- Não depender apenas de cor para comunicar seleção, erro ou estado.
- Preservar layout responsivo sem scroll horizontal oculto; toolbar pode quebrar em linhas.

## Não fazer

- Não instalar o Excalidraw inteiro apenas para mascarar o editor existente.
- Não usar `invert()`, filtros globais ou alteração de shell.
- Não alterar tabelas, integrações, regras de atribuição, sincronização ou dados reais para resolver aparência do canvas.
- Não declarar colaboração em tempo real sem backend e teste próprios; o escopo atual é edição persistida e exportação local.

## Aceitação

- Quadro existente abre com elementos, zoom, grade e snap preservados.
- Seleção, pan, zoom, resize, conectores, texto, undo/redo, salvar e exportar continuam funcionando.
- “Manter ferramenta ativa” permite desenhar dois elementos consecutivos com a mesma ferramenta e retorna a seleção quando desligado.
- Sticky claro e escuro têm texto legível; cor de texto manual é respeitada.
- SVG/PNG mantêm texto em múltiplas linhas.
- TypeScript, lint, testes e build passam; a rota autenticada é conferida após publicação.
