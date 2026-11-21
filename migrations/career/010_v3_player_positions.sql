-- AI Career 3.0 lesson player: the learner's current screen per lesson, restored after sign-in.
-- Additive only: plans, steps, quizzes and measurements are untouched; a screen is NOT a route step.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;
CREATE TABLE IF NOT EXISTS career_v3_player_positions (
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  lesson_id text NOT NULL CHECK (lesson_id ~ '^[A-Z]{2,5}-[0-9]{2,3}$'),
  lesson_version text NOT NULL CHECK (lesson_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  script_version text NOT NULL CHECK (script_version ~ '^[0-9]{1,6}$'),
  exercise_id text NOT NULL CHECK (exercise_id ~ '^[A-Z0-9-]{4,40}$'),
  screen integer NOT NULL CHECK (screen BETWEEN 0 AND 199),
  screens integer NOT NULL CHECK (screens BETWEEN 1 AND 200 AND screen < screens),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, lesson_id)
);
INSERT INTO career_migrations(version) VALUES (10) ON CONFLICT DO NOTHING;
