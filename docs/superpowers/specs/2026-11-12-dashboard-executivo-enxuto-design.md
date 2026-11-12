# Dashboard Executivo Enxuto — Design

## Intenção

Transformar a tela inicial da Growdash em um painel executivo de leitura imediata, inspirado na referência visual enviada em 12/11/2026: fundo espacial com a Terra no canto superior direito, blocos azul-noite translúcidos, alto contraste e hierarquia visual clara.

O Dashboard deve responder em poucos segundos:

1. Quanto investi em mídia?
2. Quantos leads entraram?
3. Quanto custou cada lead?
4. Quanto vendi/faturei?
5. Onde está o gargalo que exige ação?

A tela atual mistura `DashboardGlassStrip` com sete métricas, `MissionDashboard` com quatro KPIs duplicados, funil orbital, radar, alertas de turmas e uma grade configurável de widgets. Isso cria repetição, excesso de contexto e disputa visual. A nova tela terá uma única hierarquia executiva.

## Objetivos

- Reduzir a primeira tela a quatro KPIs financeiros/comerciais e um bloco de funil.
- Usar exclusivamente dados reais já calculados por `src/pages/Index.tsx`; nunca exibir números fictícios.
- Manter o escopo global existente de período, conta Meta, funil RD e unidade de negócio.
- Preservar a Terra/fundo espacial e o material cósmico azul-noite já adotado no shell.
- Tornar estados `loading`, `unavailable`, `partial` e `stale` explícitos sem transformar ausência de dados em zero.
- Garantir leitura confortável em desktop, tablet e mobile.

## Não objetivos

- Não criar novas consultas ao Supabase.
- Não alterar cálculo de Meta, RD, vendas, receita, CPL ou ROAS.
- Não remover o editor de Dashboard e a grade configurável do código nesta primeira entrega; eles deixam de ser renderizados na home até uma decisão posterior.
- Não adicionar gráficos, mapa, ranking, calendário, radar complexo, feed de alertas ou tabelas à primeira dobra.
- Não criar novos módulos, rotas, permissões ou feature flags.

## Antiobjetivos

- Não repetir a mesma métrica em duas faixas diferentes.
- Não usar fallback numérico fictício quando uma fonte ainda não confirmou o dado.
- Não manter sete cards pequenos competindo com os quatro KPIs principais.
- Não deixar o funil orbital 3D dominar a leitura dos valores executivos.
- Não exibir widgets de operação que o usuário não pediu na tela inicial.

## Experiência proposta

### Estrutura da tela

1. **Cabeçalho compacto**
   - Eyebrow: `VISÃO EXECUTIVA`.
   - Título: `Dashboard`.
   - Subtítulo curto: `Sua operação em uma leitura.`
   - A barra global do shell continua responsável por período, conta, funil e ações de escopo.
   - Remover a frase longa de última sincronização do título; o estado de sincronização aparece na linha de status dos dados.

2. **Linha de status de dados**
   - Uma linha discreta com período selecionado, fonte (`Meta Ads + RD Station`) e horário da última sincronização confirmada.
   - Em erro/atualização parcial, mostrar aviso curto e ação de retry sem ocupar um card grande.

3. **Quatro KPIs, exatamente nesta ordem**
   - `Investimento`: gasto Meta no período.
   - `Leads`: leads canônicos confirmados.
   - `CPL`: investimento dividido pelos leads confirmados.
   - `Faturamento`: receita líquida/bruta segundo a fonte canônica já usada em `Index.tsx`, com quantidade de vendas no detalhe.

   Cada KPI tem:
   - título pequeno em uppercase;
   - valor grande e tabular;
   - detalhe curto (fonte, período ou vendas);
   - ícone discreto;
   - estado visual de disponibilidade;
   - nenhum sparkline inventado ou variação percentual sem comparação real.

4. **Bloco principal de conversão**
   - Um único painel `Funil do período` com quatro etapas horizontais no desktop e verticais no mobile:
     `Visitantes → Leads → Oportunidades → Clientes`.
   - Mostrar quantidade em cada etapa e taxa de conversão somente quando o denominador estiver confirmado.
   - Oportunidades devem manter a regra atual de filtrar etapas operacionais do RD.
   - Sem foguete 3D dentro do bloco; a Terra e a atmosfera já cumprem o papel de imersão no fundo.

5. **Bloco de ação executiva**
   - Um painel curto `Próxima ação` derivado do gargalo mais relevante já disponível.
   - Quando não houver alerta confiável, mostrar `Tudo sob controle no recorte atual`.
   - Link permitido somente para rotas ativas: `/campanhas`, `/crm`, `/analise-de-funis`, `/integracoes` ou `/saude-dos-dados`.
   - Não incluir agenda, automação, mídia social, marcas, produtos, anúncios, chamados ou WhatsApp.

### Dados permitidos na home

| Dado | Fonte existente | Exibição |
|---|---|---|
| Investimento Meta | `dashboardMeta.data.spend` / `dashboardInsights` | KPI 1 |
| Leads canônicos | `dashboardMeta.data.formLeads + siteLeads + conversations` | KPI 2 |
| CPL | investimento / leads | KPI 3 |
| Faturamento | `aggregateRevenueSources` | KPI 4 |
| Vendas | `glassSales.totalQuantity` | detalhe do KPI Faturamento |
| Visitantes | impressões de `dashboardInsights` | Funil |
| Oportunidades | `dashboardDeals` com regra atual de estágio | Funil |
| Clientes | vendas confirmadas | Funil |
| Status de sincronização | `dashboardMetricAvailability`, queries Meta/RD | status line |
| Gargalo/próxima ação | dados já presentes em alertas/analytics | bloco de ação |

### Dados proibidos na home

- Números estáticos por fase (`45.000`, `1.582`, `49.700`, etc.) como fallback visível.
- Métricas duplicadas em `DashboardGlassStrip` e `MissionDashboard`.
- `Previsão 30d`, a menos que seja explicitamente reintroduzida numa decisão posterior.
- Impressões como KPI isolado.
- Calendário, turmas, tickets, WhatsApp, automações, armazenamento, anúncios, marcas, produtos, mídia social e inteligência de agentes.
- Qualquer zero apresentado quando a métrica está `unavailable` ou sem snapshot.

## Regras de estado

- `loading`: skeleton com a mesma altura dos quatro KPIs e do funil.
- `fresh`: valor real normal.
- `stale`/`partial`: último valor confirmado + selo discreto `Atualizando` ou `Reconciliação pendente`.
- `unavailable`: `Indisponível` + motivo curto e link para Integrações/Saúde dos Dados.
- `empty`: empty state orientado à ação (`Conecte uma conta Meta` ou `Vincule um funil RD`), sem números fictícios.
- Dados de vendas e Meta podem aparecer com estados independentes; uma falha do RD não deve zerar o investimento Meta.

## Direção visual

- Usar o shell visual existente: `data-space-phase="terra"`, fundo da Terra, cards azul-noite translúcidos.
- Uma grade de quatro cards com `minmax(0, 1fr)` no desktop; dois por linha em tablet; uma coluna no mobile.
- Cards com o token visual já definido: gradiente profundo, borda azul `rgba(46,123,255,.28)`, glow apenas no hover/foco.
- Tipografia: valor em `tabular-nums`, título pequeno e alto contraste, detalhes muted.
- Espaçamento amplo; no máximo dois painéis de conteúdo abaixo dos KPIs.
- Não usar `filter: grayscale`, fundos cinza ou gradientes dourados na Fase Terra.
- A Terra deve permanecer como atmosfera, não como elemento que cubra texto ou controles.

## Arquivos previstos

- `src/pages/Index.tsx`: reduzir a composição renderizada na home e passar somente os dados executivos.
- `src/components/dashboard/MissionDashboard.tsx`: transformar no componente visual único de KPIs + funil + próxima ação, removendo fallback numérico fictício e o radar/foguete interno.
- `src/components/dashboard/MissionDashboard.test.tsx`: atualizar contratos para quatro KPIs, funil e estados de disponibilidade.
- `src/components/dashboard/DashboardExecutive.test.tsx`: teste de contrato/renderização para garantir ausência da faixa duplicada e dos dados proibidos.
- `src/index.css`: apenas regras específicas do novo layout, reutilizando tokens existentes; não reabrir a cascata global inteira.
- `tests/visual/growdash.spec.ts`: atualizar expectativas de conteúdo apenas se necessário; manter os testes de viewport.

## Critérios de aceite

- A home renderiza exatamente quatro KPIs executivos: Investimento, Leads, CPL e Faturamento.
- Não existe segunda faixa de sete métricas na home.
- Nenhum número hardcoded aparece no Dashboard renderizado.
- O funil mostra Visitantes, Leads, Oportunidades e Clientes com taxas coerentes.
- Falhas de Meta/RD mantêm o último snapshot e mostram estado honesto.
- A ação sugerida nunca aponta para uma rota removida.
- O fundo Terra e os cards cósmicos continuam visíveis sem prejudicar contraste.
- Desktop, tablet e mobile passam os testes visuais existentes.
- Build e suíte de testes passam antes do merge.

## Decisões do planejamento

- **Escopo:** primeira dobra executiva, não uma reescrita de todos os widgets do produto.
- **Fonte de verdade:** os dados já consolidados por `Index.tsx`; a implementação não adicionará chamadas.
- **Fallbacks:** retirar os defaults numéricos de `MissionDashboard`; ausência de dado é estado, não valor.
- **Visual:** manter a identidade Terra existente e simplificar a quantidade de componentes visíveis.
- **Branch:** a implementação deve acontecer em uma branch dedicada criada a partir da `main` atual, sem alterar a `main` até aprovação.
