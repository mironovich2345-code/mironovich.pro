-- Dedicated local synthetic database only. AI request counters contain no
-- prompts, emails, responses, API keys or individual question answers.
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') AND NOT (current_database() = 'mironovich_career_staging' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial-staging') AND NOT (current_database() = 'mironovich_career' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial') THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS career_ai_requests (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL DEFAULT true CHECK(synthetic)
);
CREATE INDEX IF NOT EXISTS career_ai_requests_account_idx
  ON career_ai_requests(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS career_ai_requests_created_idx
  ON career_ai_requests(created_at DESC);
INSERT INTO career_migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
