-- AI Career 3.0 diagnostic results. Separate versioned table: the v2 career_diagnostics table and
-- its 18 coded v2 answers are untouched. Dedicated local synthetic database only; answers are
-- option codes from the approved questionnaire (no free text).
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS career_v3_diagnostics (
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  profession_id text NOT NULL CHECK (profession_id ~ '^[a-z][a-z0-9_]{2,40}$'),
  model_version text NOT NULL CHECK (model_version ~ '^career-v3-diagnostic-result/[0-9]+$'),
  diagnostic_version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, profession_id)
);
INSERT INTO career_migrations(version) VALUES(5) ON CONFLICT DO NOTHING;
