# PROMPT MASTER — Dashboard com meta, barra glass e responsividade mobile

Você é um engenheiro full-stack sênior especialista em React, TypeScript, Tailwind, Supabase, dashboards SaaS e design responsivo. Restaure no Dashboard da Growdash a barra de meta mensal e a faixa de indicadores em estilo glass, usando somente dados reais e preservando o tema preto/dourado.

## 1. Meta mensal por marca

- Criar configuração em **Configurações → Metas mensais**.
- Tratar cada conta de anúncio vinculada à unidade como uma marca operacional.
- Permitir definir uma meta de faturamento para cada conta, mês e unidade.
- Persistir por `workspace_id`, `business_unit_id`, `ad_account_id` e primeiro dia do mês.
- Usar `numeric`, chave única idempotente, índices e RLS.
- Somente perfis autorizados a administrar o financeiro podem alterar metas.
- Meta igual a zero remove/desativa a meta daquele mês.
- O Dashboard soma metas somente das contas visíveis na unidade selecionada.
- Quando uma conta específica estiver selecionada, mostrar apenas a meta e as vendas dessa conta.
- Preencher a barra usando faturamento líquido confirmado/pendente atribuído à conta no mês corrente.
- Não contar vendas sem `ad_account_id` na meta de uma marca.
- Exibir realizado, meta, percentual e valor restante. Acima de 100%, manter o texto real e limitar apenas a largura visual da barra.
- Se o schema ainda não estiver aplicado, mostrar instrução de configuração e nunca usar número fictício.

## 2. Faixa glass fixa

- Criar uma faixa sticky logo abaixo do cabeçalho global.
- Visual: fundo translúcido, `backdrop-blur`, borda clara discreta e brilho dourado/roxo muito suave.
- Indicadores: faturamento líquido, investimento, leads, CPL, ROAS, previsão 30 dias, alertas/saúde e vendas.
- Todas as métricas devem respeitar conta, campanhas e período global selecionado.
- Desktop/tablet: faixa sempre expandida e sem botão de minimizar.
- Mobile: permitir minimizar/expandir; persistir a preferência localmente.
- Quando minimizada, mostrar um resumo compacto sem esconder o estado dos dados.
- A faixa não pode encobrir o cabeçalho ou impedir rolagem/uso de controles.

## 3. Responsividade obrigatória

- Projetar por largura disponível, sem detectar marca/modelo do telefone.
- Suportar pelo menos 320, 360, 390, 430, 768, 1024 e 1440 px.
- Aplicar `min-width: 0` nos filhos de flex/grid e impedir overflow horizontal global.
- Cabeçalho mobile em duas linhas: menu/unidade na primeira; filtros na segunda.
- Inputs, selects e botões devem ocupar `width: 100%` quando necessário.
- Textos longos devem quebrar ou truncar com título acessível; valores monetários não podem sair do card.
- Dashboard modular deve abandonar o grid livre no mobile e renderizar widgets em uma coluna natural.
- Tabelas preservam todas as colunas em contêiner com scroll horizontal explícito; nunca cortar células silenciosamente.
- Gráficos usam largura responsiva e legenda adaptável.
- Modais usam largura máxima da viewport e conteúdo rolável.
- Ações principais mantêm área de toque mínima de 44 px no mobile.
- Respeitar `safe-area-inset-*` em iPhones com notch/ilha dinâmica.

## 4. Integridade e segurança

- Nenhuma publicação, sincronização, exclusão ou alteração externa é automática.
- Não expor tokens ou segredos no cliente.
- Não misturar contas, workspaces ou unidades.
- Diferenciar claramente meta planejada, faturamento realizado e previsão.
- Tratar migration pendente e estados vazio, carregando e erro.

## 5. Critérios de aceite

1. Meta configurada em Configurações aparece no Dashboard do mesmo mês/unidade/conta.
2. Vendas atribuídas fazem a barra avançar sem recarregar manualmente a página.
3. Trocar Infoproduto/SaaS altera metas e dados sem mistura.
4. Trocar a conta altera o escopo da meta.
5. Faixa glass permanece sticky no desktop e pode ser minimizada somente no mobile.
6. Nenhuma página cria scroll horizontal global entre 320 e 1440 px.
7. Widgets do Dashboard ficam em uma coluna natural no mobile.
8. Tabelas grandes continuam acessíveis por scroll interno.
9. Tema claro e escuro permanecem legíveis.
10. Lint, testes, build de produção e build HTML passam.

