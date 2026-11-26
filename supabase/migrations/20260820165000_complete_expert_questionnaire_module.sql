-- Complete the expert questionnaire module without rewriting the migration
-- already recorded in production. Future links use an editable brand template;
-- sent links retain a question snapshot in public.questionarios.

CREATE TABLE IF NOT EXISTS public.questionario_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 2 AND 200),
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(perguntas) = 'array'),
  atualizado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, marca_id)
);

CREATE INDEX IF NOT EXISTS questionario_modelos_workspace_marca_idx
  ON public.questionario_modelos(workspace_id, marca_id);

ALTER TABLE public.questionario_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read questionnaire templates" ON public.questionario_modelos;
CREATE POLICY "Members read questionnaire templates"
  ON public.questionario_modelos FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers manage questionnaire templates" ON public.questionario_modelos;
CREATE POLICY "Managers manage questionnaire templates"
  ON public.questionario_modelos FOR ALL TO authenticated
  USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id) AND atualizado_por = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_public_expert_questionnaire(p_token uuid, p_respostas jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.expert_links%ROWTYPE;
  questionnaire_row public.questionarios%ROWTYPE;
  answer_id uuid;
  question jsonb;
  question_id text;
  question_type text;
  answer jsonb;
  answer_value text;
  known_question_ids text[] := ARRAY[]::text[];
  submitted_key text;
BEGIN
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' OR octet_length(p_respostas::text) > 50000 THEN
    RAISE EXCEPTION 'Respostas inválidas' USING ERRCODE = '22023';
  END IF;

  PERFORM public.expire_expert_questionnaire_links();
  SELECT * INTO link_row FROM public.expert_links
  WHERE token = p_token AND status = 'pendente' AND expira_em > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link expirado ou indisponível' USING ERRCODE = '42501'; END IF;

  SELECT * INTO questionnaire_row FROM public.questionarios WHERE id = link_row.questionario_id;
  IF NOT FOUND OR jsonb_array_length(questionnaire_row.perguntas) = 0 THEN
    RAISE EXCEPTION 'Questionário indisponível' USING ERRCODE = '22023';
  END IF;

  FOR question IN SELECT value FROM jsonb_array_elements(questionnaire_row.perguntas)
  LOOP
    question_id := nullif(trim(question->>'id'), '');
    question_type := coalesce(question->>'tipo', 'texto');
    IF question_id IS NULL OR question_type NOT IN ('texto', 'multipla_escolha', 'selecao_unica', 'selecao', 'numero', 'data') THEN
      RAISE EXCEPTION 'Questionário inválido' USING ERRCODE = '22023';
    END IF;
    known_question_ids := array_append(known_question_ids, question_id);
    answer := p_respostas -> question_id;
    IF coalesce((question->>'obrigatoria')::boolean, true) AND (
      answer IS NULL OR answer = 'null'::jsonb OR
      (jsonb_typeof(answer) = 'string' AND trim(answer #>> '{}') = '') OR
      (jsonb_typeof(answer) = 'array' AND jsonb_array_length(answer) = 0)
    ) THEN RAISE EXCEPTION 'A pergunta "%" é obrigatória', coalesce(question->>'titulo', question_id) USING ERRCODE = '22023'; END IF;
    IF answer IS NULL OR answer = 'null'::jsonb THEN CONTINUE; END IF;

    IF question_type IN ('texto', 'numero', 'data', 'selecao_unica', 'selecao') THEN
      IF jsonb_typeof(answer) <> 'string' THEN RAISE EXCEPTION 'Resposta inválida' USING ERRCODE = '22023'; END IF;
      answer_value := trim(answer #>> '{}');
      IF char_length(answer_value) > 3000 THEN RAISE EXCEPTION 'Resposta muito longa' USING ERRCODE = '22023'; END IF;
      IF question_type = 'numero' AND answer_value <> '' AND answer_value !~ '^-?[0-9]+([.,][0-9]+)?$' THEN RAISE EXCEPTION 'Número inválido' USING ERRCODE = '22023'; END IF;
      IF question_type = 'data' AND answer_value <> '' AND answer_value !~ '^\\d{4}-\\d{2}-\\d{2}$' THEN RAISE EXCEPTION 'Data inválida' USING ERRCODE = '22023'; END IF;
      IF question_type IN ('selecao_unica', 'selecao') AND answer_value <> '' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(question->'opcoes', '[]'::jsonb)) option WHERE option = answer_value) THEN RAISE EXCEPTION 'Opção inválida' USING ERRCODE = '22023'; END IF;
    ELSIF question_type = 'multipla_escolha' THEN
      IF jsonb_typeof(answer) <> 'array' OR jsonb_array_length(answer) > 30 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(answer) item
        WHERE jsonb_typeof(item) <> 'string' OR char_length(trim(item #>> '{}')) > 300
          OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(question->'opcoes', '[]'::jsonb)) option WHERE option = trim(item #>> '{}'))
      ) THEN RAISE EXCEPTION 'Opções inválidas' USING ERRCODE = '22023'; END IF;
    END IF;
  END LOOP;

  FOR submitted_key IN SELECT jsonb_object_keys(p_respostas)
  LOOP
    IF NOT submitted_key = ANY(known_question_ids) THEN RAISE EXCEPTION 'Resposta para pergunta desconhecida' USING ERRCODE = '22023'; END IF;
  END LOOP;

  INSERT INTO public.questionario_respostas(workspace_id, questionario_id, marca_id, expert_id, link_id, respostas)
  VALUES (link_row.workspace_id, link_row.questionario_id, questionnaire_row.marca_id, link_row.expert_id, link_row.id, p_respostas)
  RETURNING id INTO answer_id;
  UPDATE public.expert_links SET status = 'respondido', token = NULL, respondido_em = now() WHERE id = link_row.id;
  RETURN answer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_expert_questionnaire(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_expert_questionnaire(uuid, jsonb) TO anon, authenticated;

DO $$
DECLARE existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'growdash-expire-expert-questionnaire-links' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN PERFORM cron.unschedule(existing_job_id); END IF;
END
$$;

SELECT cron.schedule(
  'growdash-expire-expert-questionnaire-links',
  '7 * * * *',
  $cron$SELECT public.expire_expert_questionnaire_links();$cron$
);
