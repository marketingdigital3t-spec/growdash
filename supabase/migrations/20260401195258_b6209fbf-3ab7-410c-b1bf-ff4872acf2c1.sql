
-- Add rd_deal_id to sales for RD Station CRM deduplication
ALTER TABLE public.sales ADD COLUMN rd_deal_id text;
CREATE UNIQUE INDEX sales_rd_deal_id_idx ON public.sales (rd_deal_id) WHERE rd_deal_id IS NOT NULL;

-- Create integrations table
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'rd_station_crm',
  webhook_secret text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
ON public.integrations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create integrations"
ON public.integrations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
ON public.integrations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
ON public.integrations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
