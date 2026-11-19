-- Synthetic sandbox only. Keep historical 1,990 RUB TEST orders readable
-- while all newly created initial orders use the canonical 1,993 RUB amount.
-- No live payment/order schema is modified by this migration.
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_orders_amount_check'
      AND conrelid = 'career_orders'::regclass
  ) THEN
    ALTER TABLE career_orders DROP CONSTRAINT IF EXISTS career_orders_check;
    ALTER TABLE career_orders ADD CONSTRAINT career_orders_amount_check
      CHECK (
        (kind = 'initial' AND amount_kopeks IN (199000, 199300))
        OR (kind = 'extension' AND amount_kopeks = 149000)
      );
  END IF;
END $$;

INSERT INTO career_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
