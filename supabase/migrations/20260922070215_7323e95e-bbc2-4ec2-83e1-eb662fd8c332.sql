-- Production floor tracking: a batch now moves through stages, and only finished ones

-- appear in "Batches, yield & quality".

--

-- cooking → filling → sealing → retort → done

ALTER TABLE public.production_batches

  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'cooking';

-- Existing rows are historical logs, so they belong in the finished list.

UPDATE public.production_batches SET stage = 'done' WHERE stage <> 'done';

DO $$

BEGIN

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_stage_check') THEN

    ALTER TABLE public.production_batches

      ADD CONSTRAINT production_batches_stage_check

      CHECK (stage IN ('cooking', 'filling', 'sealing', 'retort', 'done'));

  END IF;

END $$;

CREATE INDEX IF NOT EXISTS production_batches_stage_idx ON public.production_batches (stage);
