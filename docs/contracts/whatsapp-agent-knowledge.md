# Contrato: conhecimento de agentes WhatsApp

Versão do contrato: `1`

O campo `public.whatsapp_agents.knowledge` é um objeto JSON persistido por workspace e por expert. A versão atual usa:

```json
{
  "version": 1,
  "content": "Texto livre com produtos, serviços, perguntas frequentes, objeções e regras autorizadas."
}
```

`version` é obrigatório e deve ser `1`. `content` é obrigatório, pode ser vazio e contém somente o conhecimento daquele expert. A tela **Treinamento dos agentes** grava esse objeto; a função `whatsapp-agent-reply` lê o mesmo campo e o envia no prompt de sistema da IA quando o expert estiver ativo e vinculado ao número de WhatsApp.

A criação e a edição continuam autorizadas apenas para administradores pelo RLS de `whatsapp_agents`. O campo não deve conter tokens, senhas ou dados pessoais desnecessários.

## Conteúdo ativo — Dra. Ranniely

Quando o expert estiver vinculado ao atendimento da Dra. Ranniely, `content` deve tratar somente de estética nichada para **Paciente Modelo de Harmonização de Glúteos**. Não inserir ou reutilizar conhecimento de outros produtos, serviços, negócios ou ofertas. A limpeza desse conteúdo não autoriza excluir conversas, contatos ou mensagens históricas.

A abordagem observada nos atendimentos deve seguir esta ordem curta:

1. Acolher e reconhecer a origem do contato.
2. Entender o objetivo ou a mudança que a pessoa busca, sem diagnosticar.
3. Explicar que a participação depende de avaliação profissional.
4. Confirmar cidade/UF e disponibilidade para atendimento.
5. Encaminhar para atendimento humano quando houver dúvida clínica, preço, elegibilidade, técnica, contraindicação ou confirmação de agenda.

O follow-up deve retomar o contexto sem repetir respostas, sem pressão e sem prometer resultado, vaga ou reserva. Registros históricos de campanha, vendas e oportunidades servem para análise de processo; não são métricas atuais nem autorização para afirmar disponibilidade.
