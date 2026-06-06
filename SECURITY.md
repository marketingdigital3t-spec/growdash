# Politica De Seguranca

## Dados Sensiveis

Este projeto trabalha com tokens de API, contas de anuncio, dados comerciais, leads e metricas financeiras. Esses dados nunca devem ser expostos no front-end, em logs publicos ou no GitHub.

## Regras Obrigatorias

- `.env` e arquivos com segredos reais nao devem ser commitados.
- `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas em ambiente seguro de servidor ou Supabase Edge Functions.
- Tokens de Meta, RD Station, WhatsApp e CRMs devem ser acessados por funcoes server-side.
- Toda tabela com dados de negocio deve ter RLS ativo.
- Toda operacao administrativa deve validar se o usuario e administrador.
- Toda consulta por dados de conta deve respeitar permissoes por usuario.

## Pontos Que Precisam De Atencao Antes De Producao

- Revisar Edge Functions com `verify_jwt = false` em `supabase/config.toml`.
- Evitar tokens salvos em texto puro no banco. Preferir Supabase Vault ou criptografia de aplicacao.
- Criar logs de auditoria para alteracao de permissoes, conexao de APIs e sincronizacao de dados.
- Separar ambientes de desenvolvimento, homologacao e producao.
- Ativar MFA nas contas Supabase, GitHub, Vercel e provedores de API.

## Checklist Antes De Publicar

- `git status` sem arquivos `.env`.
- Variaveis reais cadastradas somente no provedor de deploy/Supabase.
- Repositorio GitHub privado.
- RLS validado nas tabelas de usuario, contas, integracoes, leads e vendas.
- Edge Functions sensiveis protegidas por JWT e checagem de permissao.
- Dominio com HTTPS ativo.
