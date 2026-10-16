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

- Usar uma sequência vertical de trapézios centralizados, com largura decrescente e altura compacta.
- Aproximar o acabamento da referência metálica: superfície grafite, reflexos prateados discretos e separadores sem aparência de cartão colorido.
- Usar um pequeno ponto de cor por etapa para preservar a leitura do avanço sem transformar o funil em um arco-íris.
- Garantir contraste alto com tipografia branca sobre a superfície metálica escura.
- Evitar rótulos externos que obriguem o usuário a cruzar linhas; os dados essenciais ficam dentro do bloco.
- Manter tooltip, foco por teclado e `aria-label` com o resumo completo da etapa.
- Em telas estreitas, preservar a leitura com área interna rolável e largura mínima controlada, sem overflow horizontal na página.

## Critérios de aceite

1. O funil abre no modo visual.
2. Cada bloco contém nome, quantidade, percentual, tempo médio e valor.
3. A largura diminui da primeira para a última etapa e a altura não domina o card.
4. O acabamento é grafite/metálico, com ponto de cor por etapa.
5. Os números renderizados são os mesmos da tabela e do `FunnelAnalytics`.
6. O total e o estado de indisponibilidade continuam visíveis.
7. A tabela pode ser reativada pelo switch.
8. Modo claro e escuro mantêm contraste, bordas e foco visíveis.
9. Não há alteração em integrações, sincronização, regras de negócio ou dados.

## Execução aplicada

- `src/components/funnel-analysis/FunnelStageDistribution.tsx`: modo visual padrão, métricas internas, trapézios responsivos e contraste adaptativo.
- `src/lib/funnelStageDistribution.ts`: token de cor de texto para as etapas claras.
- `src/components/funnel-analysis/FunnelStageDistribution.test.ts`: cobertura do comportamento visual existente e do contrato de largura/paleta.
