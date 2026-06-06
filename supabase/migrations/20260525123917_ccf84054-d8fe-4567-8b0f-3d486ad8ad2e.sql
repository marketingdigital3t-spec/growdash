
UPDATE auth.users
SET email = 'admin@users.local',
    encrypted_password = crypt('admin', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@admin.com';

UPDATE auth.identities
SET provider_id = user_id::text,
    identity_data = jsonb_set(identity_data, '{email}', '"admin@users.local"'),
    updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@users.local');

UPDATE public.profiles
SET email = 'admin@users.local'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@users.local');
