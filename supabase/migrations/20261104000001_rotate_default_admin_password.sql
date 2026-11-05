-- C2: Invalida a senha literal 'admin' gravada na migration 20260525123917
-- A senha é substituída por um hash aleatório irreversível gerado no banco,
-- impossibilitando qualquer autenticação pela credencial pública do repositório.
-- A conta não é excluída para preservar o histórico/propriedade, mas é marcada
-- para revisão de segurança em raw_user_meta_data.

-- pgcrypto é instalado no schema `extensions` neste projeto (ver
-- 20260723030000_daily_previous_day_incremental_sync.sql), então as funções
-- precisam ser qualificadas: sem o prefixo o PostgreSQL não as encontra.
UPDATE auth.users
SET encrypted_password = crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"security_review_required": true, "password_reset_reason": "default_credentials_rotated_20261104"}'::jsonb,
    updated_at = now()
WHERE email = 'admin@users.local';
