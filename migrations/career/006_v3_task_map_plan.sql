-- AI Career 3.0 task maps and 30-step plans. Separate from v2 career_reports/career_progress.
-- Stored payloads reference lesson IDs/versions of the approved library only; no free text from users.
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS career_v3_artifacts (
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  profession_id text NOT NULL CHECK (profession_id ~ '^[a-z][a-z0-9_]{2,40}$'),
  kind text NOT NULL CHECK (kind IN ('task_map', 'plan')),
  model_version text NOT NULL CHECK (model_version ~ '^career-v3-(task-map|plan)/[0-9]+$'),
  diagnostic_saved_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, profession_id, kind),
  FOREIGN KEY (account_id, profession_id) REFERENCES career_v3_diagnostics(account_id, profession_id) ON DELETE CASCADE
);
INSERT INTO career_migrations(version) VALUES(6) ON CONFLICT DO NOTHING;
