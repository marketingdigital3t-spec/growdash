# Prompt master — Tráfego Pago alinhado e aba Comparação

## Objetivo

Reestruturar visualmente a área de Tráfego Pago da Growdash e adicionar uma aba funcional **Comparação**, inspirada na hierarquia da página `/fechamento-mes/`, sem copiar conteúdo estático, sem dados mockados e sem alterar integrações ou regras de negócio.

## Contrato da experiência

- A conta, o workspace, o funil e o período vêm exclusivamente dos filtros globais.
- A aba Comparação compara o período selecionado com o período imediatamente anterior de mesma duração.
- Datas são calculadas como dias civis no timezone operacional da conta.
- Meta continua sendo a fonte de investimento, impressões, alcance, cliques e resultados de mídia.
- RD Station e vendas consolidadas continuam sendo as fontes de negócios, vendas e receita.
- Nenhum dado indisponível pode ser preenchido por zero silencioso, inferência ou mock.
- Cada bloco informa carregamento, cobertura parcial, erro, ausência de dados ou atualização concluída.

## Métricas e fórmulas

Para cada período, exibir investimento, impressões, alcance, cliques, resultados Meta, CPL, negócios RD, vendas confirmadas, receita, CAC e ROAS.

- CPL = investimento / resultados Meta, quando resultados > 0.
- CAC = investimento / vendas confirmadas, quando vendas > 0.
- ROAS = receita confirmada / investimento, quando investimento > 0.
- Vendas e receita usam somente vendas confirmadas dentro do escopo.
- Variação percentual = (atual - anterior) / anterior × 100; quando o anterior é zero, mostrar “Novo” ou “Sem base”, nunca infinito.

## Direção visual

- Um shell único, alinhado e previsível: abas de área com altura uniforme, cabeçalhos com grid consistente e controles agrupados por função.
- Cards com mesma altura por linha, borda semântica, respiro constante e hierarquia clara.
- Hero de comparação com período atual/anterior, destaque de delta e legenda de fonte.
- Barras horizontais proporcionais, sempre acompanhadas por valor textual.
- Modo claro e escuro usam tokens semânticos; a barra lateral e a barra superior globais permanecem pretas.
- Não usar `invert()`, filtros globais, cores hardcoded que prejudiquem contraste ou overflow horizontal fora das tabelas.

## Estados obrigatórios

Carregando, dados completos, dados parciais, sem dados no período, erro de consulta e comparação sem base anterior. Em falha de uma fonte, preservar o último snapshot e identificar a fonte afetada.

## Acessibilidade e responsividade

Contraste WCAG AA, foco visível, navegação por teclado, `aria-label`/`aria-selected` corretos, `prefers-reduced-motion`, tabelas com rolagem apenas dentro do próprio quadro e layout funcional em desktop, notebook, tablet e mobile.

## Validação

Executar TypeScript, lint, testes unitários, build e `git diff --check`. Conferir `origin/main`, deployment do Cloudflare Pages, assets publicados e a rota autenticada `/campanhas?aba=comparison` em modo claro e escuro. Separar no relatório correção local, testes, commit, publicação e validação em produção.
