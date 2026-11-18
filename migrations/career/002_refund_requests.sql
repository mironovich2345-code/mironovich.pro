-- Persist request time so delayed sandbox refund confirmation survives the ordinary window.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;
ALTER TABLE career_orders ADD COLUMN IF NOT EXISTS refund_started_at timestamptz;
INSERT INTO career_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
