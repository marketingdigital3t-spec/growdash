# PROMPT MASTER — RELATÓRIO DE IA, DASHBOARD CANÔNICO E IDENTIDADE PREMIUM GROWDASH

Você é um engenheiro full-stack e product designer sênior, com mais de 15 anos de experiência em SaaS B2B, analytics, Meta Ads, RD Station, Supabase, Cloudflare, React, TypeScript, acessibilidade e interfaces responsivas. Trabalhe diretamente no projeto Growdash existente. Preserve integrações, dados reais, regras de segurança, RLS, rotas e funcionalidades já operacionais. Não recrie o projeto do zero e não substitua código estável por mocks.

## Objetivo

Entregar uma Growdash funcional, premium, responsiva e consistente, com:

1. estúdio de relatório de leads orientado por conta, período e métricas;
2. página compartilhável com KPIs, gráficos, leitura executiva e histórico;
3. Dashboard restaurado no padrão canônico completo da Growdash;
4. modo claro e escuro totalmente legíveis;
5. identidade visual luxuosa baseada no tema escolhido pelo usuário;
6. comportamento correto em desktop, tablet e mobile;
7. publicação segura no Supabase e Cloudflare.

## Regras inegociáveis

- Nunca misturar contas de anúncio em um relatório compartilhável.
- Nunca exibir credenciais, tokens, chaves ou segredos no frontend ou nos logs.
- Não apagar dados reais, integrações ou histórico durante migrações.
- Não usar valores mockados quando existe fonte real. Sem dados, renderizar o bloco com zero e um estado explicativo.
- Contagens de leads, vendas, cliques e impressões são inteiros. Moeda usa `pt-BR`; percentuais e índices usam a precisão adequada.
- Toda exclusão de relatório exige confirmação, deve respeitar workspace/usuário via RLS e invalidar o link público.
- O calendário e a conta são a única fonte de verdade para os dados do relatório.
- A interface não pode perder conteúdo, provocar overflow da página ou esconder controles em nenhuma largura suportada.

## 1. Relatório de IA e leads

### Cabeçalho e filtros

- Colocar seletor de conta de anúncio imediatamente ao lado do calendário.
- Reutilizar exatamente o componente e a semântica do calendário de Campanhas.
- Presets obrigatórios: Hoje, Ontem, Últimos 7 dias, Últimos 14 dias, Últimos 30 dias, Este mês, Mês anterior e Personalizado.
- Ao clicar em um preset, aplicar o intervalo imediatamente, fechar o seletor e atualizar todos os KPIs. Apenas “Personalizado” aguarda escolha manual.
- Exibir data inicial e final em `dd/MM/yyyy`, mas consultar as fontes em `yyyy-MM-dd` no fuso da conta.
- Se “Todas as contas” estiver selecionado, permitir explorar a tela, mas bloquear a geração do link com orientação para escolher uma conta específica.

### Métricas selecionáveis

Disponibilizar no mínimo:

- Investimento;
- Leads Meta;
- CPL;
- Impressões;
- Alcance;
- Frequência;
- Cliques;
- CPC;
- CTR;
- CPM;
- Taxa de conversão clique → lead;
- Negócios RD;
- Vendas;
- Receita;
- CAC;
- ROAS;
- Resultado (receita menos mídia);
- Cobertura RD/Meta.

Cada seletor deve ter descrição acessível. Os KPIs abaixo devem existir somente para as métricas selecionadas, atualizar imediatamente e manter a formatação correta.

### Página compartilhável

- Gerar uma experiência visual de relatório independente, com banner da marca, conta, período, KPIs, evolução diária, consolidado semanal e leitura automática.
- Persistir snapshot, métricas, período, conta e token público no Supabase.
- Manter histórico por conta, ordenado do mais recente para o mais antigo.
- Ações do histórico: abrir, copiar link e excluir.
- Ao excluir, confirmar a ação, remover o registro permitido pela RLS, invalidar o link e atualizar a lista sem recarregar a página.

## 2. Dashboard canônico

Restaurar a hierarquia visual completa, sem duplicações:

1. barra glass fixa com Faturamento, Investimento, Leads, CPL, ROAS, Previsão 30D e Vendas;
2. linha principal com Faturamento líquido, Gastos com anúncios, ROAS e Lucro líquido;
3. Vendas por pagamento, Distribuição por plataforma e mini KPIs de Margem, Recebíveis, Ticket médio e Lucro;
4. Performance de campanhas com objetivos e KPIs;
5. Funil de conversão;
6. Origem geográfica com mapa, tabela de estados e insights;
7. Evolução de performance;
8. CPL diário, investimento diário, leads por dia, conversão e CTR por criativo;
9. resultados de campanhas e criativos.

Use uma versão canônica de layout para reparar uma única vez preferências antigas que duplicaram widgets. Depois da migração, preserve personalizações futuras do usuário.

## 3. Identidade visual premium

- Fundo principal sóbrio, com textura e fumaça muito sutis na cor do tema; nunca transformar toda a página em amarelo/dourado.
- Cartões devem se separar do fundo por elevação, borda fina, highlight interno e contraste, não por grandes manchas coloridas.
- Ações principais usam gradiente metálico, brilho periférico controlado, reflexo animado e texto com contraste AA.
- Todos os temas — Dourado, Ametista, Azul imperial, Quartzo rosa, Safira, Obsidiana e Esmeralda — devem alterar logo, favicon, botões, seleções, gráficos, mapas, scrollbars, foco e detalhes glass através dos mesmos tokens semânticos.
- Modo claro: sidebar, topbar, labels, ícones, navegação e estados desabilitados precisam permanecer visíveis. Nunca forçar `text-white` em componentes que existem nos dois temas.
- Respeitar `prefers-reduced-motion` e remover animações decorativas quando solicitado pelo sistema.

## 4. Responsividade

### Desktop

- Conteúdo com margens pequenas e simétricas.
- Quatro KPIs principais em uma linha.
- Visão financeira em três regiões proporcionais.

### Tablet

- KPIs em duas colunas.
- Filtros podem rolar horizontalmente dentro de sua própria faixa, sem criar scroll horizontal na página.
- Gráficos mantêm altura útil e legendas legíveis.

### Mobile

- Uma coluna, controles com pelo menos 44 px, áreas seguras e sem informação cortada.
- Tabs e filtros podem usar scroll horizontal local.
- Tabelas complexas viram cartões ou mantêm scroll somente dentro do bloco.
- Nenhum menu, texto, botão, KPI, mapa ou gráfico pode desaparecer.

## 5. Segurança e dados

- RLS: relatórios privados só podem ser criados, lidos e excluídos pelo workspace autorizado; leitura pública somente pelo `share_token` e pela função/visão explicitamente prevista.
- Validar UUIDs, datas, conta pertencente ao workspace e lista de métricas no backend.
- Limitar tamanho do banner e tratar uploads inválidos.
- Paginar histórico e evitar payloads sem limite.
- Invalidar cache do React Query depois de criar ou excluir.

## 6. Critérios de aceite

- Clicar em “Últimos 7 dias” muda o intervalo e todos os KPIs sem clique extra.
- Trocar a conta muda dados, histórico e banner sem recarregar.
- Selecionar/desmarcar uma métrica adiciona/remove seu KPI instantaneamente.
- Exclusão remove o relatório e o link deixa de funcionar.
- Dashboard não apresenta widgets duplicados.
- Sidebar e topbar ficam legíveis nos modos claro e escuro.
- Build de produção conclui sem erro.
- Validar visualmente em 390×844, 768×1024, 1366×768 e 1920×1080.
- Publicar migrações no Supabase antes do frontend e conferir o domínio de produção após o deploy.

## Ordem de execução

1. auditar e preservar o estado atual;
2. implementar/migrar banco e RLS;
3. implementar o estúdio e histórico;
4. restaurar o Dashboard canônico;
5. corrigir temas e responsividade;
6. executar build, testes e QA visual;
7. publicar Supabase;
8. publicar Cloudflare;
9. verificar produção e somente então concluir.

