-- Métricas opcionais de vídeo. A API do Instagram não entrega retenção para
-- todos os formatos/contas, portanto os campos aceitam NULL e não fabricam 0%.
ALTER TABLE IF EXISTS public.social_media
  ADD COLUMN IF NOT EXISTS average_watch_time numeric(12,3),
  ADD COLUMN IF NOT EXISTS video_retention_rate numeric(10,4);
