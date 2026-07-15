# PROMPT MASTER — Restauração visual e funcional Growdash por imagens

Você é um engenheiro full-stack sênior e product designer especialista em React, TypeScript, Tailwind, Supabase e SaaS de marketing. Reconstrua as telas da Growdash usando as 11 imagens fornecidas como fonte de verdade visual, preservando as integrações e dados reais existentes. Não invente números e não substitua consultas reais por mocks.

## Identidade visual obrigatória

- Fundo preto profundo `#030303`, superfícies entre `#080808` e `#101010`, bordas finas douradas/cinzas e destaque principal em gradiente dourado.
- Texto principal branco, secundário cinza e estados semânticos verde, amarelo e vermelho.
- Botões primários com gradiente `#ffe279 → #ffc331 → #e88d06`, texto escuro, brilho discreto e foco acessível.
- Cards com raio entre 12 e 16 px, sem sombras claras e sem fundo branco no tema escuro.
- Tema claro deve continuar funcional usando tokens; não hardcode texto branco fora das superfícies exclusivamente escuras.
- Mobile: nenhuma tabela pode ultrapassar a viewport sem scroll explícito; controles devem quebrar linha e cards devem virar uma coluna.

## Mapeamento imagem → rota

### Imagem 1 — `/auth`

- Tela centralizada com fundo preto e faixas/luzes douradas abstratas.
- Logo Growdash completa no topo, título “Bem-vindo(a)” e abas Entrar/Cadastrar.
- Inputs grandes com ícones dourados para email e senha, botão de visibilidade e link de recuperação.
- CTA dourado de largura total com seta.
- Divisor “OU”, botões Google e Apple.
- Cadastro deve pedir nome, email, senha e confirmação.
- Login, cadastro, recuperação e OAuth devem usar Supabase real; erros não podem expor detalhes internos.

### Imagens 3 e 4 — `/financeiro`

- Manter seletor global Infoproduto/SaaS; todos os cálculos e consultas devem respeitar `business_unit_id`.
- Cabeçalho com período, empresa e novo lançamento.
- KPIs: receita, despesas, lucro, margem, cartões e tráfego.
- Abas: DRE, Dashboard, Previsão, Por conta, Investimento em tráfego, Lançamentos, Cartões e Empresas.
- DRE em duas colunas: demonstrativo detalhado e resultado por empresa/conta.
- Linhas do DRE: receita bruta, tráfego pago, imposto Meta configurável, outros impostos, folha/equipe, software/SaaS, materiais, outras despesas, resultado e margem.
- Nunca misturar Infoproduto e SaaS. Mostrar a unidade ativa claramente.

### Imagens 2 e 3 — `Financeiro > Investimento em tráfego`

- Planejador por mês/ano e marca/conta.
- Colunas editáveis: investimento mensal, semanal, percentual Meta, Meta/semana, Google/semana, CPL alvo, leads/mês, leads/semana e leads/dia.
- Fórmulas automáticas e totais dourados.
- Aportes por semana (até cinco semanas), separados em Meta e Google.
- Popup “Novo aporte” com conta, plataforma, data, valor e observação.
- Histórico por conta com exclusão confirmada.
- Resumo do mês com total planejado, aportado, disponível, semanal, Meta/semana, Google/semana e projeção de leads.
- Persistir planos e aportes por workspace/unidade/mês; aplicar RLS e impedir duplicação.

### Imagem 5 — `/campanhas?aba=funnels`

- Manter as quatro abas superiores do Tráfego Pago.
- Categorias: Reconhecimento, Tráfego, Engajamento, Leads, Promoção de App e Vendas, cada uma com badge “10”.
- Cada funil deve aparecer expandido horizontalmente: bloco de identificação à esquerda, botão “Selecionar este funil” e etapas em cards conectados por setas.
- Cada etapa possui ícone, número, nome, objetivo/descrição e borda dourada discreta.
- Em mobile, etapas devem ser uma trilha vertical; não esconder conteúdo.
- O botão selecionar cria/atualiza um playbook em rascunho; não publica campanha automaticamente.

### Imagens 6 e 8 — `/analise-de-funis`

- Cabeçalho com título, descrição, saúde da integração e CTA “Sincronizar do RD”.
- Filtros em painel único: conta, funil, período, origem, campanha, estado, responsável e produto.
- Oito KPIs em duas linhas de quatro.
- Primeira linha analítica: donut e tabela de distribuição por etapa; gráfico horizontal e lista de avanço entre etapas.
- Estados vazio, carregando, parcial e erro precisam preservar o mesmo layout.
- Nenhum estágio, lead ou conversão pode ser calculado fora do funil/período selecionado.

### Imagem 9 — `/agenda-turmas`

- Abas superiores “Datas & Turmas” e “Agenda”.
- Cabeçalho com ícone, descrição e CTA dourado “Nova turma”.
- Sete KPIs: turmas, abertas, esgotadas, pessoas, pacientes, vagas e críticas.
- Busca e filtros de status/funil na mesma linha no desktop.
- Vazio com ícone central e CTA.
- Aba Agenda precisa organizar turmas por data e apresentar próximos eventos; usar dados reais.

### Imagens 7, 10 e 11

- Usar como referência transversal do padrão de tabela, relatório diário, sidebar compacta, abas, KPIs e planos.
- Não duplicar rotas que já existem; aplicar apenas linguagem visual e comportamento correspondente.

## Dados e segurança

- Toda tabela nova deve ter `workspace_id`, `business_unit_id`, timestamps, índices, RLS e chaves únicas idempotentes.
- Novas tabelas: `traffic_investment_plans` e `traffic_investment_contributions`.
- Aportes não são gasto real; nunca misturar planejado/aportado com insights da Meta/Google.
- Inputs monetários usam `numeric`; datas em UTC e exibição no fuso do workspace.
- Exclusões de aportes exigem confirmação e só owner/admin/financial pode executar.
- Funis selecionados criam rascunhos em `traffic_playbooks`.
- OAuth social usa Supabase; nenhum segredo no navegador.

## Critérios de aceite

1. As seis áreas reproduzem hierarquia, espaçamento, composição e cores das referências.
2. Login funciona por email/senha, recuperação, cadastro e OAuth configurado.
3. DRE muda quando o seletor Infoproduto/SaaS muda e não mistura contas.
4. Planejamento e aportes recalculam totais imediatamente e persistem após migration.
5. Os 60 funis aparecem no formato de trilha horizontal/vertical.
6. Análise de Funis mantém filtros, KPIs e dois painéis principais no topo.
7. Datas & Turmas possui duas abas e agenda real.
8. Layout funciona em 390, 768, 1024 e 1440 px.
9. Build, lint e testes passam sem novos erros.
10. Recursos ainda dependentes de migration/API mostram configuração necessária, nunca dados falsos.

## Ordem de execução

1. Criar migration aditiva e modelos de planejamento/aportes.
2. Refazer Auth.
3. Implementar planejador financeiro e DRE por unidade.
4. Refazer cards dos Funis de Tráfego.
5. Restaurar topo da Análise de Funis.
6. Restaurar Datas & Turmas e criar Agenda.
7. Testar fórmulas, responsividade, tema e build HTML.

