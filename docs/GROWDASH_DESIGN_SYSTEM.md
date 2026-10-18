# Growdash — design system visual

Este documento é o contrato visual das fases de redesign. Ele não altera
contratos de dados, rotas, permissões ou integrações.

## Escala

| Categoria | Tokens |
|---|---|
| Espaçamento | `--gd-space-1` a `--gd-space-8`: 4, 8, 12, 16, 24, 32, 48, 64px |
| Tipografia | Display 34/700, título 28/700, subtítulo 22/600, H3 18/600, corpo 16/400, secundário 14/400, label 12/500, micro 11/500 |
| Linha | Títulos 1.2; corpo 1.5 |
| Raios | Card 16px; controle 10px; pill 999px; modal 20px |
| Elevação | Nível 0 superfície; Nível 1 card flutuante; Nível 2 overlay/modal |
| Ícones | Família Lucide existente; 16/20/24px; stroke padrão 1.75 |

## Z-index

`base-image (0) → scrim (1) → conteúdo (10) → header sticky (100) → drawer
(200) → modal (300) → toast (400)`.

## Cores semânticas

Os tokens de tema existentes continuam sendo a fonte primária. Os aliases de
status preservam o significado já usado na plataforma:

- Crítico `#E74C3C`
- Atenção `#F39C12`
- Observação `#F1C40F`
- Estágio inicial `#3498DB`
- Saudável `#2ECC71`
- Inativa `#95A5A6`

## Regras de aplicação

1. O conteúdo deve usar o mesmo grid pai, com padding lateral de 24px no
   desktop e gaps de 16px, sem alterar a sidebar/header escuros.
2. Componentes de dados devem usar `gd-tabular` para números alinhados.
3. Estados de foco visível são obrigatórios; o foco usa o token `--ring` do
   tema ativo para preservar contraste e personalização.
4. Valores legados continuam permitidos fora das telas que estão sendo
   redesignadas até sua substituição gradual. Não é permitido fazer uma
   reescrita global apenas para satisfazer a escala.
