
Cada **conta de anúncio com a integração Meta conectada** é uma **sala**, com um **orquestrador** e **20 agentes de execução** (7 contas ativadas → 8 salas contando o Núcleo).

### Ninguém trabalha sem motivo

Um achado `detected` é uma **pendência** (alguém precisa olhar), não uma execução em curso. Só aparece como atividade o que está de fato rodando: uma task em execução ou um ciclo do orquestrador dentro da janela. Antes dessa correção, o escritório mostrava 414 agentes "trabalhando" — eram 4.914 achados pendentes de setembro e outubro.

O feed mostra os **eventos reais** (`agent_office_events`): "Conta Meta CA02 - DRA RANNIELY SILVA está unknown".

## Tela cheia

Botão que leva o escritório à janela inteira. É um overlay em `position: fixed` com portal para o `body` — não a Fullscreen API, que exige permissão no navegador e falha com *"Permissions check failed"*. O `Esc` fecha.

## Adaptações do Habblaud para a Growdash

| O quê | Por quê |
|---|---|
| `transform` no host | Torna o host o bloco contentor dos painéis `fixed` do Habblaud — eles ficam dentro do escritório, não sobre a navegação da plataforma. |
| `@media` → `@container` | As queries responsivas mediam a janela; agora medem o escritório (`scripts/vendor-habblaud-css.mjs`, idempotente). |
| `frame.ts` | A matemática de coordenadas (dica flutuante, renomear, popover, janela móvel) passa a medir o frame, não a viewport. |
| `zoom` mínimo 0.75 | Com o prédio inteiro enquadrado, o pixel art ficava ilegível dentro da aba. |
| Popover de Configurações | A API `popover` joga no top layer da janela e escaparia do escritório; usa o caminho `.is-open` que o CSS já tem. |

## Fora de escopo

Dependem do servidor local do Habblaud, impossível numa SPA estática: terminal interativo, resposta a pedidos de permissão, envio de mensagens a agentes, timelapse do dia e a cena Mundo (multiplayer).

## Verificação

- `npm test` — 248 arquivos, **1218 testes passando**
- `npm run lint` — **0 erros** (28 warnings pré-existentes)
- `npx tsc --noEmit` — **105 erros, idêntico ao baseline** (nenhum introduzido)
- `npm run build` — ok
- Navegador: `/agentes` renderiza as 7 salas com 21 agentes cada, o feed com o evento real, console limpo
- Novo contrato: `src/habblaud/habblaudOfficeContract.test.ts` (12 testes) — hierarquia, salas por conta, e a regra de que ninguém aparece trabalhando sem execução por trás

---

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
