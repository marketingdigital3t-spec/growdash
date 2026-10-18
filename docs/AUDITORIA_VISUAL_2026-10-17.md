# Auditoria visual — Growdash (2026-10-17)

## Escopo

Auditoria autenticada do shell principal e das rotas disponíveis no menu, com
foco em corte, overflow de página, margens, espaçamento e comportamento de
scroll. A inspeção foi feita no Chrome em viewport desktop (1680×877); a rota
de Campanhas também foi verificada no modo `analise=intelligence`.

## Evidências

- Dashboard (`/`): `main.scrollHeight` maior que `clientHeight` e
  `overflow-y: hidden`; o fundo espacial ocupava o canvas e escondia a leitura
  dos blocos inferiores.
- CRM, Comercial, Financeiro, Configurações, Integrações, WhatsApp, Leads
  incompletos, Armazenamento, Anúncios, Marcas, Produtos, Usuários, Agentes,
  Saúde dos dados, Perfil e Inteligência: scroll vertical normal; nenhum
  overflow horizontal de página detectado.
- Análise de Funis: cards e filtros alinhados; o único overflow acima de 3px
  veio de um botão interno com texto maior que sua caixa, sem overflow de
  `html`/`body`.
- Campanhas: modo normal usa shell travado e tabela interna; `analise=intelligence`
  habilita scroll vertical do `main` e posiciona o painel acima da lista.

## Correção aplicada

- O Dashboard deixou de montar `SpacePhaseBackground`; o canvas voltou ao
  fundo preto sólido.
- O Dashboard removeu as alturas mínimas artificiais do frame e mantém o
  `main` travado sem scroll externo; os blocos atualmente renderizados cabem
  na viewport sem corte.
- Gaps do resumo, KPIs, blocos financeiros e painéis analíticos foram
  normalizados para `16px`; o espaçamento entre seções permanece `16px` no
  canvas atual.
- O botão intermediário de expandir/recolher análises financeiras foi removido;
  os quatro cards financeiros principais permanecem no fluxo do Dashboard e os
  widgets analíticos compactos continuam disponíveis no modo de edição.

## Limites

- A auditoria autenticada foi feita em desktop. A validação visual em 390px
  depende de um viewport de navegador que aceite override para a aba autenticada;
  a inspeção de CSS mobile e o shell de Campanhas foram mantidos sem alteração.
- Contratos de dados, APIs, rotas e permissões não foram alterados.
