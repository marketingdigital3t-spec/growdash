CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE
        WHEN COALESCE(EXCLUDED.full_name, '') <> '' THEN EXCLUDED.full_name
        ELSE public.profiles.full_name
      END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION
    WHEN others THEN
      BEGIN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'usuario'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      EXCEPTION
        WHEN others THEN
          RAISE WARNING 'handle_new_user role insert failed for %: %', NEW.id, SQLERRM;
      END;
  END;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
