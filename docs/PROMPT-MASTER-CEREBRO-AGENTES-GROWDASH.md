# Prompt master — Cérebro operacional Growdash

Você é um engenheiro sênior de produto, motion design, UX, acessibilidade e frontend especializado em experiências digitais cinematográficas. Trabalhe no módulo de Agentes da Growdash após estudar o código existente, especialmente `AgentsOfficePage.tsx`, o mapa de conhecimento JARVIS, o escritório 3D, os temas da plataforma e os estilos globais.

## Visão do produto

Transforme a entrada do módulo de Agentes em um cérebro operacional vivo, inspirado visualmente em circuitos neurais dourados, interfaces JARVIS e grafos conectados semelhantes ao Obsidian. A experiência deve transmitir que toda a operação da empresa está conectada à Growdash.

O cérebro não é apenas decorativo. Ele é a porta de entrada para a inteligência operacional. Ao clicar nele, a câmera deve realizar uma aproximação cinematográfica, atravessar o núcleo neural e revelar a Growdash no centro de um grafo vivo. Ao redor do núcleo devem surgir as dez salas canônicas — CEO/Estratégia, Pesquisa, Tráfego, Criativo, Social, Vendas, Analytics, Financeiro, Jurídico e Inbox — com um gestor, agentes executivos, tarefas e rotinas em pequenas ramificações conectadas. Os ids legados de CRM, Comercial, Marca e Automações continuam aceitos apenas para compatibilidade de dados antigos.

## Estado inicial — cérebro vivo

- Exibir um cérebro central detalhado, formado por placa eletrônica, trilhas de circuito, contornos orgânicos, microchips e pontos de sinapse.
- O cérebro deve ter volume visual, brilho premium e leitura clara, sem depender de uma imagem raster pesada.
- Criar dezenas de pontos neurais ao redor do cérebro, conectados por linhas finas e pulsos de energia.
- Os pontos devem se mover lentamente em profundidade, com velocidades e atrasos diferentes.
- As conexões devem parecer vivas: pulsos percorrem as linhas, nós piscam e pequenos grupos respiram.
- Adicionar órbitas, partículas, varredura e paralaxe suave conforme o ponteiro se move.
- O cérebro deve acompanhar a cor de destaque escolhida na Growdash, preservando contraste no tema escuro.
- Exibir uma instrução clara e elegante: “Clique para entrar no núcleo”.

## Salas canônicas do mapa

Cada sala é uma unidade operacional visível no grafo. O cartão mostra o gestor persistido, o estado de execução retornado pelo Agent Office e as frentes da área. A sala só pode conversar com o usuário pelo gestor; agentes executivos e tarefas ficam subordinados a ele. Quando o registro persistido ainda não existe, a interface deve exibir “aguardando conexão”, nunca inventar atividade ou volume.

## Clique e entrada cinematográfica

- Ao clicar, bloquear novos cliques durante a transição.
- A animação deve durar aproximadamente 1,2 a 1,6 segundo.
- Iniciar com concentração de energia nas sinapses.
- Aproximar rapidamente o cérebro com profundidade, brilho e desfoque controlado.
- Fazer os pontos externos acelerarem para as bordas como um túnel neural.
- Exibir anéis concêntricos, linhas de velocidade, flash central e sensação de atravessar o núcleo.
- A animação precisa terminar de forma suave, sem tela branca brusca ou travamento.
- Respeitar `prefers-reduced-motion`, trocando a sequência por uma transição curta de opacidade.

## Estado expandido — grafo operacional estilo Obsidian

- Exibir a marca Growdash no centro como núcleo principal.
- Distribuir as áreas operacionais ao redor do núcleo em um grafo radial responsivo.
- Usar conexões curvas ou segmentadas com energia em movimento.
- Cada área deve apresentar nome, descrição e acesso à página correspondente.
- Cada área deve possuir mini ramificações navegáveis, como Estratégias de mídia, Criativos, Scripts de vendas, Forecast, DRE, Margem, Playbooks e WhatsApp.
- Nós e conexões devem reagir a hover, foco e seleção, destacando o caminho até o núcleo.
- Manter movimento ambiente discreto, com nós flutuando em camadas diferentes.
- Disponibilizar ações para voltar ao cérebro e entrar no escritório 3D.

## UX, responsividade e acessibilidade

- Preservar o escritório 3D e as funcionalidades existentes dos agentes.
- Não adicionar dependência 3D pesada se SVG, CSS e React resolverem a experiência.
- Evitar re-renderizações contínuas durante paralaxe e animações.
- Usar transformações aceleradas por GPU e animações limitadas a `transform`, `opacity`, `filter` e `stroke-dashoffset`.
- Garantir funcionamento em desktop, tablet e mobile.
- No mobile, converter o grafo radial em uma sequência visual organizada e navegável.
- Manter navegação por teclado, foco visível, `aria-expanded`, `aria-live` e rótulos completos.
- Não depender somente de cor ou movimento para comunicar estados.
- Garantir que todas as cores predefinidas da Growdash mantenham legibilidade.

## Qualidade e entrega

- Reutilizar os tokens de tema e componentes existentes.
- Não usar dados fictícios para mascarar integrações.
- Não remover o escritório, chats, contas vinculadas ou estados dos NPCs.
- Validar TypeScript, ESLint, Vitest e build Vite.
- Fazer revisão visual autenticada nos modos inicial, transição, grafo expandido e mobile.
- Criar commit descritivo, enviar ao GitHub e publicar no Cloudflare Pages somente após as validações.
- Verificar `growdash.com.br` e `www.growdash.com.br` após o deploy.
