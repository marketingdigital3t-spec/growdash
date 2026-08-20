# Segurança e privacidade — baseline Growdash

Este documento registra os controles técnicos existentes e o processo mínimo
necessário para operar a Growdash com dados pessoais. Ele não substitui
assessoria jurídica, contratos ou decisões do controlador.

## Controles técnicos implementados

- RLS ativo nas tabelas do schema `public`; políticas de dados de negócio são
  restritas a usuários autenticados e ao respectivo workspace/conta.
- Tokens Meta, RD Station, Google e Instagram permanecem acessíveis somente por
  funções server-side; nunca devem ser enviados ao navegador, logs ou Git.
- Funções administrativas, triggers e rotinas de sincronização não possuem
  execução para `anon` ou `PUBLIC`.
- Links públicos usam UUIDs de alta entropia. Relatórios compartilhados exigem
  link ativo, têm limite por janela e removem identificadores pessoais do
  payload antes da resposta.
- Formulários financeiros públicos continuam limitados ao token explícito do
  documento; o token deve ter expiração definida ao ser emitido.
- Alterações de membros, permissões e integrações geram eventos append-only em
  `security_audit_events`, sem credenciais ou payloads sensíveis.

## Inventário resumido de dados

| Categoria | Exemplos | Finalidade operacional |
| --- | --- | --- |
| Identificação e contato | nome, e-mail, telefone, cidade/estado de leads | CRM, atendimento e atribuição comercial |
| Dados comerciais | negócio, etapa, valor, origem/UTM | funil, receita e análise de campanha |
| Métricas de marketing | impressões, gasto, conversões, criativos | otimização de mídia paga |
| Integrações | tokens OAuth e IDs de conta | sincronização autorizada com provedores |
| Financeiro | documentos, lançamentos e anexos | gestão e obrigações administrativas |

## Rotina LGPD obrigatória fora do código

1. Definir a base legal e a finalidade para cada integração e fluxo de lead.
2. Publicar aviso de privacidade com controlador, canal de atendimento,
   categorias de dados, retenção, compartilhamentos e direitos do titular.
3. Nomear canal/responsável para solicitações de titulares e registrar cada
   pedido de acesso, correção, eliminação, oposição ou portabilidade.
4. Definir prazos de retenção por categoria. Dados fiscais/contábeis só podem
   ser eliminados após o prazo legal aplicável; tokens revogados devem ser
   removidos imediatamente.
5. Assinar contratos de operador/suboperador com provedores utilizados
   (Supabase, Cloudflare, Meta, RD Station, Google e mensageria).
6. Manter MFA ativo em Supabase, GitHub, Cloudflare, e-mails administrativos e
   contas dos provedores. Habilitar também a proteção contra senhas vazadas no
   Supabase Auth.
7. Manter produção, homologação e desenvolvimento separados, sem usar dados
   pessoais de produção em testes sem base legal e minimização.

## Resposta a incidente

1. Revogar o token/integração envolvido e preservar os eventos de auditoria.
2. Avaliar dados, titulares, período e sistemas impactados.
3. Corrigir a causa, testar o isolamento RLS e registrar a decisão.
4. Acionar assessoria jurídica/DPO para avaliar comunicação à ANPD e aos
   titulares nos termos aplicáveis.

## Verificação antes de publicar

```sh
npx supabase db lint --linked --schema public
npx supabase db advisors --linked --type security
npm run lint
npm test -- --run
npm run build
```

O alerta do Supabase sobre funções `SECURITY DEFINER` deve ser analisado por
função. As três funções anônimas permitidas são os links públicos tokenizados:
formulário financeiro, envio desse formulário e relatório compartilhado.
