# Chat seguro de acompanhamento pós-op (LGPD)

Feature nova, isolada da aba WhatsApp atual. Foco: privacidade máxima, isolamento por par paciente↔profissional, trilha de auditoria.

## Fluxo do usuário

**Profissional (Dra.)**
- Nova aba na sidebar: **"Chat seguro"**
- Vê a lista das próprias pacientes vinculadas → abre uma conversa → troca mensagens de texto + fotos
- Pode revogar acesso da paciente / arquivar conversa

**Paciente**
- Faz login e vê apenas a sua conversa com a Dra. responsável
- Envia texto e fotos de acompanhamento; vê histórico

## Segurança (LGPD - dado sensível de saúde, art. 11)

1. **Autenticação obrigatória** (email + senha, com HIBP habilitado)
2. **Papéis separados**: `admin`, `professional`, `patient` em tabela `user_roles` (nunca no profile)
3. **Vínculo explícito** paciente↔profissional em `patient_links` — sem vínculo = sem acesso
4. **RLS estrita** em todas as tabelas:
   - Paciente só lê/escreve mensagens onde é participante
   - Profissional só lê/escreve mensagens de pacientes vinculadas
   - Ninguém lê conversas alheias, nem admin sem consentimento
5. **Storage privado** (bucket `patient-photos`, `public: false`) — acesso só via URL assinada de curta duração (5 min), gerada por edge function que revalida vínculo
6. **Consentimento**: modal de aceite LGPD no 1º acesso da paciente, gravado em `lgpd_consents` (timestamp, IP, texto da versão aceita)
7. **Auditoria**: tabela `audit_log` registra visualizações e exclusões de fotos
8. **Exclusão sob demanda** (direito ao esquecimento) — botão "Excluir meus dados" para a paciente
9. **Sem retenção automática** (conforme sua escolha) — cabe à clínica gerenciar

## Modelo de dados

```text
profiles(id, full_name, avatar_url, created_at)
user_roles(user_id, role)                       -- admin|professional|patient
patient_links(patient_id, professional_id, status, created_at)
conversations(id, patient_id, professional_id, created_at, archived)
messages(id, conversation_id, sender_id, kind, body, photo_path, created_at)
lgpd_consents(id, user_id, version, accepted_at, ip)
audit_log(id, actor_id, action, target_type, target_id, created_at)
storage: bucket "patient-photos" (privado)
```

Grants + RLS + trigger `handle_new_user` para criar profile automático.

## Edge functions

- `signed-photo-url` — recebe `message_id`, revalida participação, devolve URL assinada
- `upload-photo` — recebe imagem, valida vínculo, grava em `patient-photos/{conversation_id}/{uuid}.jpg`, cria mensagem, loga auditoria

## UI

- **Sidebar** → novo item "Chat seguro" (ícone cadeado)
- **/chat-seguro** → layout 2 colunas: lista de conversas (esq.) + thread (dir.)
- Composer com botão de foto (drag-drop desktop, câmera no mobile), preview antes de enviar
- Bolhas de mensagem com timestamp; fotos abrem em lightbox com marca d'água discreta "Confidencial — {nome} — {data}"
- Empty state didático explicando o funcionamento
- Banner LGPD no topo da conversa da paciente

## O que fica fora deste passo

- **SaaS/pagamento mensal** para liberar acesso — feature grande, faço em seguida num passo próprio (Stripe Payments da Lovable). Por enquanto, o acesso é liberado por login criado manualmente.
- Chamada de vídeo, notificações push, apagamento automático programado
- Cadastro em massa de pacientes (fica para o próximo passo junto do pagamento)

## Ordem de execução

1. Ativar Lovable Cloud
2. Criar migração (tabelas + RLS + grants + trigger + bucket privado)
3. Implementar edge functions `upload-photo` e `signed-photo-url`
4. Auth pages (login/signup + reset) e guarda de rotas por papel
5. Página `/chat-seguro` + componentes de lista, thread, composer, lightbox
6. Modal de consentimento LGPD no 1º login da paciente
7. Item de sidebar + rota
8. Teste manual do fluxo ponta-a-ponta

Confirma que posso seguir? Assim que aprovar, executo tudo de uma vez.
