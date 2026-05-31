ALTER TABLE public.club_positions ADD COLUMN IF NOT EXISTS hiring_listing_id uuid REFERENCES public.hiring_listings(id) ON DELETE SET NULL;
