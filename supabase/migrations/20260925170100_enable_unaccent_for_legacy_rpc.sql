-- The legacy event-class RPC is retained for compatibility and calls
-- unaccent() while inspecting imported custom-field labels.  Keep the
-- function executable for old jobs without changing the manual participant
-- workflow used by the current UI.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
