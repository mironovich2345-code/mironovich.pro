-- AI Career 3.0 training measurements "было → стало" (#47). One row per plan-version step: linked to the
-- account (from the server session), the plan version, the step, an exercise metric of the role and the
-- practice variant. Only numbers, a unit from a fixed list and predefined comparability flags and
-- limitation codes are stored — no free text. Progress itself stays in migration 007 (not duplicated).
-- Dedicated local synthetic database only.
DO $$ BEGIN
  IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') AND NOT (current_database() = 'mironovich_career_staging' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial-staging') AND NOT (current_database() = 'mironovich_career' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial') THEN
    RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS career_v3_measurements (
  plan_version_id uuid NOT NULL,
  account_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 30),
  step_stable_id text NOT NULL,
  metric_id text NOT NULL CHECK (metric_id ~ '^[a-z][a-z0-9_]{2,40}$'),
  metric_kind text NOT NULL CHECK (metric_kind = 'exercise'),
  variant text NOT NULL CHECK (variant IN ('manual_without_ai', 'synthetic_practice', 'approved_tools_public_data')),
  unit text NOT NULL CHECK (unit IN ('minutes', 'count', 'percent', 'fields')),
  baseline_value numeric(7,1) CHECK (baseline_value >= 0),
  baseline_sample integer CHECK (baseline_sample BETWEEN 1 AND 100),
  baseline_on date,
  after_value numeric(7,1) CHECK (after_value >= 0),
  after_sample integer CHECK (after_sample BETWEEN 1 AND 100),
  after_on date,
  review_minutes numeric(5,1) CHECK (review_minutes BETWEEN 0 AND 600),
  fix_minutes numeric(5,1) CHECK (fix_minutes BETWEEN 0 AND 600),
  errors_found integer CHECK (errors_found BETWEEN 0 AND 1000),
  conditions jsonb NOT NULL CHECK (jsonb_typeof(conditions) = 'object'),
  limitations text[] NOT NULL DEFAULT '{}' CHECK (limitations <@ ARRAY['small_sample','learning_effect','other_changes','single_example_type']::text[]),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((baseline_value IS NULL) = (baseline_sample IS NULL) AND (baseline_value IS NULL) = (baseline_on IS NULL)),
  CHECK ((after_value IS NULL) = (after_sample IS NULL) AND (after_value IS NULL) = (after_on IS NULL)),
  CHECK (unit <> 'percent' OR ((baseline_value IS NULL OR baseline_value <= 100) AND (after_value IS NULL OR after_value <= 100))),
  CHECK (after_on IS NULL OR baseline_on IS NULL OR after_on >= baseline_on),
  PRIMARY KEY (plan_version_id, position),
  FOREIGN KEY (plan_version_id, position) REFERENCES career_v3_step_progress(plan_version_id, position) ON DELETE CASCADE,
  FOREIGN KEY (plan_version_id, account_id) REFERENCES career_v3_plan_versions(id, account_id) ON DELETE CASCADE
);
INSERT INTO career_migrations(version) VALUES(8) ON CONFLICT DO NOTHING;
