-- Reply threading for club chat (direct_messages table).
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_content text;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_sender text;

CREATE INDEX IF NOT EXISTS idx_direct_messages_reply_to_id
  ON public.direct_messages(reply_to_id);
