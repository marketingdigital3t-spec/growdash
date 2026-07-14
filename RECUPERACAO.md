# Recuperação da Growdash

Data da recuperação: 14/07/2026 (America/Sao_Paulo).

## Fonte recuperada

Este projeto foi reconstruído a partir do material local preservado na última
sessão de trabalho da Growdash. O domínio público `growdash.com.br` estava
redirecionando para `/blocked` no momento da recuperação, portanto não foi
possível baixar uma versão mais nova do site publicado.

O pacote preserva:

- a interface Growdash em React, TypeScript e Vite;
- navegação e conteúdo das abas atuais recuperadas;
- módulos históricos reais de Dashboard, campanhas, funis, alertas, turmas,
  leads incompletos, saúde dos dados, produtos, configurações e usuários;
- hooks de Meta Ads, RD Station, atribuição, vendas, métricas e reconciliação;
- migrations do Supabase, funções serverless recuperadas e o gerenciador seguro Meta Ads;
- o último build local disponível em `dist/`.

## Limitação importante

Este material é a cópia local mais completa disponível, mas não é um export
oficial do repositório privado mais recente do Lovable/GitHub. Algumas telas
novas são reconstruções visuais e usam dados demonstrativos. Elas devem ser
religadas ao backend antes de qualquer publicação em produção.

## Segurança

- `.env` é local e está ignorado pelo Git;
- nunca envie service-role keys, tokens Meta/RD ou segredos de OAuth ao front-end;
- não aplique migrations ou publique funções sem revisar o ambiente de destino;
- não execute sincronizações reais durante testes locais.

## Validação local

```bash
npm install
npm run build
npm run test
npm run dev
```
