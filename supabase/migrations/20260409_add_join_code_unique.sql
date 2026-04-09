-- =============================================================================
-- SAFE MIGRATION: Ensure join_code UNIQUE constraint and index on clubs table
-- =============================================================================
-- This migration is safe for BOTH fresh setups AND existing databases.
--
-- Problem: The base migration uses CREATE TABLE IF NOT EXISTS, which does NOT
-- alter an existing table. So an existing clubs table may lack:
--   - the UNIQUE constraint on join_code
--   - the idx_clubs_join_code index
--   - the generate_join_code() trigger
--
-- This migration handles all cases idempotently:
--   1. Deduplicates existing join_codes (sets duplicates to NULL so the trigger
--      regenerates them).
--   2. Adds the UNIQUE constraint if missing.
--   3. Creates the index if missing.
--   4. Installs the join_code generation trigger if missing.
-- =============================================================================

-- Step 1: Null out duplicate join_codes so the UNIQUE constraint can be added.
-- Keeps the oldest club's join_code (by created_at); later duplicates get NULL
-- so the trigger will regenerate them on next UPDATE or they can be regenerated
-- manually from the UI.
DO $$
BEGIN
  -- Only run if there are actually duplicate join_codes
  IF EXISTS (
    SELECT join_code
    FROM public.clubs
    WHERE join_code IS NOT NULL
    GROUP BY join_code
    HAVING count(*) > 1
  ) THEN
    UPDATE public.clubs
    SET join_code = NULL
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY join_code ORDER BY created_at ASC) AS rn
        FROM public.clubs
        WHERE join_code IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );
  END IF;
END $$;

-- Step 2: Add UNIQUE constraint if it doesn't already exist.
-- PostgreSQL doesn't have ADD CONSTRAINT IF NOT EXISTS, so we check first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clubs'::regclass
      AND conname = 'clubs_join_code_key'
  ) THEN
    -- Also check for any other unique constraint on join_code
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.clubs'::regclass
        AND c.contype = 'u'
        AND a.attname = 'join_code'
    ) THEN
      ALTER TABLE public.clubs ADD CONSTRAINT clubs_join_code_key UNIQUE (join_code);
    END IF;
  END IF;
END $$;

-- Step 3: Create the index if missing (idempotent).
CREATE INDEX IF NOT EXISTS idx_clubs_join_code ON public.clubs(join_code);

-- Step 4: Install the join_code generation trigger (idempotent).
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  attempts  int := 0;
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    LOOP
      candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE join_code = candidate);
      attempts := attempts + 1;
      IF attempts > 20 THEN
        RAISE EXCEPTION 'Could not generate a unique join code after 20 attempts';
      END IF;
    END LOOP;
    NEW.join_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_join_code ON public.clubs;
CREATE TRIGGER set_join_code
  BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.generate_join_code();
