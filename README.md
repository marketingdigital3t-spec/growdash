# Growdash Local

Reconstrução local da interface Growdash baseada na referência visual fornecida em julho de 2026.

## O que está pronto

- identidade visual preto, dourado e off-white;
- menu lateral responsivo com Dashboard, CRM, Comercial, Tráfego Pago, Funis, IA, Alertas, Automações, Flow, Mídia Social, Agenda, Leads incompletos, Kanban, Chamados, Financeiro, Anúncios, Marcas, Integrações, Usuários, Agentes e Configurações;
- Dashboard executivo;
- tela detalhada de Tráfego Pago com seleção de conta, campanhas, filtros, orçamento diário, saldo, IA, relatórios e funis;
- CRM com pipeline demonstrativo do RD Station e origem da mídia;
- Financeiro cruzando investimento, vendas, faturamento e ROAS por conta;
- central de Integrações para Meta Ads, RD Station CRM, Google Ads e Google Drive;
- páginas específicas para CRM, Comercial, Funis, IA, Alertas, Automações, Flow, Mídia Social, Agenda, Leads incompletos, Kanban e Chamados;
- conteúdo demonstrativo para validar interface e navegação;
- migrations originais do banco Growdash (Meta Ads, RD Station, funis, vendas e insights) preservadas em `supabase/migrations/`.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra `http://localhost:8080`.

## Validar

```bash
npm run build
npm run lint
npm run test
```

## Estrutura da nova interface

- `src/growdash/GrowdashLayout.tsx`: menu lateral e barra de meta;
- `src/growdash/navigation.ts`: módulos, caminhos e conteúdo de cada item;
- `src/growdash/DashboardPage.tsx`: painel geral;
- `src/growdash/TrafficPage.tsx`: experiência de Tráfego Pago;
- `src/growdash/ModulePage.tsx`: páginas dos demais módulos;
- `src/growdash/shared.tsx`: componentes visuais compartilhados.

## Dados e integrações

Os números atuais são demonstrativos e não representam dados reais. Meta Ads, RD Station e demais fontes devem ser conectadas no backend antes do uso em produção. Tokens privados nunca devem ser adicionados a variáveis `VITE_` ou enviados ao GitHub.

## Publicação futura

O build de produção é gerado em `dist/` com `npm run build`. Vercel, Netlify ou Cloudflare Pages podem hospedar o front-end; Supabase continua responsável pelo banco, autenticação e funções serverless quando as integrações forem reativadas.
