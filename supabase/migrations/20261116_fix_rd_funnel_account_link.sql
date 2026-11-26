-- ============================================================================
-- Migration: 20261116_fix_rd_funnel_account_link.sql
-- Ataque 2 do plano de auditoria Growdash — corrigir vínculo contas Meta ↔ funis RD
--
-- Este arquivo é executado pelo usuário no SQL Editor do Supabase
-- (https://app.supabase.com → projeto Growdash → SQL Editor).
--
-- Não existe nenhum arquivo de migration anterior que corrija o vínculo
-- entre contas Meta e funis RD Station. O problema está nos dados do banco:
-- funis de Ranniely vinculados à conta da Natália e vice-versa.
--
-- Schemas lidos: rd_funnels, rd_account_connections, ad_accounts
-- Schemas escritos: rd_funnels (coluna ad_account_id)
--
-- Instrução verbatim do usuário: "vamos corrigir tudo montando um prompt para atacar um por 1"
-- ============================================================================

-- DRY-RUN: Verificar estado atual antes de alterar
SELECT
  rf.id AS funnel_local_id,
  rf.name AS funnel_name,
  rf.rd_funnel_id,
  rf.rd_connection_id,
  rf.ad_account_id,
  rc.external_account_id,
  aa.name AS account_name,
  aa.account_id AS meta_account_id
FROM rd_funnels rf
LEFT JOIN rd_account_connections rc ON rf.rd_connection_id = rc.id
LEFT JOIN ad_accounts aa ON rf.ad_account_id = aa.id
WHERE rf.is_active = true
ORDER BY rf.name;

-- APLICAR CORREÇÃO: definir ad_account_id SOMENTE quando estiver NULL.
-- NÃO sobrescreve atribuições que o especialista definiu deliberadamente.
-- Normaliza o JOIN: remove o prefixo "act_" quando houver, para casar
-- external_account_id (ex.: "975324268974435") com account_id (ex.: "975324268974435").
UPDATE rd_funnels rf
SET ad_account_id = aa.id
FROM rd_account_connections rc
JOIN ad_accounts aa ON aa.account_id = replace(rc.external_account_id, 'act_', '')
WHERE rf.rd_connection_id = rc.id
  AND rf.is_active = true
  AND rf.ad_account_id IS NULL;

-- Verificar funis que ficaram sem vínculo (precisam de correção manual)
SELECT
  rf.id,
  rf.name,
  rf.rd_funnel_id,
  rf.rd_connection_id,
  rf.ad_account_id
FROM rd_funnels rf
WHERE rf.is_active = true
  AND rf.ad_account_id IS NULL;

-- Confirmar contagem de funis corrigidos por conta
SELECT
  aa.name AS account_name,
  COUNT(rf.id) AS funis_vinculados
FROM ad_accounts aa
LEFT JOIN rd_funnels rf ON rf.ad_account_id = aa.id AND rf.is_active = true
GROUP BY aa.id, aa.name
ORDER BY aa.name;
