-- Ensure the REST schema cache sees columns added by the canonical Meta facts
-- migrations before the next sync persists ad set optimization goals.
NOTIFY pgrst, 'reload schema';
