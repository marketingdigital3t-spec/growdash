
-- Nova tabela só para o material privado
CREATE TABLE public.user_private_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_private_key text NOT NULL,
  salt text NOT NULL,
  iv text NOT NULL,
  iterations integer NOT NULL DEFAULT 600000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_private_keys TO authenticated;
GRANT ALL ON public.user_private_keys TO service_role;
ALTER TABLE public.user_private_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own private key"
  ON public.user_private_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner inserts own private key"
  ON public.user_private_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates own private key"
  ON public.user_private_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_user_private_keys_updated_at
  BEFORE UPDATE ON public.user_private_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reduz user_keys pra só chave pública
ALTER TABLE public.user_keys
  DROP COLUMN encrypted_private_key,
  DROP COLUMN salt,
  DROP COLUMN iv,
  DROP COLUMN iterations;
