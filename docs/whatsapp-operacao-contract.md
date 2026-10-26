# Contrato de operação WhatsApp

Este contrato define a integração de WhatsApp dentro da Growdash. O backend continua no
Supabase da Growdash; a interface pública é a Growdash. O provedor inicial pode ser WAHA
(QR Code, número não oficial) ou Meta Cloud API (número oficial).

## Hierarquia

`workspace -> ad_account -> whatsapp_number -> conversation -> message`

Cada número conectado pertence a uma organização e pode ser vinculado a uma conta de anúncio e
a um vendedor. A atribuição de campanha, conjunto, anúncio, plataforma e posicionamento é
preservada em `whatsapp_conversations.attribution`. Valor ausente permanece `null` ou
`unknown`; nunca é inferido a partir de nome de campanha.

## Modos de atendimento

- `human`: somente vendedor.
- `ai`: agente responde automaticamente.
- `ai_handoff`: agente responde até transferir para humano.
- `human_assist`: vendedor responde e a IA sugere apoio sem enviar sozinha.

Todo número nasce em `human`. A troca de modo exige ação explícita de owner/admin.

## Visibilidade

Owner/admin vê todos os números e conversas do workspace. Outro membro vê somente o número
atribuído a ele e as conversas atribuídas a ele. Não existe distribuição automática na primeira
versão; transferência manual é permitida a owner/admin.

## Follow-up

Uma mensagem recebida inicia uma janela de retorno. Se o vendedor não responder por quatro horas,
o agente pode retomar a conversa usando o histórico completo. O plano padrão é de duas tentativas
no primeiro dia e uma tentativa diária nos sete dias seguintes. Uma resposta do contato cancela
as tentativas pendentes. Fora da janela de 24 horas da Meta, o envio exige template aprovado.

## Eventos e idempotência

Webhooks externos e eventos WAHA/Meta são registrados com identificador externo e hash do payload.
O mesmo evento não cria duas mensagens, conversas, leads ou execuções. Cada automação recebe o
evento com `workspace_id`, `ad_account_id`, `whatsapp_number_id`, `conversation_id` e o bloco de
atribuição disponível.

## Segurança

Tokens de provedor são consumidos somente por Edge Functions. RLS é por workspace e limita vendedor
ao seu número/conversa. Webhooks públicos usam segredo rotativo e comparação por hash. Logs não
armazenam tokens.


## Operação de ambiente

A execução periódica de follow-ups usa o job `growdash-whatsapp-followup-sweep`, disparado pelo `pg_cron` a cada minuto. O job reutiliza o segredo privado `private.daily_incremental_sync_config.cron_secret`; nenhum segredo é exposto no frontend.

Variáveis necessárias nas Edge Functions: `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_WEBHOOK_SECRET`, `AI_API_KEY` ou `OPENAI_API_KEY`, `AUTOMATION_INTERNAL_SECRET`, `WHATSAPP_APP_SECRET` e `WHATSAPP_VERIFY_TOKEN`.
