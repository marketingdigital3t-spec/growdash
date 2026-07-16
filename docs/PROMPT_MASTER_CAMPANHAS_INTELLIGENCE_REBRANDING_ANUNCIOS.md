# PROMPT MASTER — Campanhas, Growdash Intelligence, rebranding e anúncios globais

Você é um engenheiro de software sênior full-stack, product designer e especialista em Meta Ads. Trabalhe no projeto Growdash existente, preservando integrações, autenticação, RLS, filtros globais, dados reais e responsividade. Não substitua componentes funcionais por mocks, não remova funcionalidades para “simplificar” e não grave tokens ou segredos no frontend.

## Objetivo

Evoluir a Growdash para uma experiência premium e coerente, com o gerenciador de campanhas inspirado na hierarquia operacional do Meta Ads Manager, dois modos de análise claramente separados, identidade visual consistente em dark/light mode e um módulo administrativo de anúncios globais segmentados por tela e período.

## 1. Gerenciador de campanhas

Na tabela desktop, a ordem obrigatória é:

1. caixa de seleção;
2. status com controle Desativado/Ativado;
3. nome da campanha;
4. métricas configuráveis.

As três primeiras colunas são estruturais e não podem ser ocultadas por presets. Elas devem permanecer `sticky` durante a rolagem horizontal, com offsets calculados a partir das larguras redimensionáveis, `z-index` correto, fundo opaco por linha e separador visual após “Campanha”. Cabeçalho e corpo devem ficar perfeitamente alinhados. A seleção nunca pode abrir o detalhe da campanha por propagação acidental do clique.

No mobile, manter cards próprios em vez de comprimir a tabela. Nenhum texto, botão, gráfico ou seletor pode ultrapassar a viewport. Conjuntos e anúncios devem abrir sem exigir seleção de campanha; a seleção é apenas um filtro descendente opcional.

## 2. Análises e Intelligence

Criar dois botões mutuamente exclusivos:

- **Análises**: somente saúde operacional. Exibir Crítico, Atenção, Observação, Estado inicial, Saudável e Inativas. No desktop, os seis indicadores ficam em uma linha. Clicar em um indicador abre abaixo apenas as campanhas daquela classificação, com investimento, resultados, custo por resultado, CTR, conta/BM, idade e meta de CPL.
- **Intelligence**: análise quantitativa. Exibir Impressões, CTR, Investimento, Leads, CPL, ROAS, CPM, Cliques, CPC e Taxa de resultado. Abaixo, renderizar gráficos diários de investimento × leads e eficiência (CTR, taxa de resultado, CPC e CPL), usando insights reais do período e da conta selecionados. Não inventar valores quando não existirem dados.

Fórmulas obrigatórias:

- CTR = cliques / impressões × 100;
- CPC = investimento / cliques;
- CPM = investimento / impressões × 1.000;
- CPL = investimento / leads;
- ROAS = receita atribuída / investimento;
- taxa de resultado = leads / cliques × 100.

Tratar denominador zero sem `NaN`, `Infinity` ou valores enganosos. Respeitar conta, período, unidade, segmento e filtros globais. Manter a leitura por IA abaixo dos gráficos, identificada como recomendação, sem misturá-la com os valores determinísticos.

## 3. Identidade visual premium

Centralizar cores em tokens semânticos. A marca usa preto profundo, superfícies grafite/marrom, bronze e dourado, com marfim para texto. No dark mode, botões primários e dourados devem usar bronze suficientemente escuro com texto marfim; nunca usar texto preto sobre botão dourado no modo escuro. No light mode, garantir contraste AA.

Revisar estados normal, hover, focus, active, disabled, destructive, success e warning. Remover cores hardcoded que conflitem com tokens. Manter bordas discretas, profundidade moderada, sombras consistentes e foco visível. Respeitar `prefers-reduced-motion`.

## 4. Módulo “Anúncios” da plataforma

“Anúncios” no menu lateral é um gerenciador administrativo de banners globais, não a lista de criativos da Meta.

Permitir ao proprietário:

- enviar PNG, JPG, WEBP ou GIF com validação de tipo e limite de tamanho;
- informar título interno e texto alternativo;
- selecionar todas as telas ou rotas específicas;
- definir início, término, prioridade, link opcional e se o usuário pode fechar;
- ativar, pausar e excluir com confirmação digitada;
- visualizar banners cadastrados e agenda de exibição.

O banner deve aparecer no topo do conteúdo, abaixo da barra global, somente nas rotas selecionadas e dentro da janela de publicação. Se houver conflito, vence a maior prioridade. O descarte é salvo por usuário/navegador e invalidado quando o anúncio for atualizado. Links aceitam apenas HTTP/HTTPS e abrem com `noopener noreferrer`. A imagem deve ser responsiva, acessível e nunca causar overflow.

## 5. Banco e segurança

Evoluir `platform_announcements` por migration aditiva com `title`, `target_paths`, `starts_at`, `ends_at`, `dismissible`, `link_url` e `priority`. Remover a restrição antiga de apenas um anúncio ativo, criar validação de janela e índice de agenda. Preservar RLS: autenticados leem anúncios ativos; somente proprietário/master cria, altera, pausa ou exclui.

Nunca usar service role no browser. Não aceitar `javascript:` em links. Não renderizar HTML arbitrário. Não registrar conteúdo sensível. Erros de schema devem orientar a aplicação da migration sem derrubar as outras telas.

## 6. Responsividade e desempenho

Validar 320, 360, 390, 430, 768, 1024, 1280, 1440 e 1920 px. Tabelas grandes usam overflow interno; páginas nunca criam overflow horizontal global. Gráficos usam `ResponsiveContainer`. Listas grandes preservam paginação. Consultas de banners usam cache e atualização periódica, sem bloquear a renderização do conteúdo.

## 7. Critérios de aceite

- seleção, status e campanha permanecem visíveis ao rolar métricas horizontalmente;
- status aparece antes do nome da campanha;
- Análises não mostra KPIs/gráficos de Intelligence;
- Intelligence não mostra os cards de alertas;
- os 10 KPIs usam dados/fórmulas reais e gráficos respondem ao período;
- botão “Baixar relatório” tem contraste legível em dark e light;
- `/anuncios` abre o administrador para master e não redireciona a campanhas;
- banners respeitam rota, agenda, prioridade, descarte e responsividade;
- usuários sem permissão não alteram anúncios;
- build, testes e lint dos arquivos alterados terminam sem erro;
- nenhuma função existente de campanhas, sincronização, edição, download ou filtros sofre regressão.

## 8. Entrega

Ao terminar, liste arquivos alterados, migration criada, testes executados, riscos remanescentes e passos de implantação. Não declare sucesso sem executar build e testes. Se a migration ainda não estiver aplicada no ambiente remoto, informar isso claramente como passo obrigatório de deploy.

