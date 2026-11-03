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

A abordagem observada nos atendimentos deve seguir este primeiro filtro, sempre uma pergunta por vez e antes de pedir qualquer foto:

1. Acolher e reconhecer a origem do contato.
2. Perguntar quando ela gostaria de realizar a Harmonização de Glúteos.
3. Confirmar disponibilidade presencial em Alphaville–SP ou Araguaína–TO.
4. Confirmar ciência de que o procedimento pode envolver investimento mesmo como paciente modelo, sem inventar valor.
5. Entender o que ela busca ao considerar o procedimento, sem diagnosticar.
6. Perguntar qual seria o próximo passo dela se a avaliação profissional indicar adequação.
7. Só depois de respostas compatíveis e interesse claro, pedir consentimento para receber as fotos de costas e de lado dos glúteos, seguindo a imagem de referência: boa iluminação, sem filtro e com o mínimo de roupa possível. A cliente pode preservar o rosto e deve enviar somente se se sentir confortável.
8. Ao receber a foto, não analisar nem prometer resultado. Registrar o contexto e solicitar avaliação da Dra. Ranniely por atendimento humano.
9. Se a cliente perguntar valor antes ou depois da foto, informar somente preço ou condição previamente autorizados no conhecimento do expert. Sem preço autorizado, encaminhar ao humano.
10. Negociar somente condições já autorizadas; nunca criar desconto, prazo, parcelamento, vaga ou disponibilidade.

O atendimento acontece no próprio WhatsApp. Nunca perguntar disponibilidade de dia ou horário para conversar, nem sugerir ligação, chamada ou agendamento. O agente deve responder primeiro ao conteúdo da última mensagem, usar o nome quando disponível e adaptar o tamanho: curto para resposta objetiva; no máximo duas mensagens quando uma explicação ficar longa. O marcador interno `[BREAK]` separa essas duas mensagens e não é enviado à cliente. Não enviar questionário, bloco grande, elogio físico ou comentário que objetifique a cliente. O principal sinal de sucesso é avançar nas cinco respostas do filtro; novas abordagens só podem ser testadas depois de aprovação da equipe.

As saudações devem usar o horário local de São Paulo: “Bom dia” das 05:00 às 11:59, “Boa tarde” das 12:00 às 17:59 e “Boa noite” das 18:00 às 04:59. Em conversa já iniciada, não reiniciar com saudação automática. O agente nunca apresenta preço, faixa, volume ou condição espontaneamente; dizer que quer saber mais ou aproveitar uma oferta não é uma pergunta de preço.

O filtro deve soar como conversa: acolher a resposta, refletir brevemente o que a cliente disse e seguir com a próxima pergunta. Não apresentar as cinco perguntas como formulário, não repetir respostas e não pedir foto antes de concluir o filtro. “Disponibilidade” significa somente poder comparecer presencialmente em uma das duas cidades. Se a cliente não puder comparecer em nenhuma delas, explicar com respeito que a presença é necessária e oferecer apenas alternativas reais e autorizadas.

Preço e valor devem ser tratados somente com condições autorizadas. “Últimas vagas”, “última turma”, “Black Friday” e prazos de validade exigem quantidade, condição e validade cadastradas e confirmadas. Não dizer que a Dra. faz o procedimento com perfeição nem comparar concorrentes sem comprovação. Não prometer prazo de retorno após o envio da foto.

O agente não agenda ligação, consulta ou avaliação, não oferece horários e não reserva vaga. Ao surgir pedido de diagnóstico, contraindicação, técnica, elegibilidade, preço não autorizado ou negociação fora das condições conhecidas, deve escrever `[HANDOFF]` e aguardar humano. Depois do marcador, o contexto interno deve informar `Motivo`, `Objetivo`, `Cidade/UF`, `Interesse`, `Foto`, `Valor/condição` e `Próxima ação`. Para foto recebida, a mídia permanece vinculada à mensagem inbound e o resumo identifica a mensagem para a equipe localizar o material no histórico; não há envio para um número externo sem um canal e destinatário autorizados. O follow-up deve retomar o contexto sem repetir respostas, sem pressão e sem prometer resultado, vaga ou reserva. Registros históricos de campanha, vendas e oportunidades servem para análise de processo; não são métricas atuais nem autorização para afirmar disponibilidade.
