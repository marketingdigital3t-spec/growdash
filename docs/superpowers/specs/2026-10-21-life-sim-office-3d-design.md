# Growdash Life Sim — Escritório 3D orientado por estado real

## Objetivo

Evoluir a cena 3D já existente da Growdash para um escritório com uma sala por departamento e agentes-NPC posicionados dentro da sala correspondente. A cena será uma visualização somente leitura do estado operacional real; não executará tarefas nem permitirá alterar status localmente.

## Escopo confirmado

- Reaproveitar `src/growdash/LifeSimPage.tsx` e a abertura existente em `src/growdash/AgentsOfficePage.tsx`.
- Usar `agent_office_agents` como fonte de agentes, salas, nomes, funções e `runtime_status`.
- Usar `agent_office_events` como fonte do mini-histórico do HUD.
- Restringir todas as consultas ao `workspace_id` ativo e a `is_visible = true`.
- Usar os dez papéis canônicos já presentes no hub: `ceo`, `research`, `marketing`, `designer`, `social`, `commercial`, `analytics`, `finance`, `legal`, `inbox`.
- Manter a sidebar e as rotas atuais.
- Remover da tela 3D os comandos fictícios de trabalhar/andar/pausa e os modos Construir/Mobiliar.
- Não alterar dados, métricas, integrações ou contratos existentes.

## Dados e estados

O componente carregará agentes e eventos com React Query, usando chaves que incluam o workspace. A consulta de agentes selecionará somente os campos necessários: `id`, `role`, `name`, `department`, `runtime_status`, `status`, `last_run_at`, `next_run_at` e `is_visible`. A consulta de eventos selecionará `id`, `agent_id`, `event_type`, `severity`, `title`, `body` e `created_at`, ordenados do mais recente, com limite pequeno para o HUD.

Mapeamento visual de estado:

- `working` e `analyzing`: anel verde, NPC em deslocamento curto entre estação e quadro, rótulo “Trabalhando”/“Analisando”.
- `waiting_approval` e `paused`: anel âmbar, NPC parado em ponto de espera, rótulo correspondente.
- `error` e `blocked`: anel vermelho, NPC parado junto ao painel de alerta.
- `idle`: anel cinza, NPC parado no ponto neutro.
- ausência de agente ou erro de consulta: sala em estado “Sem conexão”, sem NPC inventado.

O movimento será determinístico por `agent.id` e status, sem aleatoriedade de atividade. A animação será pausada quando `document.visibilityState` for `hidden` e respeitará `prefers-reduced-motion`.

## Cena e interação

- Uma planta low-poly com dez salas delimitadas por paredes e portas abertas.
- Cada sala terá nome, cor derivada da identidade existente do hub e mobiliário genérico temático, sem criar métricas.
- Um NPC por agente persistido visível; se houver mais de um agente no mesmo departamento, os NPCs compartilharão a sala com posições determinísticas.
- Câmera isométrica com zoom limitado, rotação moderada e botão “Vista geral”.
- Clique em sala ou NPC seleciona o departamento/agente e abre HUD HTML lateral.
- HUD: nome da sala, agente(s), status atual, última execução, próxima execução e até cinco eventos reais.
- Botão de retorno para a visão do cérebro permanece na tela.
- A cena será carregada somente quando a visão de escritório for aberta.

## Responsividade e acessibilidade

- Desktop: HUD lateral fixo, canvas ocupando o conteúdo restante.
- Mobile abaixo de 768px: câmera fixa, controles reduzidos e HUD como bottom sheet; nenhum overflow horizontal.
- Todos os NPCs e salas terão alvos de clique acessíveis por teclado via lista complementar de salas/agentes.
- Foco visível, `aria-label` nos controles, estados de carregamento/erro/vazio e mensagem de WebGL indisponível.
- Não depender apenas de cor para comunicar estado; cada anel terá rótulo textual e ícone/estado.

## Segurança e isolamento

- Consultas sempre filtradas por workspace e protegidas pelas políticas RLS existentes.
- Nenhuma credencial será lida, escrita ou exibida pela cena.
- Nenhuma função de execução externa será chamada pelo escritório 3D.

## Validação

1. `npm run build`.
2. `npx tsc --noEmit`.
3. `npm run test`.
4. Teste visual autenticado em desktop e mobile, com estado carregando, vazio, erro e dados reais.
5. Confirmar no código as consultas às tabelas e a origem do `runtime_status`/eventos.
6. Verificar que o botão do hub abre a cena e que voltar ao cérebro continua funcionando.

## Critérios de aceite

- O escritório mostra exatamente as salas/agentes visíveis retornados pelo workspace atual.
- Um NPC não aparece quando não existe agente real para a sala.
- O movimento e o anel mudam somente com `runtime_status` real.
- O HUD mostra eventos reais do agente selecionado.
- Não existem controles locais que simulem execução ou alterem o backend.
- Desktop e mobile não apresentam overflow nem bloqueiam a navegação.
- Build, typecheck e testes aplicáveis passam.
