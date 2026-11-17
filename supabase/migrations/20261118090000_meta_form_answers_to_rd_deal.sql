-- Respostas do formulário nativo da Meta → campos da negociação no RD Station.
--
-- PROBLEMA: o `field_data` do Graph API guarda as respostas do questionário
-- como um array livre `{ name, values }`. Não existe coluna para cada pergunta,
-- então as respostas nunca chegavam aos campos customizados `[GTM] ...` da
-- negociação no RD Station — elas ficavam presas no JSON bruto.
--
-- SOLUÇÃO (duas metades):
--   1. Colunas derivadas em `meta_leads` e `rd_deals` (fonte de verdade local).
--      Preenchidas por trigger no banco, para todo lead que entra.
--   2. A escrita no RD Station acontece no Edge Function `metaLeadRdSync`,
--      que já tem auditoria, portão de `write_enabled` e readback. O trigger
--      do banco NÃO chama a API do RD: escrita externa dentro de trigger
--      ignora o portão de governança e segura transação por chamada de rede.
--
-- O mapeamento pergunta → campo é por ALIAS NORMALIZADO, não por posição:
-- a Meta devolve as perguntas na ordem de criação do formulário e essa ordem
-- muda quando o anunciante edita o formulário. O alias sobrevive a
-- reordenação, a mudança de texto e a troca do formulário.
--
-- O mesmo alias precisa existir em `public.meta_form_answer_definitions`
-- (criada aqui) e em `rd_field_configs.rd_field_aliases` (configurável pela
-- tela "Campos personalizados do RD" do Growdash). Os dois lados usam a
-- mesma normalização: minúsculas, sem acento, sem pontuação.

-- ---------------------------------------------------------------------------
-- 1. Colunas derivadas
-- ---------------------------------------------------------------------------

ALTER TABLE public.meta_leads
  ADD COLUMN IF NOT EXISTS lead_situacao_profissional text,
  ADD COLUMN IF NOT EXISTS lead_especialidade text,
  ADD COLUMN IF NOT EXISTS lead_faturamento text,
  ADD COLUMN IF NOT EXISTS lead_urgencia text,
  ADD COLUMN IF NOT EXISTS lead_objetivo text;

ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS lead_situacao_profissional text,
  ADD COLUMN IF NOT EXISTS lead_especialidade text,
  ADD COLUMN IF NOT EXISTS lead_faturamento text,
  ADD COLUMN IF NOT EXISTS lead_urgencia text,
  ADD COLUMN IF NOT EXISTS lead_objetivo text;

COMMENT ON COLUMN public.meta_leads.lead_situacao_profissional IS
  'Resposta da pergunta de situação profissional no formulário nativo da Meta.';
COMMENT ON COLUMN public.meta_leads.lead_especialidade IS
  'Resposta da pergunta de especialidade/área de atuação no formulário nativo da Meta.';
COMMENT ON COLUMN public.meta_leads.lead_faturamento IS
  'Resposta da pergunta de faixa de faturamento no formulário nativo da Meta.';
COMMENT ON COLUMN public.meta_leads.lead_urgencia IS
  'Resposta da pergunta de urgência para iniciar a formação no formulário nativo da Meta.';
COMMENT ON COLUMN public.meta_leads.lead_objetivo IS
  'Resposta da pergunta de principal objetivo no formulário nativo da Meta.';

-- ---------------------------------------------------------------------------
-- 2. Catálogo de perguntas e aliases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meta_form_answer_definitions (
  answer_key text PRIMARY KEY,
  question_label text NOT NULL,
  rd_field_aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.meta_form_answer_definitions (answer_key, question_label, rd_field_aliases)
VALUES
  ('situacao_profissional', 'Situação profissional', ARRAY['situacao profissional','situacao_profissional','tipo de publico','tipo publico']),
  ('especialidade', 'Especialidade ou área de atuação', ARRAY['especialidade','area de atuacao','area_de_atuacao','especialidade ou area de atuacao']),
  ('faturamento', 'Faixa de faturamento líquido mensal', ARRAY['faturamento','faturamento liquido mensal','faturamento mensal','faturamento_liquido_mensal']),
  ('urgencia', 'Urgência para iniciar a formação', ARRAY['urgencia','urgencia para iniciar','urgencia_para_iniciar']),
  ('objetivo', 'Principal objetivo ao aprender Ninfoplastia', ARRAY['objetivo','objetivo principal','principal objetivo','objetivo_principal'])
ON CONFLICT (answer_key) DO UPDATE
  SET question_label = EXCLUDED.question_label,
      rd_field_aliases = EXCLUDED.rd_field_aliases,
      updated_at = now();

ALTER TABLE public.meta_form_answer_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View meta form answer definitions" ON public.meta_form_answer_definitions;
CREATE POLICY "View meta form answer definitions"
  ON public.meta_form_answer_definitions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Manage meta form answer definitions" ON public.meta_form_answer_definitions;
CREATE POLICY "Manage meta form answer definitions"
  ON public.meta_form_answer_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.meta_form_answer_definitions TO authenticated;
GRANT ALL ON public.meta_form_answer_definitions TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Normalização compartilhada
-- ---------------------------------------------------------------------------

-- Mesma normalização do módulo TypeScript `src/lib/metaFormAnswers.ts`:
-- minúsculas, sem acento, sem pontuação, espaços colapsados. Os marcadores
-- internos `[...]` do RD são removidos para casar "[GTM] Tipo de público"
-- com "tipo de publico".
CREATE OR REPLACE FUNCTION public.normalize_meta_answer_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(value, '')),
          '\[[^\]]*\]', ' ', 'g'
        ),
        '[̀-ͯ]', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Extração das respostas do field_data
-- ---------------------------------------------------------------------------

-- Extrai o valor de uma pergunta do `field_data` cru da Meta. O Graph API
-- devolve `values` como array; alguns formulários devolvem `value` direto.
CREATE OR REPLACE FUNCTION public.extract_meta_form_answer(field_data jsonb, question text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  wanted text;
  entry jsonb;
  raw_value jsonb;
  candidate text;
BEGIN
  IF field_data IS NULL OR jsonb_typeof(field_data) <> 'array' THEN
    RETURN NULL;
  END IF;

  wanted := public.normalize_meta_answer_key(question);
  IF wanted = '' THEN
    RETURN NULL;
  END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(field_data)
  LOOP
    IF public.normalize_meta_answer_key(entry->>'name') <> wanted THEN
      CONTINUE;
    END IF;
    raw_value := entry->'values';
    IF raw_value IS NULL THEN
      raw_value := entry->'value';
    END IF;
    IF jsonb_typeof(raw_value) = 'array' THEN
      raw_value := raw_value->>0;
    END IF;
    IF raw_value IS NULL THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(raw_value) = 'object' THEN
      candidate := coalesce(raw_value->>'label', raw_value->>'value', raw_value->>'name');
    ELSE
      candidate := raw_value::text;
    END IF;
    candidate := trim(candidate);
    IF candidate <> '' THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Preenche as colunas derivadas de `meta_leads` a partir do `field_data`.
-- Chamado pelo webhook da Meta e pelo sync do Graph API.
CREATE OR REPLACE FUNCTION public.fill_meta_lead_form_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.field_data IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.lead_situacao_profissional := public.extract_meta_form_answer(
    NEW.field_data, 'Qual é sua situação profissional?'
  );
  NEW.lead_especialidade := public.extract_meta_form_answer(
    NEW.field_data, 'Qual é a sua especialidade ou área de atuação?'
  );
  NEW.lead_faturamento := public.extract_meta_form_answer(
    NEW.field_data, 'Qual é a sua faixa de faturamento líquido mensal na atividade médica?'
  );
  NEW.lead_urgencia := public.extract_meta_form_answer(
    NEW.field_data, 'Qual é sua urgência para iniciar uma formação em Ninfoplastia?'
  );
  NEW.lead_objetivo := public.extract_meta_form_answer(
    NEW.field_data, 'Qual é seu principal objetivo ao aprender Ninfoplastia?'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_meta_lead_form_answers ON public.meta_leads;
CREATE TRIGGER trg_fill_meta_lead_form_answers
BEFORE INSERT OR UPDATE OF field_data
ON public.meta_leads
FOR EACH ROW EXECUTE FUNCTION public.fill_meta_lead_form_answers();

-- ---------------------------------------------------------------------------
-- 5. Propagação para a negociação (rd_deals)
-- ---------------------------------------------------------------------------

-- Copia as respostas do lead Meta para a negociação vinculada. O vínculo é o
-- mesmo do trigger de atribuição existente: `meta_lead_id` quando presente,
-- senão e-mail/telefone dentro da janela de 180 dias.
CREATE OR REPLACE FUNCTION public.copy_meta_form_answers_to_rd_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_key text := lower(nullif(btrim(NEW.email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.phone);
  candidate public.meta_leads%ROWTYPE;
  reference_at timestamptz;
BEGIN
  IF NEW.ad_account_id IS NULL OR (email_key IS NULL AND phone_key IS NULL) THEN
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());

  SELECT m.* INTO candidate
    FROM public.meta_leads m
   WHERE m.ad_account_id = NEW.ad_account_id
     AND m.created_time <= reference_at
     AND m.created_time >= reference_at - interval '180 days'
     AND ((email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
       OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key))
   ORDER BY CASE
      WHEN email_key IS NOT NULL AND phone_key IS NOT NULL
        AND lower(nullif(btrim(m.email), '')) = email_key
        AND public.growdash_normalize_phone(m.phone) = phone_key THEN 0
      WHEN email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key THEN 1
      ELSE 2 END,
      m.created_time DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.lead_situacao_profissional := coalesce(candidate.lead_situacao_profissional, NEW.lead_situacao_profissional);
  NEW.lead_especialidade := coalesce(candidate.lead_especialidade, NEW.lead_especialidade);
  NEW.lead_faturamento := coalesce(candidate.lead_faturamento, NEW.lead_faturamento);
  NEW.lead_urgencia := coalesce(candidate.lead_urgencia, NEW.lead_urgencia);
  NEW.lead_objetivo := coalesce(candidate.lead_objetivo, NEW.lead_objetivo);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_meta_form_answers_to_rd_deal ON public.rd_deals;
CREATE TRIGGER trg_copy_meta_form_answers_to_rd_deal
BEFORE INSERT OR UPDATE OF ad_account_id, contact_email, contact_phone, lead_created_at
ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.copy_meta_form_answers_to_rd_deal();

-- ---------------------------------------------------------------------------
-- 6. Helpers de consulta para o Edge Function
-- ---------------------------------------------------------------------------

-- Resolve o rótulo do campo do RD Station mapeado para cada pergunta. O
-- Edge Function usa isto para saber em qual campo customizado gravar cada
-- resposta, sem precisar duplicar o catálogo no código.
CREATE OR REPLACE FUNCTION public.list_meta_form_answer_field_targets(_ad_account_id uuid)
RETURNS TABLE (
  answer_key text,
  rd_field_label text,
  rd_field_key text,
  rd_field_aliases text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.answer_key,
    coalesce(c.rd_field_label, c.label) AS rd_field_label,
    c.key AS rd_field_key,
    coalesce(c.rd_field_aliases, '{}') AS rd_field_aliases
  FROM public.meta_form_answer_definitions d
  LEFT JOIN LATERAL (
    SELECT cfg.rd_field_label, cfg.label, cfg.key, cfg.rd_field_aliases
      FROM public.rd_field_configs cfg
     WHERE cfg.ad_account_id = _ad_account_id
       AND cfg.rd_source = 'deal'
       AND (
         public.normalize_meta_answer_key(cfg.rd_field_label) = ANY(
           (SELECT public.normalize_meta_answer_key(alias) FROM unnest(d.rd_field_aliases) AS alias)
         )
         OR public.normalize_meta_answer_key(cfg.label) = ANY(
           (SELECT public.normalize_meta_answer_key(alias) FROM unnest(d.rd_field_aliases) AS alias)
         )
         OR public.normalize_meta_answer_key(cfg.key) = ANY(
           (SELECT public.normalize_meta_answer_key(alias) FROM unnest(d.rd_field_aliases) AS alias)
         )
       )
     ORDER BY cfg.updated_at DESC
     LIMIT 1
  ) c ON true
  WHERE d.answer_key = ANY(ARRAY['situacao_profissional','especialidade','faturamento','urgencia','objetivo']);
$$;

REVOKE ALL ON FUNCTION public.normalize_meta_answer_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extract_meta_form_answer(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fill_meta_lead_form_answers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_meta_form_answers_to_rd_deal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_meta_form_answer_field_targets(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_meta_answer_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.extract_meta_form_answer(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fill_meta_lead_form_answers() TO service_role;
GRANT EXECUTE ON FUNCTION public.copy_meta_form_answers_to_rd_deal() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_meta_form_answer_field_targets(uuid) TO service_role;
