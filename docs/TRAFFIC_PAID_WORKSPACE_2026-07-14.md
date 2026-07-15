# Growdash — Central de Tráfego Pago

Data: 14/07/2026

## Entregue

- Central única com as abas Campanhas, Orçamento (BM), IA & Relatórios de Leads e Funis de Tráfego.
- Rota principal de Campanhas direcionada para a nova Central.
- Gerenciador inspirado na hierarquia da Meta: campanhas, conjuntos e anúncios.
- Dez predefinições de colunas: Desempenho, Desempenho e cliques, Veiculação, Engajamento, Vídeo, Reconhecimento, Tráfego, Cadastros, Vendas/ROAS e Configuração.
- Personalização individual de colunas com persistência no navegador.
- Catálogo de detalhamentos por tempo, veiculação e ação.
- Aviso explícito quando um breakdown ainda não está armazenado, evitando apresentar números inventados.
- Exportação CSV completa das campanhas no período atual.
- Conjuntos e anúncios com gasto, orçamento, impressões, CPM, alcance, frequência, cliques, CTR, CPC, resultados e custo por resultado.
- Workspace de orçamento com ritmo dos últimos sete dias, saldo, autonomia e severidade.
- IA dedicada por conta e período, sem mistura entre contas.
- Relatório Meta Ads + RD Station com leads, investimento, CPL, negócios, vendas, receita e ROAS atribuído.
- Relatório diário copiável para WhatsApp ou equipe.
- Biblioteca de 60 funis: dez para cada objetivo atual da Meta — Reconhecimento, Tráfego, Engajamento, Cadastros, Promoção do app e Vendas.
- Layout responsivo com tabelas horizontais controladas, abas móveis e cards adaptáveis.

## Limites tratados com transparência

- Alcance agregado por linhas diárias não é alcance deduplicado do período da Meta; a interface o marca como direcional.
- Breakdowns como idade, gênero, posicionamento e dispositivo aparecem no catálogo, mas só serão aplicados quando o sincronizador gravar essas dimensões.
- Métricas de vídeo permanecem como indisponíveis enquanto `video_*_actions` não for persistido.
- O relatório de RD Station depende do vínculo correto de conta, UTM e período.

## Validação

- TypeScript aprovado.
- ESLint aprovado nos arquivos alterados.
- 12 de 12 testes aprovados.
- Build de produção aprovado.
- Build HTML local aprovado.
- `git diff --check` aprovado.

## Próximas 10 melhorias recomendadas

1. Persistir os breakdowns oficiais da Graph API em tabela própria, sem misturar granularidades.
2. Sincronizar métricas de vídeo, qualidade, ranking e cliques únicos.
3. Criar visões de coluna personalizadas por usuário e workspace.
4. Implementar criação e duplicação de campanhas por fluxo de rascunho com aprovação.
5. Adicionar histórico e rollback de alterações enviadas à Meta.
6. Fazer reconciliação automática Meta × RD × vendas com indicador de confiança.
7. Permitir salvar um modelo de funil como playbook operacional da marca.
8. Adicionar alertas de pacing de orçamento por hora e dia da semana.
9. Criar comparação lado a lado entre períodos, campanhas e contas.
10. Introduzir paginação no servidor e virtualização para contas com milhares de anúncios.
