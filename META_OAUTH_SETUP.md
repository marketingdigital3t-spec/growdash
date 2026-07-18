# Conexão Meta Ads

A Growdash usa OAuth oficial da Meta. O navegador nunca recebe `META_APP_SECRET` e nunca lê o token salvo em `ad_accounts.access_token`.

## Configuração do aplicativo Meta

No aplicativo Business da Meta, habilite Facebook Login/Marketing API e cadastre exatamente esta URL em **Valid OAuth Redirect URIs**:

```text
https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/meta-oauth-callback
```

Solicite App Review/Advanced Access, quando necessário, para:

- `ads_read`
- `ads_management`
- `business_management`

Não solicite `instagram_basic`, `instagram_manage_insights` ou `read_insights` neste fluxo de Meta Ads.

## Segredos das Edge Functions

Configure no Supabase, sem colocar valores em `.env` do frontend:

```text
META_APP_ID
META_APP_SECRET
META_OAUTH_REDIRECT_URI=https://tpseftxktzhwthekydac.supabase.co/functions/v1/meta-oauth-callback
META_GRAPH_API_VERSION=<versão ativa do aplicativo Meta>
META_OAUTH_SCOPES=ads_read,ads_management,business_management
```

Depois aplique a migration `20260714152000_add_meta_oauth_states.sql` e publique, nesta ordem:

1. `meta-oauth-start` com verificação JWT.
2. `meta-oauth-callback` sem verificação JWT, pois a chamada vem da Meta e é validada pelo `state` de uso único.

## Teste de aceite

1. Entre na Growdash.
2. Abra **Configurações → Ad Accounts**.
3. Clique em **Continuar com Facebook/Meta**.
4. Autorize o perfil Meta.
5. Confirme que todas as contas acessíveis aparecem, incluindo listas com mais de 100 itens.
6. Feche e repita o fluxo: as contas existentes devem ser atualizadas, não duplicadas.
7. Revogue o acesso na Meta e confirme que a Growdash informa erro de conexão na próxima sincronização.

O callback não recebe senha, não devolve token ao frontend e consome o `state` antes de trocar o código, impedindo replay.
