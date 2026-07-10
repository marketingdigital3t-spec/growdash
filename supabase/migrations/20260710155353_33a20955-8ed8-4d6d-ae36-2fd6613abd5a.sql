-- Per-conversation view password (short code that gates showing decrypted content)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS view_password TEXT;

-- Backfill existing rows with a random 6-char alphanumeric code
UPDATE public.conversations
SET view_password = upper(substr(md5(random()::text || id::text), 1, 6))
WHERE view_password IS NULL;

-- Default for future rows created without explicit value
ALTER TABLE public.conversations
  ALTER COLUMN view_password SET DEFAULT upper(substr(md5(random()::text), 1, 6));

ALTER TABLE public.conversations
  ALTER COLUMN view_password SET NOT NULL;