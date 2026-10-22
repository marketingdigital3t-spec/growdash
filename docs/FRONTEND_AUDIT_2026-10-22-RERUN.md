# Auditoria completa do front-end — 2026-10-22 (reexecução)

## Escopo e método

- Código local comparado com `origin/main`: `main` estava alinhada (`0` commits à frente e `0` atrás).
- Produção conferida em `https://growdash.com.br` e no deployment `https://92bae301.growdash.pages.dev`; ambos responderam HTTP 200.
- Sessão autenticada `Thiego` percorrida nas 27 rotas do shell Growdash.
- Temas claro e escuro verificados em desktop (1680×933), 390×844 e 768×1024.
- Para cada rota foram medidos `scrollWidth/clientWidth`, elementos renderizados fora da viewport, imagens sem `alt`, controles sem nome acessível e logs do console.
- A sidebar principal foi tratada como área de rolagem independente e não foi alterada.

## Resultado da varredura

- Não foi reproduzido overflow horizontal no `body` em 390px ou 768px. As diferenças encontradas ficaram em barras internas de filtros/tabs e são intencionais.
- Não foram encontradas imagens visíveis sem `alt`.
- Não foram encontrados erros de console. Permaneceram apenas dois avisos do Three.js (`THREE.Clock` e `THREE.WebGLShadowMap`) vindos do bundle da biblioteca.
- O skeleton de `/business/leads` apareceu fora da viewport apenas durante uma corrida de carregamento; após a resposta ele foi removido. Não foi classificado como bug persistente.
- O FE-012, FE-013, FE-014 e FE-015 do relatório anterior permanecem cobertos pelos testes/contratos existentes.

## Achados reproduzíveis e correções

### FE-016 — Enviar mensagem do WhatsApp sem nome acessível (P2)

Reprodução: abrir `/whatsapp` e inspecionar o botão icon-only do formulário de mensagem. O `button[type=submit]` continha apenas o ícone `Send`, sem texto, `title` ou `aria-label`.

Correção: adicionado `aria-label="Enviar mensagem"`.

### FE-017 — Excluir automação sem nome acessível (P2)

Reprodução: abrir `/automacoes` com uma automação existente. O botão de lixeira não tinha nome acessível.

Correção: adicionado `aria-label={`Excluir automação ${automation.name}`}`.

### FE-018 — Switches de configuração sem nome acessível (P2)

Reprodução: `/financeiro`, `/configuracoes`, regras de plataforma e editor de métricas renderizavam switches sem `aria-label` ou associação equivalente em estados visíveis.

Correção: adicionados nomes estáveis para imposto Meta, modo escuro, ativação/fallback de regra e Lead padrão.

### FE-019 — Limpar quadro do Growdash Flow sem nome acessível (P2)

Reprodução: `/growdash-flow`, botão icon-only de lixeira no TopBar tinha apenas `title`.

Correção: adicionado `aria-label="Limpar quadro"`.

## Prompt de correção executado

```text
Reexecute a auditoria do front-end autenticado do Growdash em 27 rotas, nos temas claro e escuro e nos breakpoints 390, 768 e desktop. Preserve a rolagem independente da sidebar principal e não classifique barras internas de filtros/tabs como overflow do body.

Registre somente achados reproduzíveis, com rota, seletor/arquivo, causa raiz, severidade e critério de aceite. Revalide os itens FE-012 a FE-015 do relatório anterior antes de criar duplicatas.

Para os achados de acessibilidade confirmados, escreva primeiro testes de contrato que falhem e então corrija minimamente:
1. Botão icon-only de envio em /whatsapp: aria-label="Enviar mensagem".
2. Botão de excluir automação em /automacoes: nome dinâmico com o nome da automação.
3. Switches visíveis sem nome em /financeiro, /configuracoes, PlatformRulesSection e CustomMetricsSection: aria-labels estáveis e em português.
4. Botão de limpar quadro do Growdash Flow: aria-label="Limpar quadro".

Execute o teste direcionado, a suíte completa, lint, build e git diff --check. Refaça a verificação visual e de console nos dois temas e nos três breakpoints. Não inclua mudanças locais não relacionadas no commit.
```

## Verificações executadas

- Teste de contrato direcionado: aprovado após o ciclo RED/GREEN.
- Varredura visual e DOM: 27 rotas × claro/escuro × desktop; 390px e 768px no claro, sem overflow do body.
- Console: sem erros; somente os dois avisos legados do Three.js descritos acima.

## Publicação

- Commit local isolado: `50297da` (`fix: audit frontend accessibility contracts`).
- Push para `origin/main`: não concluído porque o ambiente não resolveu `github.com`.
- Cloudflare Pages: publicado diretamente em `https://e9895368.growdash.pages.dev`.
- Os três markers de acessibilidade foram encontrados nos chunks desse deployment e também nos chunks servidos por `https://growdash.com.br`.
- A validação visual final via CUA foi interrompida pela reinicialização do runtime do navegador; por isso a publicação foi confirmada por HTTP/chunks, não por uma nova sessão visual autenticada pós-deploy.

## Pendências fora do escopo desta correção

- Os avisos de depreciação do Three.js pertencem ao bundle da dependência e não alteram a renderização observada.
- O conteúdo de dados, permissões de integrações e OAuth não foi alterado nesta auditoria de front-end.
