# Gerenciador Meta Ads na Growdash

## Implementado

- a aba `Tráfego Pago > Campanhas` usa o gerenciador completo;
- campanhas, conjuntos e anúncios são carregados do Supabase;
- edição de nome e status para campanha, conjunto e anúncio;
- edição de orçamento diário no nível de conjunto;
- confirmação explícita antes de enviar qualquer mudança;
- validação de propriedade, acesso delegado e permissão de campanhas;
- token Meta usado somente pela Edge Function;
- atualização do espelho local após resposta positiva da Meta;
- histórico em `campaign_changes` com usuário, campo, valor anterior e novo;
- migration removendo leitura do `access_token` pelo navegador.

## Backend

A interface chama a Edge Function:

```text
meta-manage-entity
```

Ela aceita somente `campaign`, `adset` e `ad`, e somente os campos permitidos
pelo formulário. O identificador da entidade é validado e o token nunca é
recebido do navegador.

## Requisitos antes de publicar

1. O aplicativo Meta precisa ter permissão de gerenciamento de anúncios.
2. O token salvo na conta deve incluir a permissão necessária para escrita.
3. Defina `META_GRAPH_API_VERSION` nos segredos do Supabase para a versão da
   Graph API aprovada no aplicativo.
4. Aplique a migration de proteção do token.
5. Publique a função `meta-manage-entity`.
6. Teste primeiro em uma conta de anúncios de homologação.

## Comandos de implantação

Execute somente depois de revisar o projeto Supabase de destino:

```bash
supabase db push
supabase functions deploy meta-manage-entity
supabase secrets set META_GRAPH_API_VERSION=vXX.X
```

Não aplique esses comandos diretamente em produção sem backup, revisão das
permissões do aplicativo Meta e um teste controlado.
