-- RD can return contact identity in the inline `raw.contacts` snapshot while
-- the normalized columns remain empty. Recover only values that are already
-- present in the provider payload; do not infer identity from a name.
WITH extracted AS (
  SELECT
    id,
    NULLIF(BTRIM(COALESCE(
      raw #>> '{contacts,0,emails,0,email}',
      raw #>> '{deal_contacts,0,emails,0,email}',
      raw #>> '{contact,email}',
      raw #>> '{deal_contact,email}'
    )), '') AS contact_email,
    NULLIF(BTRIM(COALESCE(
      raw #>> '{contacts,0,phones,0,phone}',
      raw #>> '{deal_contacts,0,phones,0,phone}',
      raw #>> '{contact,phones,0,phone}',
      raw #>> '{deal_contact,phones,0,phone}',
      raw #>> '{contact,phone}',
      raw #>> '{deal_contact,phone}'
    )), '') AS contact_phone
  FROM public.rd_deals
  WHERE contact_email IS NULL OR contact_phone IS NULL
)
UPDATE public.rd_deals AS deals
SET contact_email = COALESCE(deals.contact_email, extracted.contact_email),
    contact_phone = COALESCE(deals.contact_phone, extracted.contact_phone),
    updated_at = now()
FROM extracted
WHERE deals.id = extracted.id
  AND (extracted.contact_email IS NOT NULL OR extracted.contact_phone IS NOT NULL)
  AND (deals.contact_email IS NULL OR deals.contact_phone IS NULL);
