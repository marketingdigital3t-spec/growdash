# Migração do SDR para Supabase na Hostinger — 2026-11-02

## Estado validado

- Host: `srv1671115` (`2.24.99.35`), serviço em `/opt/novo-sdr`.
- Banco ativo do backend: Supabase Postgres, schema `sdr`, projeto `rdzgadospazfzakjuhki`.
- O compose efetivo é `compose.hostinger.yaml` + `compose.hostinger.supabase.yaml`.
- MariaDB continua em execução como rollback (`novo-sdr-hg-db`); não apagar o volume sem autorização.
- Volume de sessão do WhatsApp preservado em `novo_sdr_novo_sdr_hg_sessions`.
- Painel validado: `Mariana` e `PM - Dra Ranniely` aparecem como `CONNECTED`; não houve novo QR.
- IA validada no ambiente do backend: `OPENAI_QUALIFIER_ENABLED=true`, modelo configurado `gpt-6-luna`.
- Duplicidade validada no Supabase: nenhum grupo de `Contacts.number` duplicado.

## Cópia de dados

Backup preservado em `/opt/novo-sdr/backups/novo-sdr-20261102-151602.sql.gz`.

O script temporário `/opt/novo-sdr/migrate-mariadb-to-postgres.cjs` copia apenas colunas comuns entre MariaDB e Postgres, em lotes de 250, usando `ON CONFLICT DO NOTHING`, e reajusta sequências. Para executar novamente, corrigir o quoting MySQL/Postgres conforme o script atual e rodar dentro do container do backend com as variáveis do `/opt/novo-sdr/.env`; nunca imprimir o `.env`.

A cópia de 2026-11-02 adicionou ao Supabase os registros ausentes do MariaDB sem apagar dados já existentes:

- `Whatsapps`: 1
- `Contacts`: 645
- `Tickets`: 448
- `Messages`: 12.949
- `Users`: 1
- `Settings`: 2
- demais tabelas sem registros novos

## Rollback

1. Manter a sessão e o MariaDB intactos.
2. Para voltar ao MariaDB, subir somente `compose.hostinger.yaml` e validar os logs antes de qualquer ação no volume.
3. Para retornar ao Supabase, usar novamente os dois arquivos de compose e confirmar `DB_DIALECT=postgres`, `DB_SCHEMA=sdr` e o host pooler do Supabase.
4. Nunca remover o banco/volume ou desconectar uma sessão WhatsApp como parte de um rollback automático.

## Verificações obrigatórias

- `docker compose -f compose.hostinger.yaml -f compose.hostinger.supabase.yaml config` deve resolver Postgres e schema `sdr`.
- `docker inspect novo-sdr-hg-backend` deve mostrar os dois arquivos de compose.
- Logs devem mostrar `Server started`, `Session connected` e migrações sem alterações inesperadas.
- Abrir `/atendimento/connections` autenticado e conferir o nome e o status da sessão.
