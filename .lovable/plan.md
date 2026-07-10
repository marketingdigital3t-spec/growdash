## Objetivo

Evoluir o Chat Seguro atual sem quebrar o E2E (AES-256-GCM + escrow admin) já existente. Você marcou tanto "ajustes pontuais" quanto "refazer do zero" — vou seguir pelo caminho seguro (ajustes), porque refazer do zero apagaria as chaves E2E, o histórico cifrado e o escrow admin já configurados, e as tabelas do prompt (clinics/doctors/patients) duplicariam o que já existe (`profiles` + `user_roles` + `conversations`).

Se depois quiser mesmo recomeçar do zero, faço em uma etapa separada.

## O que muda

### 1. Senha da conversa: fixa por conversa, renovável
- Remover a rotação diária às 3h.
- Cada `conversation` passa a ter um `access_code` fixo de 6 caracteres alfanuméricos (A–Z, 0–9), gerado na criação.
- Botão "Renovar código" (doutora ou paciente): invalida o anterior, gera outro, desbloqueia sessões abertas no aparelho de quem renovou e força reentrada do código no aparelho da outra parte.
- Código é exibido apenas para os dois participantes da conversa; sempre consultável no chip ao lado do nome (com botão mostrar/ocultar) como já existe hoje.
- Desbloqueio continua sendo por aparelho (sessionStorage), não vaza para outros dispositivos.

### 2. Visão isolada da paciente
- Nova rota `/minha-conversa` só para papel `patient`.
- Sem sidebar de conversas, sem lista de outras pacientes. Layout de tela única: cabeçalho com nome da doutora + campo de código + área de mensagens + composer.
- Se a paciente cair em `/chat-seguro`, redireciona para `/minha-conversa`.
- Doutora/admin continua com a visão atual (lista lateral + várias conversas).

### 3. LGPD — direitos da paciente
- Botão "Exportar meus dados": gera um JSON com perfil + mensagens de texto descriptografadas no navegador + lista das fotos (com data e id), baixado localmente. Ação registrada em `audit_log` (`data_exported`).
- Botão "Solicitar exclusão de todas as minhas fotos": cria um pedido em nova tabela `data_deletion_requests` (status pending/approved/rejected/done, prazo 7 dias). Admin vê a fila em uma tela simples e marca como atendido; ao aprovar, uma edge function apaga as fotos do storage e as mensagens `photo` daquela paciente.
- Toda ação registrada em `audit_log` + `security_events` (já existentes).

### 4. Não entra agora
- Auto-destruição de fotos (24h/7d/após ler): você marcou "agora não".
- "Apagar meu histórico agora" e notificações push/e-mail/SMS: fora do escopo desta rodada.

## Detalhes técnicos

Banco:
- `conversations`: renomear/reutilizar coluna `view_password` como `access_code` (fixa, 6 chars, default aleatório). Remover uso de `conversation_access_codes` diárias e a função `ensure_conversation_access_code`.
- Nova tabela `data_deletion_requests` (paciente_id, conversation_id, scope='photos', status, requested_at, resolved_at, resolver_id, notes) com RLS: paciente lê/insere as próprias, admin lê/atualiza todas.
- Nova função `rotate_conversation_access_code(_conversation_id)` (SECURITY INVOKER) que só participante da conversa pode chamar; retorna o novo código.
- GRANTs completos em toda tabela nova; RLS ligado; policies scoped a `auth.uid()`.

Frontend:
- `ChatSeguro.tsx`: remover `ensureAccessCode` diário + intervalo de 60s; usar `access_code` da própria linha de `conversations`; botão "Renovar código" chamando a RPC.
- Nova página `src/pages/chat/MinhaConversa.tsx` reutilizando `MessageBubble`, `WatermarkedImage`, `useCrypto` — sem sidebar.
- Roteamento em `src/App.tsx` + `ProtectedRoute`: paciente → `/minha-conversa`; profissional/admin → `/chat-seguro`.
- Novo painel admin `src/pages/admin/SolicitacoesLgpd.tsx` para aprovar/rejeitar pedidos de exclusão.

Edge function:
- `lgpd-delete-photos`: recebe `request_id`, valida admin, apaga objetos do bucket `patient-photos` referentes às mensagens da paciente, apaga as linhas `messages` do tipo `photo`, marca o pedido como `done` e grava `audit_log`.

Segurança mantida:
- E2E AES-256-GCM continua igual; o `access_code` é apenas um gate de UI local, não é a chave de descriptografia.
- Cofre por senha (RSA-OAEP + PBKDF2 600k) permanece.
- Escrow admin permanece.
- Watermark dinâmico nas fotos permanece.

## Fora do escopo (não vou fazer agora)

- Recriar tabelas `clinics/doctors/patients` (o app já usa `profiles` + `user_roles`).
- Auto-destruição temporizada de fotos.
- Push/SMS/e-mail de nova mensagem.
- Substituir Supabase Storage por S3.
- Contratação de DPO e redação jurídica dos termos (isso é externo ao código).

Confirma para eu implementar?