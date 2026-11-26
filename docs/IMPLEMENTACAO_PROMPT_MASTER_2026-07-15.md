# Growdash — execução do prompt técnico master

Data: 15/07/2026

## Decisão de arquitetura

O projeto existente usa React 18, Vite, TypeScript, Tailwind, TanStack Query e Supabase. Essa arquitetura foi preservada porque já contém autenticação, RLS, migrações, sincronizadores e módulos reais. Migrar destrutivamente para Next.js, Prisma e NextAuth criaria dois backends, colocaria dados em risco e não acrescentaria valor funcional imediato.

Os requisitos do prompt foram aplicados como comportamento e experiência do produto, mantendo Supabase como fonte de verdade e funções server-side para credenciais e integrações.

## Entregue nesta execução

### Gerenciador de campanhas

- Mantidas as quatro áreas superiores: Campanhas, Orçamento (BM), IA & Relatórios de Leads e Funis de Tráfego.
- Criados seis filtros de saúde calculados com dados do período: Crítico, Atenção, Observação, Estado inicial, Saudável e Inativas.
- Classificação considera veiculação, volume de leads, CPL relativo à conta, CTR, frequência e conversão, sem gravar números artificiais.
- Adicionado painel recolhível “Meta Intelligence”, contextualizado pela conta, período e campanhas selecionadas.
- Busca, conta, período, status, ordenação, redimensionamento e personalização de colunas continuam combináveis.
- Clique na linha abre o drawer de detalhes; checkbox continua permitindo seleção múltipla sem abrir o drawer.
- Drawer ganhou ações rápidas para editar, ativar/pausar e abrir os anúncios vinculados.
- Cabeçalho e linha de totais ficaram fixos durante a rolagem.
- Totais agora incluem campanhas, orçamento, investimento, impressões, cliques, CTR, CPC, CPM, leads e vendas.
- Exportação continua respeitando o recorte filtrado.

### Navegação e estados globais

- Sidebar compacta padronizada em 64 px.
- Tablets iniciam com a sidebar compacta; desktop respeita a preferência salva do usuário.
- Mobile usa drawer com overlay; nenhum conteúdo recebe largura fixa da sidebar.
- Ícones compactos mostram tooltip em portal, sem corte pelo scroll da navegação.
- Adicionado aviso global offline para impedir que dados em cache sejam confundidos com dados atuais.
- Drawer de campanha ajustado para duas colunas em telas pequenas.

## Cobertura já existente e preservada

| Área | Cobertura atual |
|---|---|
| Dashboard | KPIs Meta/vendas/RD, metas, filtros globais e visualizações responsivas |
| Campanhas | Hierarquia campanha → conjunto → anúncio, presets, breakdowns, CSV, editor seguro e paginação |
| Orçamento (BM) | Saldo, ritmo, autonomia, aportes, severidade e previsão de recarga |
| IA & relatórios | Análise por conta/período, relatório Meta × RD e texto copiável |
| Funis de tráfego | 60 modelos: dez para cada objetivo atual da Meta |
| Análise de funis | Etapas reais do RD, taxas de avanço, gargalos e filtros |
| CRM e Comercial | Negócios, etapas, responsáveis, produtos e campos do RD |
| Financeiro | DRE, dashboard, previsão, contas, mídia, lançamentos, cartões e empresas |
| Integrações | Meta OAuth/manual, RD server-side e central de provedores |
| Armazenamento | Quota, fontes, referências e fundação de billing por workspace |
| Operação | Agenda e turmas, leads incompletos, alertas e saúde dos dados |
| Perfil e usuários | Dados pessoais, foto, senha, membros e permissões |
| Aparência | Tema claro/escuro e identidade premium preta/dourada unificada |

## Dependências externas que não podem ser simuladas

1. Meta Ads exige App Meta válido, URLs OAuth aprovadas, permissões avançadas e token do usuário/empresa. Campanhas só podem ser alteradas após a Meta aceitar essas permissões.
2. RD Station exige OAuth e vínculo correto entre conta, funil, marca e período.
3. Instagram Graph exige conta profissional vinculada, permissões aprovadas e sincronização própria de mídia/insights.
4. IA exige chave de provedor armazenada no servidor, franquia por plano, auditoria e controle de custo. Não foi implementado “ilimitado grátis”, porque isso expõe o SaaS a custo sem limite.
5. WhatsApp exige provedor oficial, templates aprovados e cobrança separada das conversas de marketing.
6. Agendamentos e automações precisam de executor server-side idempotente; o navegador não deve ser o responsável por pausar campanhas ou enviar mensagens.

## Segurança mantida

- Tokens não são expostos no bundle, URL, localStorage ou logs do navegador.
- Alterações de campanha passam pelo editor/fluxo de confirmação existente.
- Dados permanecem segregados por usuário/workspace e pelas políticas RLS do Supabase.
- Nenhuma métrica ausente recebe fallback numérico falso.
- Conta e período são transportados explicitamente para relatórios e IA, reduzindo mistura entre contas.

## Validação

- ESLint dos arquivos alterados: aprovado.
- Testes: 12 de 12 aprovados.
- Build de produção: aprovado.
- Verificação de whitespace/diff: aprovada.
- O build aponta apenas recomendação de otimização para um chunk acima de 500 kB; não bloqueia a produção. Deve ser tratado com divisão adicional de dependências e medição real de Web Vitals, sem fragmentar bibliotecas às cegas.

## Próximo ciclo recomendado

1. Teste E2E autenticado nos breakpoints 390, 768, 1024 e 1440 px.
2. Reconciliador Meta × RD × vendas com score de confiança e timezone explícito.
3. Persistência server-side dos presets de coluna por usuário/workspace.
4. Virtualização e paginação no servidor para milhares de anúncios.
5. Histórico imutável e rollback das alterações enviadas à Meta.
6. Breakdown real por idade, gênero, posicionamento e dispositivo.
7. Métricas completas de vídeo/ThruPlay e qualidade do anúncio.
8. Pacing horário de orçamento com alertas e janela silenciosa.
9. Observabilidade de sincronização com SLA, tentativas e causa de falha.
10. Otimização de bundle guiada por relatório de cobertura e Web Vitals.
