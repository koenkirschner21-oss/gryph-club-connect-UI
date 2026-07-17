-- Allow bookmark as a persisted post reaction (UI already sends reaction = 'bookmark').

ALTER TABLE public.post_reactions
  DROP CONSTRAINT IF EXISTS post_reactions_reaction_check;

ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_reaction_check
  CHECK (reaction IN ('heart', 'thumbs_up', 'laugh', 'bookmark'));
