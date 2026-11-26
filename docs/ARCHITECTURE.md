# Arquitetura e organização do Growdash

Este documento é o mapa oficial do projeto. Ele transforma a estrutura do
produto em uma divisão simples de Front End, Back End, dados e integrações sem
mover arquivos que já são usados pelo build ou pelo deploy.

## Mapa geral

```text
Growdash (programador raiz)
├── Front End (React + TypeScript + Vite)
│   ├── Linguagem: TypeScript / TSX
│   ├── Framework: React
│   ├── Estilo: Tailwind CSS + src/index.css + src/styles/
│   ├── Bibliotecas: Radix UI, TanStack Query, Recharts, Framer Motion,
│   │                Lucide, React Router e React Hook Form
│   └── Código: src/
│       ├── App.tsx e main.tsx ........ composição da aplicação
│       ├── pages/ .................... rotas e páginas públicas/legadas
│       ├── growdash/ ................. módulos de domínio da plataforma
│       ├── components/ ............... componentes reutilizáveis e por feature
│       ├── hooks/ .................... acesso a estado, dados e permissões
│       ├── contexts/ ................. estado compartilhado de sessão/filtros
│       ├── integrations/supabase/ .... cliente e tipos gerados do Supabase
│       ├── lib/ ...................... regras, adaptadores e utilitários
│       ├── styles/ ................... tokens e estilos complementares
│       └── assets/ ................... imagens e recursos estáticos
│
├── Back End (Supabase Edge Functions)
│   ├── Linguagem: TypeScript executado em Deno
│   ├── Banco: PostgreSQL gerenciado pelo Supabase
│   ├── API: REST via Supabase JS + Edge Functions HTTP
│   └── Código: supabase/
│       ├── functions/_shared/ ........ contratos e helpers server-side
│       ├── functions/<domínio>/ ...... uma função por endpoint/worker
│       ├── migrations/ ................ histórico versionado do banco
│       └── config.toml ................ configuração das funções
│
├── Dados e contratos
│   ├── supabase/migrations/ .......... schema, RLS, funções SQL e índices
│   ├── src/integrations/supabase/types.ts
│   └── docs/ ......................... contratos, decisões e auditorias
│
└── Qualidade e operação
    ├── tests/visual/ .................. smoke tests de rotas e UI
    ├── src/**/*.test.* ................ testes unitários de domínio
    ├── scripts/ ....................... automações locais/de operação
    ├── dist/ e html/ .................. artefatos gerados; não editar à mão
    └── .env* .......................... configuração local; segredos fora do Git
```

## Fronteiras por camada

| Camada | Responsabilidade | Onde alterar |
| --- | --- | --- |
| Interface | Renderização, navegação, estados visuais e acessibilidade | `src/pages`, `src/growdash`, `src/components` |
| Aplicação | Hooks, permissões, filtros, cache e composição de dados | `src/hooks`, `src/contexts`, `src/lib` |
| Integrações | Cliente Supabase, tipos e chamadas para endpoints | `src/integrations`, hooks de domínio |
| API server-side | Autenticação de requisição, validação e escrita protegida | `supabase/functions` |
| Banco | Tabelas, RLS, RPCs, índices e contratos persistentes | `supabase/migrations` |
| Operação | Build, testes, publicação e scripts auxiliares | raiz, `scripts`, `tests` |

Uma regra de negócio deve ter uma fonte de verdade. A interface pode esconder
ou desabilitar uma ação, mas a autorização definitiva precisa continuar no
backend/RLS.

## Domínios do Back End

As Edge Functions seguem o prefixo do domínio para facilitar localização e
observabilidade:

- `meta-*`, `sync-meta-*` e `validate-meta-*`: Meta Ads, insights, leads,
  pixels, saldo e reconciliação;
- `rd-*`, `sync-rd-*` e `reconcile-sales-rd`: RD Station CRM, negócios,
  funis, campos, estados e atribuição;
- `google-*`, `instagram-*`, `hubspot-*` e `whatsapp-*`: integrações OAuth e
  mensageria;
- `traffic-agent-*`, `agent-office-*`, `ask-ai` e
  `generate-intelligence-snapshot`: inteligência e agentes;
- `daily-*`, `*-cron`, `monitor-*`, `controlled-*`, `historical-*` e
  `build-dashboard-view`: jobs, saúde, backfills e materializações;
- `admin-*`, `delete-*` e `sales-*`: administração, segurança e webhooks.

Cada função deve manter a entrada em `index.ts`, compartilhar apenas helpers
de `functions/_shared/` e validar a autorização antes de qualquer escrita.

## Fluxo de dados

```text
Página/Componente
      ↓
Hook ou Contexto (cache, filtros, permissões)
      ↓
Supabase JS / Edge Function HTTP
      ↓
RLS + RPC + PostgreSQL
      ↓
Resposta tipada → cache → interface
```

Integrações externas (Meta, RD, Google, Instagram, HubSpot e WhatsApp) entram
pelas Edge Functions. Tokens privados nunca devem passar por `VITE_*` nem ser
usados diretamente no browser.

## Tecnologia que existe hoje

O diagrama de referência cita Vue, Angular, jQuery, Bootstrap, Python, PHP,
Ruby, Java, MySQL, MongoDB e GraphQL. Eles não fazem parte do runtime atual do
Growdash. O stack efetivo é:

- Front End: React + TypeScript + Vite + Tailwind/Radix;
- Back End: Supabase Edge Functions em Deno/TypeScript;
- Banco: PostgreSQL/Supabase;
- API: REST/HTTP pelo Supabase JS e pelas Edge Functions.

Não adicionamos outra linguagem, framework ou banco apenas para reproduzir o
diagrama visual.

## Regra para reorganizações futuras

1. Identificar o contrato existente antes de mover um arquivo.
2. Fazer uma mudança de uma camada/domínio por vez.
3. Atualizar imports usando o alias `@/*` e manter compatibilidade de rotas.
4. Rodar `npm run lint`, `npm run test`, `npm run build` e `git diff --check`.
5. Só depois publicar e validar a rota autenticada e os endpoints afetados.

Por isso, este primeiro passo organiza a visão e os limites sem alterar o
runtime. Movimentações físicas de pastas serão mudanças separadas, pequenas e
reversíveis.
