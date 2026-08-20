-- Additive foundation for expert-specific brand questionnaires and expert content.
-- Existing company, finance, lead and CRM structures are intentionally untouched.

CREATE TABLE IF NOT EXISTS public.experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 160),
  email text,
  whatsapp text,
  nicho text NOT NULL CHECK (nicho IN ('estetica', 'moda')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, nome)
);

CREATE TABLE IF NOT EXISTS public.questionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 2 AND 200),
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(perguntas) = 'array'),
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- The editable brand template is kept separately from each immutable
-- questionnaire snapshot sent to an expert. Changing a future questionnaire
-- must never alter the questions that produced an already submitted answer.
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

CREATE TABLE IF NOT EXISTS public.expert_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  questionario_id uuid NOT NULL REFERENCES public.questionarios(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  token uuid UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondido', 'vencido', 'revogado')),
  expira_em timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz
);

CREATE TABLE IF NOT EXISTS public.questionario_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  questionario_id uuid NOT NULL REFERENCES public.questionarios(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  link_id uuid UNIQUE NOT NULL REFERENCES public.expert_links(id) ON DELETE RESTRICT,
  respostas jsonb NOT NULL CHECK (jsonb_typeof(respostas) = 'object'),
  status text NOT NULL DEFAULT 'respondido' CHECK (status = 'respondido'),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 160),
  capacidade integer NOT NULL CHECK (capacidade >= 0),
  vagas_preenchidas integer NOT NULL DEFAULT 0 CHECK (vagas_preenchidas >= 0 AND vagas_preenchidas <= capacidade),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conteudo_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 2 AND 240),
  tema text NOT NULL DEFAULT '',
  tipo text NOT NULL CHECK (tipo IN ('atracao', 'educacao')),
  prazo date NOT NULL,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'em_producao', 'publicado')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estrategia_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  aceitou boolean NOT NULL DEFAULT true CHECK (aceitou),
  aceito_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, expert_id, marca_id)
);

CREATE TABLE IF NOT EXISTS public.estrategia_conteudo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(conteudo) = 'object'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, marca_id)
);

CREATE INDEX IF NOT EXISTS questionarios_workspace_marca_idx ON public.questionarios(workspace_id, marca_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS questionario_modelos_workspace_marca_idx ON public.questionario_modelos(workspace_id, marca_id);
CREATE INDEX IF NOT EXISTS expert_links_lookup_idx ON public.expert_links(token) WHERE token IS NOT NULL AND status = 'pendente';
CREATE INDEX IF NOT EXISTS expert_links_workspace_expert_idx ON public.expert_links(workspace_id, expert_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS questionario_respostas_scope_idx ON public.questionario_respostas(workspace_id, marca_id, expert_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS turmas_scope_idx ON public.turmas(workspace_id, marca_id);
CREATE INDEX IF NOT EXISTS conteudo_calendario_scope_idx ON public.conteudo_calendario(workspace_id, marca_id, prazo);

ALTER TABLE public.experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionario_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionario_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conteudo_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estrategia_aceites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estrategia_conteudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read experts" ON public.experts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage experts" ON public.experts FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));

CREATE POLICY "Members read questionnaires" ON public.questionarios FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage questionnaires" ON public.questionarios FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read questionnaire templates" ON public.questionario_modelos FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage questionnaire templates" ON public.questionario_modelos FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id) AND atualizado_por = auth.uid());
CREATE POLICY "Members read expert links" ON public.expert_links FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage expert links" ON public.expert_links FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read questionnaire answers" ON public.questionario_respostas FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage questionnaire answers" ON public.questionario_respostas FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read classes" ON public.turmas FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage classes" ON public.turmas FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read content calendar" ON public.conteudo_calendario FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage content calendar" ON public.conteudo_calendario FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read strategy accepts" ON public.estrategia_aceites FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members record own strategy accepts" ON public.estrategia_aceites FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND aceito_por = auth.uid());
CREATE POLICY "Managers manage strategy accepts" ON public.estrategia_aceites FOR UPDATE TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members read strategy content" ON public.estrategia_conteudo FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Managers manage strategy content" ON public.estrategia_conteudo FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));

CREATE OR REPLACE FUNCTION public.expire_expert_questionnaire_links()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.expert_links SET status = 'vencido', token = NULL
  WHERE status = 'pendente' AND expira_em <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_growdash_questionnaire_experts(p_workspace_id uuid)
RETURNS SETOF public.experts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_workspace(p_workspace_id) THEN RAISE EXCEPTION 'Sem permissão para configurar experts'; END IF;
  INSERT INTO public.experts(workspace_id, nome, nicho) VALUES
    (p_workspace_id, 'Dra. Ranniely Silva', 'estetica'),
    (p_workspace_id, 'Dr. José', 'estetica'),
    (p_workspace_id, 'Henrique', 'estetica'),
    (p_workspace_id, 'Dra. Nathalia Barragão', 'estetica'),
    (p_workspace_id, 'Giana', 'moda')
  ON CONFLICT (workspace_id, nome) DO NOTHING;
  RETURN QUERY SELECT * FROM public.experts WHERE workspace_id = p_workspace_id ORDER BY nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_expert_questionnaire(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_data record;
BEGIN
  PERFORM public.expire_expert_questionnaire_links();
  SELECT l.id, l.expira_em, q.titulo, q.perguntas, e.nome, c.name AS marca_nome
    INTO row_data
  FROM public.expert_links l
  JOIN public.questionarios q ON q.id = l.questionario_id
  JOIN public.experts e ON e.id = l.expert_id
  JOIN public.companies c ON c.id = q.marca_id
  WHERE l.token = p_token AND l.status = 'pendente' AND l.expira_em > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('titulo', row_data.titulo, 'perguntas', row_data.perguntas, 'expert_nome', row_data.nome, 'marca_nome', row_data.marca_nome, 'expira_em', row_data.expira_em);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_expert_questionnaire(p_token uuid, p_respostas jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' OR octet_length(p_respostas::text) > 50000 THEN RAISE EXCEPTION 'Respostas inválidas' USING ERRCODE = '22023'; END IF;
  PERFORM public.expire_expert_questionnaire_links();
  SELECT * INTO link_row FROM public.expert_links WHERE token = p_token AND status = 'pendente' AND expira_em > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link expirado ou indisponível' USING ERRCODE = '42501'; END IF;
  SELECT * INTO questionnaire_row FROM public.questionarios WHERE id = link_row.questionario_id;
  IF NOT FOUND OR jsonb_array_length(questionnaire_row.perguntas) = 0 THEN RAISE EXCEPTION 'Questionário indisponível' USING ERRCODE = '22023'; END IF;

  FOR question IN SELECT value FROM jsonb_array_elements(questionnaire_row.perguntas)
  LOOP
    question_id := nullif(trim(question->>'id'), '');
    question_type := coalesce(question->>'tipo', 'texto');
    IF question_id IS NULL OR question_type NOT IN ('texto', 'multipla_escolha', 'selecao_unica', 'numero', 'data') THEN
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

    IF question_type IN ('texto', 'numero', 'data', 'selecao_unica') THEN
      IF jsonb_typeof(answer) <> 'string' THEN RAISE EXCEPTION 'Resposta inválida' USING ERRCODE = '22023'; END IF;
      answer_value := trim(answer #>> '{}');
      IF char_length(answer_value) > 3000 THEN RAISE EXCEPTION 'Resposta muito longa' USING ERRCODE = '22023'; END IF;
      IF question_type = 'numero' AND answer_value <> '' AND answer_value !~ '^-?[0-9]+([.,][0-9]+)?$' THEN RAISE EXCEPTION 'Número inválido' USING ERRCODE = '22023'; END IF;
      IF question_type = 'data' AND answer_value <> '' AND answer_value !~ '^\\d{4}-\\d{2}-\\d{2}$' THEN RAISE EXCEPTION 'Data inválida' USING ERRCODE = '22023'; END IF;
      IF question_type = 'selecao_unica' AND answer_value <> '' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(question->'opcoes', '[]'::jsonb)) option WHERE option = answer_value) THEN RAISE EXCEPTION 'Opção inválida' USING ERRCODE = '22023'; END IF;
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
  VALUES (link_row.workspace_id, link_row.questionario_id, questionnaire_row.marca_id, link_row.expert_id, link_row.id, p_respostas) RETURNING id INTO answer_id;
  UPDATE public.expert_links SET status = 'respondido', token = NULL, respondido_em = now() WHERE id = link_row.id;
  RETURN answer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_expert_questionnaire_links() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_growdash_questionnaire_experts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_expert_questionnaire(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_expert_questionnaire(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_expert_questionnaire(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_expert_questionnaire(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_growdash_questionnaire_experts(uuid) TO authenticated;

COMMENT ON FUNCTION public.expire_expert_questionnaire_links() IS 'Schedule this with Supabase Cron or invoke from an Edge Function; expired tokens are erased while submitted answers remain.';

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
