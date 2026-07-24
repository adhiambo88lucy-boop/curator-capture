
-- Reservations: new operational fields
ALTER TABLE public.group_buy_reservations
  ADD COLUMN IF NOT EXISTS reservation_number text,
  ADD COLUMN IF NOT EXISTS colour_id uuid REFERENCES public.product_colours(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS size_selection text,
  ADD COLUMN IF NOT EXISTS reservation_type text NOT NULL DEFAULT 'group_buy',
  ADD COLUMN IF NOT EXISTS curator_notes text,
  ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'curator_review';

-- Backfill reservation_number for existing rows
UPDATE public.group_buy_reservations
SET reservation_number = 'R-' || upper(substr(replace(id::text,'-',''),1,8))
WHERE reservation_number IS NULL;

ALTER TABLE public.group_buy_reservations
  ALTER COLUMN reservation_number SET NOT NULL,
  ALTER COLUMN reservation_number SET DEFAULT ('R-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_reservations_reservation_number_key') THEN
    ALTER TABLE public.group_buy_reservations ADD CONSTRAINT group_buy_reservations_reservation_number_key UNIQUE (reservation_number);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gbr_reservation_type_chk') THEN
    ALTER TABLE public.group_buy_reservations
      ADD CONSTRAINT gbr_reservation_type_chk CHECK (reservation_type IN ('group_buy','full_moq'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gbr_workflow_stage_chk') THEN
    ALTER TABLE public.group_buy_reservations
      ADD CONSTRAINT gbr_workflow_stage_chk CHECK (workflow_stage IN ('curator_review','needs_changes','awaiting_supplier','awaiting_payment','confirmed','rejected'));
  END IF;
END $$;

-- Currencies: default flag
ALTER TABLE public.currencies
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Ensure at most one default currency
CREATE UNIQUE INDEX IF NOT EXISTS currencies_only_one_default
  ON public.currencies((1)) WHERE is_default = true;

-- Allow authenticated users to read currencies (buyers need this too for display)
GRANT SELECT ON public.currencies TO authenticated;
