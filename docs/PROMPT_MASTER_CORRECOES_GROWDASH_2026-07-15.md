# PROMPT MASTER — CORREÇÃO, REMAPEAMENTO E PREMIUMIZAÇÃO DA GROWDASH

Você é um engenheiro full-stack sênior responsável por corrigir e concluir a Growdash sem regressões. Trabalhe diretamente no projeto existente. Não recrie o projeto, não substitua telas funcionais por mocks e não altere contratos de dados sem migration retrocompatível.

## Resultado obrigatório

Entregar uma plataforma SaaS multiusuário premium em que:

1. contas Meta Ads possam ser removidas da Growdash com confirmação forte;
2. a remoção local nunca exclua a conta ou campanha real na Meta;
3. integrações RD Station possam ser desconectadas ou excluídas, com significado claro para cada ação;
4. usuários gerenciados possam ser excluídos sem falha de chave estrangeira;
5. ninguém consiga excluir a própria sessão ou a conta proprietária;
6. o menu lateral recolhido mostre o nome dos módulos ao passar o mouse e seja utilizável por teclado;
7. Growdash Flow funcione como whiteboard inspirado no Excalidraw para fluxogramas, funis e acompanhamento de leads;
8. Análise de Mídia Social use somente a API oficial e mostre métricas reais por perfil e conteúdo;
9. toda a interface mantenha a identidade preto, ouro e marfim da Growdash nos modos claro e escuro;
10. desktop, tablet e mobile não tenham vazamento horizontal nem controles inacessíveis.

## Regras que não podem ser violadas

- Nunca exponha `access_token`, `api_token`, `client_secret`, refresh token ou webhook secret no navegador, logs ou mensagens de erro.
- OAuth, refresh, sync e exclusões sensíveis devem ocorrer em Edge Functions autenticadas.
- Toda função deve validar o JWT e novamente validar propriedade da conta/workspace no servidor.
- `service_role` existe somente no backend.
- Não use senha do Instagram/Facebook. Use OAuth oficial.
- Não misture métricas orgânicas com métricas de anúncios.
- Não invente KPI, demografia, campanha, receita ou insight ausente.
- Não use `window.confirm` em operação destrutiva. Use dialog acessível com digitação do nome/recurso.
- Não ignore erros do banco. Retorne mensagem segura e acionável.
- Não aplique `DELETE` externo em Meta/RD; remova somente a conexão e dados locais explicitamente informados.
- Preserve auditoria com `ON DELETE SET NULL` para o autor quando necessário.
- Não interrompa telas já conectadas a dados reais.

## 1. Exclusão segura de contas Meta Ads

Na Central de Integrações, cada card Meta deve conter “Excluir conta da Growdash”. Ao clicar:

- explicar que conta, campanhas e anúncios reais continuarão existindo na Meta;
- informar quais dados locais serão removidos;
- exigir que o usuário digite exatamente o nome da conta;
- chamar uma Edge Function autenticada;
- verificar no servidor `account.user_id === auth.uid()` ou papel `master`;
- excluir a linha de `ad_accounts` e confiar apenas em FKs `ON DELETE CASCADE/SET NULL` validadas;
- invalidar queries de contas, campanhas, conjuntos, anúncios, insights, funis, metas e saúde;
- exibir progresso e impedir duplo clique;
- tratar “já removida” como estado idempotente e compreensível.

Critério de aceite: a conta some sem refresh manual, a conta real permanece na Meta e uma conta de outro tenant não pode ser removida.

## 2. RD Station CRM

Oferecer duas ações distintas:

- **Desconectar:** apagar/revogar o token e marcar a integração como inativa, mantendo a configuração.
- **Excluir conexão:** eliminar a credencial e a linha da integração. Preservar negócios sincronizados para auditoria, salvo fluxo separado de expurgo explícito.

A exclusão deve exigir `EXCLUIR RD`. Funis vinculados devem ter exclusão individual com digitação do nome e deixar claro que o funil real no RD não será apagado.

Critério de aceite: após excluir, o token não existe no banco e nenhum job volta a sincronizar; negócios históricos continuam visíveis.

## 3. Exclusão de usuários

Corrigir `admin-create-user`:

- impedir `target_user_id === caller.id`;
- impedir exclusão do proprietário da plataforma;
- buscar o usuário antes de excluir;
- limpar tabelas sem FK em ordem filho → pai;
- garantir `ON DELETE CASCADE` em dados pessoais descartáveis;
- usar `ON DELETE SET NULL` em auditorias e rascunhos que devem ser preservados;
- verificar o erro de cada operação;
- somente depois chamar `auth.admin.deleteUser`;
- não deixar `funnels`, permissões, acessos, integrações ou estados órfãos.

Na UI, exigir digitação do username e mostrar loading/erro. Após sucesso, invalidar `managed_users`.

Critério de aceite: usuário comum com rascunhos, funis e acessos atribuídos é removido; proprietário e usuário logado são protegidos.

## 4. Navegação premium

- Quando recolhida, a sidebar deve expandir como overlay ao `hover` no desktop e mostrar todos os nomes.
- Manter tooltip via portal como fallback, `aria-label`, foco visível e navegação por teclado.
- No mobile, abrir sempre com largura completa e backdrop; nunca abrir com apenas 64 px.
- A expansão temporária não deve empurrar o conteúdo principal.
- Ícones, ativo, hover e foco usam ouro com contraste AA.
- Mostrar logo completa ao expandir e símbolo ao recolher.

## 5. Growdash Flow

Evoluir o canvas existente; não usar uma imagem do Excalidraw e não apagar a integração com dados reais.

Obrigatório:

- ferramentas Selecionar, Mão/Pan e Conectar;
- zoom, reset, grid e exportação PNG;
- arrastar blocos, conectar portas e reposicionar conexões;
- editar rótulo/descrição, criar bloco e excluir com confirmação;
- desfazer/refazer com histórico mínimo de 50 estados e atalhos Cmd/Ctrl+Z;
- indicador “salvo/alterações não salvas”;
- salvar e reabrir preservando nós, posições e conexões;
- modelos: em branco, funil de vendas, acompanhamento de leads e vínculo com conta/campanha;
- blocos de aquisição, página, formulário, CRM, contato, oportunidade, venda, pagamento e receita;
- preencher blocos AUTO somente quando houver fonte real;
- layout utilizável por toque em tablet e controles adaptados no mobile;
- prevenir perda de trabalho ao sair com alterações não salvas.

## 6. Análise de Mídia Social

Criar fluxo OAuth separado do Meta Ads. Para Instagram Login profissional, solicitar apenas:

- `instagram_business_basic`;
- `instagram_business_manage_insights`.

Guardar token somente em `integrations`; guardar dados públicos/operacionais em:

- `social_accounts`;
- `social_media`;
- `social_insights_daily`.

Tela obrigatória:

- seletor de perfil;
- estado da conexão e última sincronização;
- seguidores, alcance, interações, taxa de engajamento e conteúdos analisados;
- abas Visão geral, Conteúdos, Audiência e Recomendações;
- cards por publicação/Reel com alcance, interações, salvamentos, compartilhamentos e engajamento;
- fallback para `media_url` temporária expirada;
- lazy loading das imagens;
- gráfico diário com dados reais;
- estado vazio e estado de migration pendente;
- nunca mostrar demografia quando a API retornar vazio;
- nunca somar orgânico ao tráfego pago.

A sincronização deve usar paginação, retry com backoff para 429, limite de chamadas, upsert idempotente e atualização de URLs temporárias.

## 7. Remapeamento de módulos

Auditar cada rota e garantir que o conteúdo esteja na área correta:

| Rota | Responsabilidade |
|---|---|
| `/` | Dashboard executivo e meta por marca |
| `/crm` | Leads, pipeline, negócios e Kanban |
| `/comercial` | Resultado comercial, vendas e equipe |
| `/campanhas` | Campanhas, orçamento BM, IA/relatórios e funis de tráfego |
| `/analise-de-funis` | Funil real RD/CRM e gargalos |
| `/growdash-flow` | Whiteboard de jornadas e funis |
| `/midia-social` | Orgânico por perfil/conteúdo |
| `/agenda-turmas` | Turmas, agenda, vagas e pacientes/alunos |
| `/financeiro` | DRE, dashboard, previsão, conta, tráfego, lançamentos, cartões e empresas |
| `/integracoes` | Todos os provedores e saúde das conexões |
| `/usuarios` | Usuários, papéis e escopos |
| `/armazenamento` | Consumo por módulo, arquivos e políticas |
| `/perfil` | Dados pessoais, segurança e plano |

Remover duplicatas de integração em Configurações e apontar para `/integracoes`. Não mover regras de preferência pessoal que realmente pertencem a Configurações.

## 8. Premiumização visual

- Usar tokens globais; não criar uma segunda paleta azul/roxa.
- Fundo preto profundo, superfícies grafite/quentes, bordas ouro discretas, texto marfim.
- Light mode com marfim e ouro, sem texto branco sobre branco.
- Cards com hierarquia, respiro, borda sutil e sombra curta; evitar glow excessivo.
- Cabeçalhos com eyebrow, título, explicação e ações alinhadas.
- Estados empty/error/loading/success consistentes.
- Skeleton para queries, lazy loading de módulos/imagens e feedback imediato.
- Tabelas desktop viram cards no mobile ou usam scroll interno declarado; nunca fazem a página vazar.
- Todos os botões de ícone devem ter nome acessível e tooltip/title.

## 9. Testes obrigatórios

Automatizar, quando possível:

1. proprietário não pode ser excluído;
2. usuário não pode excluir a si próprio;
3. master exclui usuário comum com dependências;
4. usuário A não exclui conta Meta do usuário B;
5. confirmação incorreta bloqueia exclusão;
6. exclusão Meta não chama Graph API DELETE;
7. RD desconectado não sincroniza;
8. OAuth rejeita state expirado/reutilizado;
9. token nunca aparece em SELECT autenticado;
10. sync social faz upsert sem duplicar conteúdo;
11. mídia expirada mostra fallback sem quebrar card;
12. Flow restaura undo/redo e persiste o documento;
13. sidebar mostra nomes recolhida;
14. 320, 375, 390, 768, 1024, 1366 e 1920 px sem overflow de página;
15. build, lint focado e suíte Vitest passam.

## 10. Entrega

Antes de encerrar:

- apresentar arquivos modificados e migrations;
- informar variáveis necessárias sem revelar valores (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_OAUTH_REDIRECT_URI`, `INSTAGRAM_GRAPH_API_VERSION`);
- informar o redirect exato da Edge Function para cadastrar na Meta;
- listar testes executados e resultados;
- listar riscos/pendências reais, sem afirmar que OAuth está em produção se as migrations/functions/secrets não foram implantadas;
- não publicar nem apagar dados reais sem autorização explícita.

