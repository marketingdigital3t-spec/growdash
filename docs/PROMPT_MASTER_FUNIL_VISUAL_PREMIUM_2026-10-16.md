# Prompt master — funil visual premium com métricas internas

## Objetivo

Reestruturar a distribuição por etapa da Análise de Funis para que o gráfico seja um funil reconhecível, elegante e útil para decisão. Cada etapa deve aparecer como um trapézio proporcional à posição no funil e conter, dentro do próprio bloco, o nome da etapa, quantidade de leads, percentual do total, tempo médio e valor em negociação.

## Regras de produto

- Manter RD Station como fonte canônica dos números exibidos.
- Não alterar consultas, filtros, escopo de conta, período, deduplicação ou regras de oportunidade/venda.
- O total deve continuar sendo a soma das etapas do recorte selecionado.
- “Indisponível” e “Sem valor” devem permanecer explícitos quando o dado não existir.
- O modo visual deve ser a visualização inicial; a tabela continua disponível para conferência detalhada.

## Direção visual

- Usar uma sequência vertical de trapézios centralizados, com largura decrescente.
- Aplicar progressão cromática de vermelho, laranja, amarelo e verde para reforçar o avanço do funil.
- Garantir contraste adaptativo: texto claro nas etapas escuras e texto escuro nas etapas claras.
- Evitar rótulos externos que obriguem o usuário a cruzar linhas; os dados essenciais ficam dentro do bloco.
- Manter tooltip, foco por teclado e `aria-label` com o resumo completo da etapa.
- Em telas estreitas, preservar a leitura com área interna rolável e largura mínima controlada, sem overflow horizontal na página.

## Critérios de aceite

1. O funil abre no modo visual.
2. Cada bloco contém nome, quantidade, percentual, tempo médio e valor.
3. A largura diminui da primeira para a última etapa.
4. Os números renderizados são os mesmos da tabela e do `FunnelAnalytics`.
5. O total e o estado de indisponibilidade continuam visíveis.
6. A tabela pode ser reativada pelo switch.
7. Modo claro e escuro mantêm contraste, bordas e foco visíveis.
8. Não há alteração em integrações, sincronização, regras de negócio ou dados.

## Execução aplicada

- `src/components/funnel-analysis/FunnelStageDistribution.tsx`: modo visual padrão, métricas internas, trapézios responsivos e contraste adaptativo.
- `src/lib/funnelStageDistribution.ts`: token de cor de texto para as etapas claras.
- `src/components/funnel-analysis/FunnelStageDistribution.test.ts`: cobertura do comportamento visual existente e do contrato de largura/paleta.
