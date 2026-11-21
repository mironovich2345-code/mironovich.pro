-- Dedicated synthetic database only. Never apply to the public site's/another project's DB.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;
CREATE TABLE IF NOT EXISTS career_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS career_accounts (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL CHECK(email ~ '^demo-[a-z0-9-]{1,48}@example[.]invalid$'),
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic), created_at timestamptz NOT NULL DEFAULT now(),
 access_started_at timestamptz, access_until timestamptz, grant_order_id uuid,
 analysis_consumed boolean NOT NULL DEFAULT false, analysis_state text NOT NULL DEFAULT 'none' CHECK(analysis_state IN ('none','running','failed','completed')),
 analysis_token uuid, analysis_lease_until timestamptz
);
CREATE TABLE IF NOT EXISTS career_otp (
 id uuid PRIMARY KEY, email text NOT NULL CHECK(email ~ '^demo-[a-z0-9-]{1,48}@example[.]invalid$'),
 code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS career_otp_email_created ON career_otp(email,created_at DESC);
CREATE TABLE IF NOT EXISTS career_sessions(token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS career_sessions_expiry ON career_sessions(expires_at);
CREATE TABLE IF NOT EXISTS career_rate_buckets(bucket text PRIMARY KEY, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS career_orders (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES career_accounts(id), kind text NOT NULL CHECK(kind IN ('initial','extension')),
 amount_kopeks integer NOT NULL CHECK((kind='initial' AND amount_kopeks=199000) OR (kind='extension' AND amount_kopeks=149000)),
 currency text NOT NULL DEFAULT 'RUB' CHECK(currency='RUB'), test boolean NOT NULL DEFAULT true CHECK(test),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','canceled','refunded','refund_required')),
 idempotence_key uuid NOT NULL UNIQUE, payment_id uuid UNIQUE, confirmation_url text,
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, refund_key uuid NOT NULL UNIQUE,
 refund_id uuid UNIQUE, refunded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS career_one_pending_kind ON career_orders(account_id,kind) WHERE status='pending';
CREATE TABLE IF NOT EXISTS career_confirmations (
 order_id uuid NOT NULL REFERENCES career_orders(id), kind text NOT NULL CHECK(kind IN ('adult','offer')),
 accepted boolean NOT NULL CHECK(accepted), version text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,kind)
);
CREATE TABLE IF NOT EXISTS career_grants(order_id uuid PRIMARY KEY REFERENCES career_orders(id),account_id uuid NOT NULL REFERENCES career_accounts(id),starts_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS career_diagnostics(account_id uuid PRIMARY KEY REFERENCES career_accounts(id) ON DELETE CASCADE,answers jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS career_reports(account_id uuid PRIMARY KEY REFERENCES career_accounts(id) ON DELETE CASCADE,id uuid UNIQUE NOT NULL,result jsonb NOT NULL,pdf bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS career_events(id bigserial PRIMARY KEY,account_id uuid REFERENCES career_accounts(id),order_id uuid REFERENCES career_orders(id),code text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS career_progress(account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,day integer NOT NULL CHECK(day BETWEEN 1 AND 30),done boolean NOT NULL,PRIMARY KEY(account_id,day));
CREATE TABLE IF NOT EXISTS career_mail_outbox(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES career_accounts(id),order_id uuid NOT NULL REFERENCES career_orders(id),kind text NOT NULL CHECK(kind IN ('order_created','access_ready','refund_done')),dedupe_key text UNIQUE NOT NULL,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='career_account_grant_fk') THEN ALTER TABLE career_accounts ADD CONSTRAINT career_account_grant_fk FOREIGN KEY(grant_order_id) REFERENCES career_orders(id); END IF; END $$;
INSERT INTO career_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
