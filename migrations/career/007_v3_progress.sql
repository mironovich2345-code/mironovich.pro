-- AI Career 3.0 progress through the 30 steps. Separate from the v2 career_progress table (untouched).
-- Every plan that a learner works on is stored as an immutable version; progress rows belong to one
-- version and keep the lesson version they were made against. A newer plan never inherits progress:
-- the old version is marked superseded and stays as history. Only booleans and option IDs are stored —
-- no free text. Dedicated local synthetic database only.
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS career_v3_plan_versions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  profession_id text NOT NULL CHECK (profession_id ~ '^[a-z][a-z0-9_]{2,40}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  model_version text NOT NULL CHECK (model_version ~ '^career-v3-plan/[0-9]+$'),
  progress_model text NOT NULL CHECK (progress_model ~ '^career-v3-progress/[0-9]+$'),
  diagnostic_version text NOT NULL,
  diagnostic_saved_at timestamptz NOT NULL,
  versions jsonb NOT NULL CHECK (jsonb_typeof(versions) = 'object'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND jsonb_array_length(payload->'steps') = 30),
  status text NOT NULL CHECK (status IN ('active', 'superseded')),
  superseded_reasons jsonb CHECK (superseded_reasons IS NULL OR jsonb_typeof(superseded_reasons) = 'array'),
  cursor_position integer CHECK (cursor_position BETWEEN 1 AND 30),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  CHECK ((status = 'active') = (superseded_at IS NULL)),
  UNIQUE (id, account_id),
  FOREIGN KEY (account_id, profession_id) REFERENCES career_v3_diagnostics(account_id, profession_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS career_v3_plan_versions_one_active
  ON career_v3_plan_versions(account_id, profession_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS career_v3_step_progress (
  plan_version_id uuid NOT NULL,
  account_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 30),
  step_stable_id text NOT NULL CHECK (step_stable_id ~ '^[A-Z]{2,5}-[0-9]{2,3}(-EX)?@[0-9]+\.[0-9]+\.[0-9]+/STEP-[0-9]{2}$'),
  lesson_id text NOT NULL CHECK (lesson_id ~ '^[A-Z]{2,5}-[0-9]{2,3}(-EX)?$'),
  lesson_version text NOT NULL CHECK (lesson_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  exercise_id text NOT NULL CHECK (exercise_id ~ '^[A-Z0-9-]{3,40}$'),
  state text NOT NULL DEFAULT 'not_started' CHECK (state IN ('not_started', 'in_progress', 'self_checked', 'done')),
  started_at timestamptz,
  criteria_count integer NOT NULL CHECK (criteria_count BETWEEN 1 AND 20),
  criteria_met jsonb CHECK (criteria_met IS NULL OR (jsonb_typeof(criteria_met) = 'array' AND jsonb_array_length(criteria_met) = criteria_count)),
  completion_met jsonb CHECK (completion_met IS NULL OR jsonb_typeof(completion_met) = 'array'),
  completed_at timestamptz,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'done') = (completed_at IS NOT NULL)),
  PRIMARY KEY (plan_version_id, position),
  UNIQUE (plan_version_id, step_stable_id),
  FOREIGN KEY (plan_version_id, account_id) REFERENCES career_v3_plan_versions(id, account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS career_v3_quiz_results (
  plan_version_id uuid NOT NULL,
  account_id uuid NOT NULL,
  lesson_id text NOT NULL CHECK (lesson_id ~ '^[A-Z]{2,5}-[0-9]{2,3}(-EX)?$'),
  lesson_version text NOT NULL CHECK (lesson_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  correct integer NOT NULL CHECK (correct >= 0),
  total integer NOT NULL CHECK (total > 0 AND correct <= total),
  passed boolean NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (passed = (correct = total)),
  PRIMARY KEY (plan_version_id, lesson_id),
  FOREIGN KEY (plan_version_id, account_id) REFERENCES career_v3_plan_versions(id, account_id) ON DELETE CASCADE
);
INSERT INTO career_migrations(version) VALUES(7) ON CONFLICT DO NOTHING;
