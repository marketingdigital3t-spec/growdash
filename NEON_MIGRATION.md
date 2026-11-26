# Migração Supabase -> Neon

## Diagnóstico

Este projeto usa Supabase em quatro camadas:

- Auth: login, sessão e `supabase.auth`.
- Banco Postgres: tabelas, views, policies e migrations.
- RLS: policies baseadas em `auth.uid()` e funções como `is_master`.
- Edge Functions: sincronização Meta/RD, criação de usuários, IA e rotinas backend.

Neon substitui o Postgres, mas não substitui automaticamente Supabase Auth nem Supabase Edge Functions.

## Arquitetura correta

Não usar `DATABASE_URL` do Neon no front-end. Essa string contém usuário/senha do banco e vazaria no navegador.

Arquitetura recomendada:

1. Front-end React continua chamando uma API própria.
2. Backend/API guarda `DATABASE_URL` do Neon como secret.
3. Backend valida sessão/JWT do usuário.
4. Backend consulta Neon usando pool server-side.
5. RLS do Neon usa JWT/claims ou a autorização fica na camada backend.
6. Rotinas Meta/RD saem de Supabase Edge Functions e viram endpoints/jobs backend.

## Variáveis necessárias

No backend:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/dbname?sslmode=require
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@HOST/dbname?sslmode=require
JWT_SECRET=...
```

Use connection string pooled do Neon para APIs/serverless quando possível.

## Fases

### Fase 1 - Preparar Neon

- Criar projeto no Neon.
- Copiar connection string pooled.
- Rodar schema/migrations no Neon.
- Validar tabelas, índices e constraints.

### Fase 2 - Backend

- Criar API Node/Nest/Express ou Next API.
- Instalar driver Postgres/ORM.
- Mover chamadas diretas `supabase.from(...)` para endpoints backend.
- Mover `supabase.functions.invoke(...)` para endpoints/jobs backend.

### Fase 3 - Auth

Escolher uma opção:

- Manter Supabase Auth temporariamente e usar Neon só como banco.
- Migrar para Clerk/Auth0/Stack Auth e usar JWT com Neon RLS.
- Criar auth própria com cookies httpOnly, senha hasheada e sessões no banco.

### Fase 4 - Segurança

- Nunca expor `DATABASE_URL` no Vite.
- Usar cookies httpOnly ou JWT validado no backend.
- Aplicar RLS no Neon ou authorization server-side.
- Separar permissões de dono/admin/usuário.
- Criptografar tokens sensíveis Meta/RD no banco.

## Próximo passo obrigatório

Para iniciar a conexão real, informe a connection string pooled do Neon ou adicione no `.env` local como `DATABASE_URL`.

Sem isso, não é possível conectar no Neon nem migrar dados.
