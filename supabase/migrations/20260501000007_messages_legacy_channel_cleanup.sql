-- =============================================================================
-- P1.2 — Layer 000007 — Schema cleanup only (no RLS, no CREATE/DROP POLICY)
-- Drops legacy messages.channel TEXT index/column after policies no longer use it,
-- then enforces NOT NULL on messages.channel_id.
--
-- Prerequisites: 20260501000006 must have replaced messaging policies first.
-- Messages RLS is already ENABLED from baseline migrations / 20260420.
-- =============================================================================

DROP INDEX IF EXISTS idx_messages_channel;

ALTER TABLE public.messages DROP COLUMN IF EXISTS channel;

ALTER TABLE public.messages
  ALTER COLUMN channel_id SET NOT NULL;
