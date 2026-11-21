-- AI Career 3.0, stage 1.5: the COMMERCIAL schema for real users. Runs ONLY on the two commercial databases
-- (mironovich_career_staging with setting commercial-staging, mironovich_career with setting commercial), never on a
-- test, demo or stage-1 database: there the synthetic-only constraints stay exactly as they are.
-- What changes here: every "synthetic = true only" CHECK is dropped and new rows default to synthetic = false.
-- career_accounts keeps its internal alias address (demo-…@example.invalid): it is an opaque id, not a contact;
-- the real email lives only in career_demo_users. Idempotent; safe to re-run.
DO $$ BEGIN
  IF NOT ((current_database() = 'mironovich_career_staging' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial-staging')
       OR (current_database() = 'mironovich_career' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial')) THEN
    RAISE EXCEPTION 'CAREER_COMMERCIAL_DATABASE_REQUIRED';
  END IF;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) IN ('CHECK (synthetic)', 'CHECK ((synthetic))')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
  FOR r IN
    SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'synthetic'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN synthetic SET DEFAULT false', r.table_name);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS career_commercial_schema (
  id smallint PRIMARY KEY CHECK (id = 1),
  profile text NOT NULL CHECK (profile IN ('commercial-staging', 'commercial')),
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO career_commercial_schema(id, profile) VALUES (1, current_setting('mironovich.career_demo'))
  ON CONFLICT (id) DO NOTHING;

INSERT INTO career_migrations(version) VALUES (13) ON CONFLICT DO NOTHING;
