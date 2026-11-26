# Relatório de responsividade — 15/07/2026

## Escopo corrigido

- Dashboard e indicadores sem sobreposição entre título, valor e ícone.
- Grades adaptativas pela largura real do conteúdo, considerando a barra lateral.
- Widgets do dashboard em fluxo natural até 1279 px, evitando cartões espremidos em tablets e notebooks estreitos.
- Cards de Dashboard, Comercial, CRM, Perfil, Armazenamento e Tráfego com proteção contra overflow.
- Cabeçalhos, ações, formulários, abas e botões adaptados para telas estreitas.
- Tabelas preservadas em contêiner com rolagem horizontal própria, sem alargar a página inteira.
- Diálogos e formulários com empilhamento adicional abaixo de 420 px.
- Menus e listas de abas preservados fora da regra automática destinada aos cards.

## Faixas adotadas

- Mobile pequeno: até 419 px.
- Mobile: até 767 px.
- Tablet e notebook estreito: 768–1279 px.
- Desktop: a partir de 1280 px.

## Validações

- `git diff --check`: aprovado.
- Testes automatizados: 12/12 aprovados.
- Build de produção: aprovado.
- Build HTML local: aprovado.
- ESLint direcionado: sem erros; avisos preexistentes não bloqueantes.

## Observação

Os nomes completos dos indicadores continuam disponíveis no atributo `title` quando a largura exigir truncamento. No mobile, os títulos podem ocupar duas linhas, mas nunca invadem o ícone ou outro card.
