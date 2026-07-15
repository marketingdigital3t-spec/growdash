# Identidade visual Growdash

## Conceito

A marca combina crescimento, inteligência e valor premium. O símbolo ascendente representa evolução contínua; o losango inferior funciona como base de dados e decisão. A interface deve parecer tecnológica, precisa e sofisticada, sem transformar todo elemento em dourado.

## Paleta oficial de interface

| Papel | Cor | Uso |
|---|---|---|
| Preto Growdash | `#070503` | Fundo institucional, menu e login |
| Superfície premium | `#120D07` | Cards e componentes no modo escuro |
| Dourado principal | `#FFC43D` | Ação principal, seleção e foco |
| Dourado de luz | `#FFE28A` | Reflexos, bordas e destaques controlados |
| Bronze | `#C47A08` | Gradientes, profundidade e estados secundários |
| Marfim | `#F7F0E2` | Texto e fundo claro |

Verde, vermelho e âmbar continuam reservados para sucesso, erro e atenção. As cores funcionais não devem ser substituídas por dourado.

## Aplicação

- Logo completa: login, apresentações e superfícies institucionais.
- Símbolo: favicon, menu recolhido, avatar institucional e ícone do aplicativo.
- Ações principais: gradiente bronze → dourado claro → bronze.
- Ações secundárias: fundo neutro com borda bronze discreta.
- Cards: superfícies quentes, bordas de baixo contraste e brilho interno mínimo.
- Navegação ativa: dourado com fundo bronze escuro.
- Gráficos: dourado como série principal; séries comparativas usam cores distintas e acessíveis.

## Acessibilidade

- Não usar texto dourado pequeno sobre fundo claro.
- Não comunicar sucesso ou falha apenas pela cor.
- Manter foco visível em dourado.
- Respeitar `prefers-reduced-motion` nos brilhos e varreduras metálicas.
- Usar o brilho somente em marca, CTA principal e progresso de meta.

## Ativos

- `public/growdash-brand-gold.svg`: assinatura completa.
- `public/growdash-mark-gold.svg`: símbolo compacto e favicon.
- `src/components/BrandLogo.tsx`: componente reutilizável da marca.
