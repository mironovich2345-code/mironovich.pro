-- AI Career 3.0 lesson player v2: saved choices (option ids and criterion marks only — no free text), a
-- monotonic save sequence so out-of-order requests after fast screen switching cannot move the learner back,
-- and the time a mini-test was passed on the server outside the route. Additive only.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;
ALTER TABLE career_v3_player_positions ADD COLUMN IF NOT EXISTS choices jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE career_v3_player_positions ADD COLUMN IF NOT EXISTS seq bigint NOT NULL DEFAULT 0;
ALTER TABLE career_v3_player_positions ADD COLUMN IF NOT EXISTS quiz_passed_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_v3_player_choices_shape') THEN
    ALTER TABLE career_v3_player_positions ADD CONSTRAINT career_v3_player_choices_shape
      CHECK (jsonb_typeof(choices) = 'object' AND pg_column_size(choices) < 4096);
  END IF;
END $$;
INSERT INTO career_migrations(version) VALUES (11) ON CONFLICT DO NOTHING;
