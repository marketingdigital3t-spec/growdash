-- Agenda archiving and canonical Google Sheets sales fields.
-- The migration is additive: existing RD/Meta links and imported rows remain valid.

ALTER TABLE public.event_classes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS event_classes_archive_idx
  ON public.event_classes (archived_at, date_start);

ALTER TABLE public.expert_sheet_connections
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_header_signature text;

ALTER TABLE public.expert_sheet_connections
  DROP CONSTRAINT IF EXISTS expert_sheet_connections_source_type_check;

ALTER TABLE public.expert_sheet_connections
  ADD CONSTRAINT expert_sheet_connections_source_type_check
  CHECK (source_type IN ('student', 'model_patient', 'sales'));

-- A consolidated sales source is a third connection for the same expert. The
-- legacy constraint keyed only by participant_type would overwrite the
-- student's sheet when the sales sheet is saved.
ALTER TABLE public.expert_sheet_connections
  DROP CONSTRAINT IF EXISTS expert_sheet_connections_expert_id_participant_type_key;
ALTER TABLE public.expert_sheet_connections
  ADD CONSTRAINT expert_sheet_connections_expert_source_type_key UNIQUE (expert_id, source_type);

ALTER TABLE public.expert_sales
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS class_date date,
  ADD COLUMN IF NOT EXISTS future_revenue_cents integer NOT NULL DEFAULT 0 CHECK (future_revenue_cents >= 0),
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_condition text,
  ADD COLUMN IF NOT EXISTS reconciliation_status text,
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS contract_signed boolean,
  ADD COLUMN IF NOT EXISTS source_row_key text,
  ADD COLUMN IF NOT EXISTS source_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS expert_sales_source_active_idx
  ON public.expert_sales (expert_id, source_active, sale_date);
CREATE INDEX IF NOT EXISTS expert_sales_cpf_idx
  ON public.expert_sales (expert_id, cpf)
  WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS expert_sales_source_key_idx
  ON public.expert_sales (sheet_connection_id, source_row_key)
  WHERE source_row_key IS NOT NULL;

ALTER TABLE public.expert_sales
  DROP CONSTRAINT IF EXISTS expert_sales_source_key_unique;
ALTER TABLE public.expert_sales
  ADD CONSTRAINT expert_sales_source_key_unique UNIQUE (sheet_connection_id, source_row_key);

COMMENT ON COLUMN public.expert_sheet_connections.column_mapping IS
  'Normalized source header to canonical expert_sales field mapping.';
COMMENT ON COLUMN public.expert_sales.raw_row IS
  'Original Google Sheets row retained for audit and remapping.';
