# Design QA — funil metálico RD

## Referência

- Fonte: `/var/folders/h9/bngn7l491hl8tzl1w97rfpn80000gn/T/TemporaryItems/NSIRD_screencaptureui_gIBIIh/Captura de Tela 2026-10-20 às 14.01.23.png`
- Implementação: `https://growdash.com.br/analise-de-funis`
- Estado: conta CA02 — DRA RANNIELY SILVA, período Hoje, modo Visual
- Viewport observado: Chrome desktop, 1904 × 953 px

## Comparação

- A referência usa um funil escuro com segmentos metálicos, rails cromados e laterais retas inclinadas.
- A implementação mantém as oito etapas reais do RD, mas cada etapa agora usa um trapézio com `clip-path`, com recuo horizontal de 68 px para a altura de 68 px (aproximação de 45°).
- O fundo, os highlights, a sombra, a base e os rails permanecem escuros/metálicos; os textos, totais, percentuais, tempo médio, valor e tooltips continuam ligados aos dados reais.
- O espaçamento entre os segmentos foi zerado para que as etapas se encostem como uma única silhueta, sem voltar aos cartões arredondados.
- A regra mobile usa recuo de 52 px e remove a largura mínima para manter a geometria sem criar scroll horizontal dentro do card.

## Verificações

- `git diff --check`: aprovado
- `npx tsc --noEmit`: aprovado
- `npm run lint -- --quiet`: aprovado
- `npm run build`: aprovado
- Domínio principal retornou HTML 200 com `assets/app-Bp5Qkvd-.js` e `assets/index-CndQTfo4.css`.
- Screenshot live confirmou laterais diagonais retas, rails cromados e a base do funil; os dados visíveis permaneceram `4 negociações`, `Lead Novo 1`, `Sem contato 1` e `Venda Realizada 2`.

## Histórico de correções

1. Removidos os cartões coloridos e aplicado acabamento escuro metálico.
2. Removidas as bordas arredondadas e adicionada a silhueta trapezoidal com laterais inclinadas.
3. Segmentos encostados e rails reposicionados para reproduzir a referência sem alterar o contrato de dados.

final result: passed
