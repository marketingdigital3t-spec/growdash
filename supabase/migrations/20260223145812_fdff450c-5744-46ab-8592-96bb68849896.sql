
-- Add daily_budget and remaining_balance columns to ad_accounts
ALTER TABLE public.ad_accounts 
ADD COLUMN daily_budget numeric DEFAULT NULL,
ADD COLUMN remaining_balance numeric DEFAULT NULL;
