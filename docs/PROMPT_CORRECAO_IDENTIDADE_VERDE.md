# Prompt de correção da identidade visual verde

## Objetivo

Manter a barra lateral preta e aplicar, em todo o conteúdo autenticado do Growdash, a identidade visual composta por verde esmeralda, preto/grafite e branco. O verde deve aparecer de forma consistente em ações, abas ativas, indicadores, gráficos e bordas sutis; não deve existir azul, ciano ou roxo como cor de marca.

## Escopo

- Dashboard (`/`)
- Painel do Expert (`/painel-expert`)
- CRM (`/crm`)
- Comercial (`/comercial`)
- Componentes compartilhados de cards, filtros, tabelas, gráficos e estados vazios

## Contrato de cores

- Fundo escuro do conteúdo: verde-grafite quase preto.
- Cards e controles: grafite/verde-grafite com borda `rgba(16, 185, 129, .28)`.
- Ação primária e aba ativa: `#10B981`.
- Hover e destaque: `#34D399`.
- Texto: branco e cinza neutro, com contraste preservado.
- Vermelho e âmbar continuam reservados a erro, alerta e estados semânticos.
- A sidebar permanece preta e não deve herdar o fundo verde do conteúdo.

## Regras de implementação

1. Preferir tokens CSS (`--primary`, `--gd-emerald`, `--gd-content-*`) e classes semânticas.
2. Não alterar consultas, RLS, sincronizações ou contratos de dados para resolver cor.
3. Substituir cores hardcoded azuis/douradas em gráficos e componentes do escopo.
4. Garantir que modo claro e escuro usem o mesmo acento verde, com superfícies adequadas ao contraste.
5. Respeitar `prefers-reduced-motion` e não criar overflow horizontal.

## Critérios de aceite

- Ao navegar entre Dashboard, Painel do Expert, CRM e Comercial, o conteúdo apresenta verde visível e consistente.
- Não há azul/ciano/roxo como cor principal nas quatro telas.
- Cards, filtros e abas têm bordas verdes sutis; a sidebar continua preta.
- Gráficos e ícones de ação usam verde sem alterar valores, fontes ou filtros.
- O build, lint, typecheck e testes existentes continuam passando.
- A validação visual deve ser feita em cada rota após reload, nos modos escuro e claro.
