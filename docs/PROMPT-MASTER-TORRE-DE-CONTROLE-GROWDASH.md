# Prompt master — Torre de Controle Growdash

## Engenharia do prompt

Este documento transforma a visão de produto em um contrato executável para uma entrega incremental, auditável e sem números fictícios.

### 1. Intenção de produto

Evoluir o dashboard da Growdash para uma torre de controle multi-conta: o gestor deve descobrir primeiro o que exige ação, entender o impacto financeiro, receber uma próxima ação clara e conseguir navegar até a origem do problema.

### 2. Princípios de decisão

1. **Dados reais antes de automação:** usar somente consultas e métricas já protegidas por RLS; ausência de dado vira “sem dados suficientes”, nunca uma previsão inventada.
2. **Exceção antes de detalhe:** ordenar por severidade e impacto financeiro, deixando o detalhe de campanha a um clique.
3. **Explicabilidade:** cada sinal deve responder o que aconteceu, por que aconteceu e o próximo procedimento.
4. **Escopo por workspace:** nunca misturar contas, clientes, permissões ou layouts de outro workspace.
5. **Progressivo e reversível:** adicionar a torre ao dashboard atual sem reescrever o editor de KPIs, com fallback para estados vazios e erros.
6. **Microcopy consistente:** usar a linguagem de aviação da marca sem sacrificar clareza operacional.
7. **Performance:** memorizar agregações, evitar novas consultas quando os dados já estão no cache e não refazer métricas durante interação visual.

### 3. Contrato de saída esperado

Para cada conta visível, o motor deve produzir:

- `healthScore` de 0 a 100 e faixa `em rota`, `atenção`, `desvio de rota` ou `emergência`;
- campanhas ativas, investimento, leads, CPL, autonomia de orçamento e qualidade da integração;
- impacto financeiro estimado em risco, sempre baseado em gasto real e alvo de CPL;
- tendência/aviso conservador para os próximos dias quando houver histórico mínimo;
- uma única causa principal deduplicada e a próxima melhor ação com link para o módulo correto;
- um índice de oportunidade relativo às contas visíveis, sem prometer resultado.

### 4. Escopo executado nesta entrega

- Radar Growdash no topo do dashboard.
- Health Score por conta/cliente, com filtros por status.
- Inbox de exceções deduplicada por conta e causa, ordenada por impacto.
- Autonomia de orçamento e previsão conservadora de queda.
- Próximo procedimento acionável com links para Campanhas, Integrações e Saúde dos dados.
- Ranking de oportunidade relativo ao conjunto de contas visíveis.
- Relatório compartilhável com nome e assinatura do workspace, preservando o banner próprio já existente.
- Estados de carregamento, vazio e erro sem bloquear o restante do dashboard.
- Testes unitários do contrato de dados e da deduplicação.

### 5. Roadmap explicitamente dependente de infraestrutura

Portal completo com login próprio, domínio white-label, Web Push com aplicativo fechado, digest WhatsApp/e-mail, escalonamento multicanal, SLAs persistidos, tarefas automáticas, benchmark estatístico, redistribuição automática de verba e previsões de IA exigem migrations, jobs/cron, credenciais OAuth/mensageria ou histórico suficiente. A interface deve preparar esses pontos, mas não fingir que foram ativados.

## Prompt master executado

> Você é um engenheiro sênior de produto, dados e frontend da Growdash. Trabalhe apenas no repositório seguro e preserve o dashboard, o editor de widgets, RLS e o design atual. Audite as fontes existentes antes de alterar código. Crie um contrato determinístico para a Torre de Controle Growdash usando contas, diagnósticos de campanhas, orçamento e métricas já carregadas. Entregue um Radar multi-conta com Health Score 0–100, estados Em rota/Atenção/Desvio de rota detectado/Emergência, Inbox deduplicada e ordenada por impacto financeiro, autonomia de orçamento, previsão conservadora de risco, ranking relativo de oportunidades e Próximo procedimento explicável. Respeite usuário, workspace e permissões; não exponha dados de outra conta; não invente números. Integre no topo de `src/pages/Index.tsx` sem duplicar consultas desnecessárias e sem quebrar o modo de edição dos KPIs. Use microcopy de torre de controle. Cubra a lógica com Vitest, trate estados de carregamento/erro/vazio, execute typecheck, lint, testes, build e diff check. Registre arquivos, causa raiz, validações, bloqueios externos e só depois faça commit, push e publicação no Cloudflare Pages. Não marque como concluídos recursos que dependam de secrets, migrations ou serviços externos ainda indisponíveis.

## Critérios de aceite

- Uma conta com campanha saudável aparece como **Em rota**.
- Uma conta com CPL acima do alvo aparece como **Atenção** ou **Desvio de rota detectado**, sem duplicar o mesmo alerta.
- Uma campanha sem leads após gasto mínimo aparece como **Emergência** e informa o gasto em risco.
- Conta sem saldo suficiente informa dias de autonomia e **Combustível baixo**.
- Token ou sincronização inválida aponta para **Torre sem sinal** e leva a `/integracoes` ou `/saude-dos-dados`.
- O resumo pode ser usado em 375px sem overflow horizontal.
- Os testes não dependem de Supabase, OAuth, IA ou dados fictícios.
