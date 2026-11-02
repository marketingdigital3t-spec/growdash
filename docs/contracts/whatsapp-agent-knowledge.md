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

## Escopo da Dra. Ranniely

Quando o expert estiver vinculado ao atendimento da Dra. Ranniely, `content` deve tratar somente de **Paciente Modelo**. Não inserir ou reutilizar conhecimento de franquia, investimento, capital mínimo, sócios, expansão ou qualquer outro negócio. A limpeza desse conteúdo não autoriza excluir conversas, contatos ou mensagens históricas.
