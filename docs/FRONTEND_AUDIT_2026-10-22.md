# Auditoria completa do front-end — 2026-10-22

## Escopo e evidência

- Aplicação autenticada em `https://growdash.com.br`.
- 27 rotas autenticadas percorridas no Chrome com sessão do workspace `Thiego`.
- Temas `light` e `dark` verificados em desktop (1680×933).
- Breakpoint mobile verificado em 390×844; a auditoria mediu overflow real, posições e dimensões renderizadas.
- Console: nenhum erro `error` capturado durante a varredura das rotas.
- Imagens: nenhuma imagem visível sem atributo `alt` nas rotas auditadas.
- A barra lateral principal preservou seu scroll próprio; nenhuma regra nova altera o scroll dela.

## Achados reproduzíveis

### FE-012 — Cards de Campanhas invisíveis/colapsados no mobile (P1)

Reprodução: abrir `/campanhas` em 390 px, aguardar os dados e observar abaixo da barra de filtros.

Evidência: o elemento `.campaign-table-frame` foi renderizado com altura aproximada de `2px`, enquanto os cards mobile começavam em `top ≈ 5158px`. O shell mobile herdava o canvas travado de desktop (`height: calc(100dvh - 255px)`, `flex: 1 1 0`, `overflow: hidden`), deixando o conteúdo efetivamente inacessível no primeiro fluxo de rolagem.

Correção aplicada: no breakpoint mobile, o shell de tráfego e o frame de campanhas passam a ter altura automática, o stack de cards deixa de ser limitado a uma faixa flexível de 2 px e a página recupera rolagem vertical normal.

### FE-013 — Sidebar Business quebra o contrato de tema escuro (P1)

Reprodução: abrir `/business`, alternar para modo escuro e observar o menu secundário.

Evidência: havia `bg-white`, `text-slate-900`, `text-slate-700` e `border-slate-200` diretamente no componente. O botão de recolher menu foi calculado como `background: rgb(255,255,255)` dentro do tema escuro.

Correção aplicada: o componente usa tokens `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted` e `bg-primary`; o chrome do botão foi isolado para não receber o gradiente branco global de `.premium-button`.

### FE-014 — Links Business externos não usavam o destino externo (P1)

Reprodução: no menu Business, itens como Caixa de entrada, Conteúdo e Planner exibiam o sufixo “Growdash”, mas o componente calculava `href` e renderizava `NavLink` interno, ignorando a URL da Meta.

Correção aplicada: quando o item possui `external`, a renderização usa `<a target="_blank" rel="noreferrer">` com o `href` calculado; itens sem conta permanecem desabilitados e informativos.

### FE-015 — Checkboxes sem nome acessível (P2)

Reprodução: `/leads-incompletos` e `/anuncios`; os controles `role="checkbox"` não apresentavam `aria-label` no DOM.

Correção aplicada: seleção global e seleção por lead receberam nomes estáveis; os alvos de tela dos anúncios usam o próprio texto visível como `aria-label`.

## Prompt de correção executado

```text
Audite e corrija o front-end autenticado do Growdash preservando o contrato de dados e o scroll independente da sidebar principal.

1. Percorra todas as rotas autenticadas nos temas claro e escuro e nos breakpoints 390, 768 e desktop. Registre apenas problemas reproduzíveis com rota, seletor, causa raiz e evidência renderizada.
2. Corrija o FE-012: no mobile, não deixe o canvas travado de desktop reduzir .campaign-table-frame ou o stack de cards para poucos pixels. Mantenha a tabela desktop intacta, preserve o scroll horizontal interno da tabela e devolva rolagem vertical acessível aos cards.
3. Corrija o FE-013: remova cores fixas branco/slate do BusinessWorkspacePage e use tokens do tema para superfícies, texto, bordas, estados ativos, conta e controles. Neutralize somente o botão de chrome do menu contra a camada global de premium-button.
4. Corrija o FE-014: itens Business marcados como externos devem realmente usar seu href externo em nova aba, com rel=noreferrer; itens sem conta não devem navegar.
5. Corrija o FE-015: todo role=checkbox precisa de nome acessível, sem alterar o comportamento de seleção.
6. Adicione testes de contrato/regressão para a cascata mobile, os tokens do Business, os links externos e os aria-labels.
7. Rode os testes direcionados, a suíte completa, lint, build, git diff --check e faça nova validação visual nos dois temas. Não inclua mudanças locais não relacionadas no commit.
```

## Critérios de aceite

- `/campanhas` em 390 px mostra o primeiro card mobile sem um espaço vazio de milhares de pixels e permite rolagem vertical até os demais cards.
- `/campanhas` desktop mantém a tabela e o overflow horizontal interno.
- `/business` não exibe botão branco ou texto ilegível no modo escuro; o modo claro permanece legível.
- Itens externos do Business apontam para `business.facebook.com` quando uma conta está selecionada.
- Todos os checkboxes dos dois módulos aparecem com nome acessível no DOM.
- Console sem erros novos, testes/lint/build aprovados.
