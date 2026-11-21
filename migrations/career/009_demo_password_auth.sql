-- Closed cloud demo of AI Career 3.0: email + password accounts with one-time invites.
-- Applies to a synthetic test DB (for integration tests) or to the dedicated demo DB, and only when the demo
-- migration runner (scripts/career/demo-admin.mjs migrate) has validated the demo configuration and set the setting.
-- Passwords are stored only as scrypt hashes; invite, recovery and session tokens only as HMAC digests.
-- career_accounts keeps its synthetic alias address (demo-…@example.invalid); the real login email lives here only.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;

CREATE TABLE IF NOT EXISTS career_demo_invites (
  code_hash text PRIMARY KEY CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 40 AND label ~ '^[A-Za-z0-9 _.-]*$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS career_demo_users (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES career_accounts(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 6 AND 254 AND email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+[.][^@\s]+$'),
  email_verified boolean NOT NULL DEFAULT false CHECK (NOT email_verified),
  password_hash text NOT NULL CHECK (password_hash ~ '^scrypt[$]'),
  recovery_hash text CHECK (recovery_hash IS NULL OR recovery_hash ~ '^[a-f0-9]{64}$'),
  reset_hash text CHECK (reset_hash IS NULL OR reset_hash ~ '^[a-f0-9]{64}$'),
  reset_expires_at timestamptz,
  invite_hash text REFERENCES career_demo_invites(code_hash) ON DELETE SET NULL,
  tester boolean NOT NULL DEFAULT true,
  access_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS career_demo_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES career_demo_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS career_demo_sessions_user ON career_demo_sessions(user_id);

INSERT INTO career_migrations(version) VALUES (9) ON CONFLICT DO NOTHING;
