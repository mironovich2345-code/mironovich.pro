-- AI Career 3.0, stage 1: passwordless email-code sign-in, staff roles, price modes (AUTO/MANUAL) with history,
-- orders with a fixed amount, Robokassa TEST notifications and paid access grants. ADDITIVE: existing accounts,
-- routes and progress are untouched; existing password hashes stay valid for the closed demo.
-- Applies only to a synthetic test DB or to a contour DB through scripts/career/demo-admin.mjs migrate.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' AND NOT (current_database() = 'mironovich_career_demo_v3' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'closed-demo-v3') AND NOT (current_database() = 'mironovich_career_stage1' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'stage1-preview') AND NOT (current_database() = 'mironovich_career_staging' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial-staging') AND NOT (current_database() = 'mironovich_career' AND coalesce(current_setting('mironovich.career_demo', true), '') = 'commercial') THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;

-- ——— accounts: identified by a confirmed email; password optional; access optional (bought or invited) ———
ALTER TABLE career_demo_users DROP CONSTRAINT IF EXISTS career_demo_users_email_verified_check;
ALTER TABLE career_demo_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE career_demo_users ALTER COLUMN access_until DROP NOT NULL;
ALTER TABLE career_demo_users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE career_demo_users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_demo_users_verified_shape') THEN
    ALTER TABLE career_demo_users ADD CONSTRAINT career_demo_users_verified_shape CHECK (email_verified = (email_verified_at IS NOT NULL));
  END IF;
END $$;

ALTER TABLE career_demo_sessions ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'password';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_demo_sessions_auth_method') THEN
    ALTER TABLE career_demo_sessions ADD CONSTRAINT career_demo_sessions_auth_method CHECK (auth_method IN ('password', 'otp'));
  END IF;
END $$;

-- ——— email-code challenges: only an HMAC of the code is stored; the cookie holds an opaque token (HMAC stored) ———
CREATE TABLE IF NOT EXISTS career_login_challenges (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  email text NOT NULL CHECK (length(email) BETWEEN 6 AND 254 AND email = lower(email)),
  code_digest text NOT NULL CHECK (code_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  send_count integer NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 20),
  resend_available_at timestamptz NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text CHECK (revoked_reason IS NULL OR revoked_reason IN ('superseded', 'locked', 'expired')),
  delivery_failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS career_login_challenges_email ON career_login_challenges(email, last_sent_at DESC);

-- Preview mailbox (stage-1 preview without SMTP only): messages expire after one hour.
CREATE TABLE IF NOT EXISTS career_mail_preview (
  id uuid PRIMARY KEY,
  to_email text NOT NULL,
  subject text NOT NULL CHECK (length(subject) <= 200),
  body text NOT NULL CHECK (length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- ——— staff: the admin role exists only here; granted by the operator or the bootstrap variable, never by the browser ———
CREATE TABLE IF NOT EXISTS career_staff (
  email text PRIMARY KEY CHECK (length(email) BETWEEN 6 AND 254 AND email = lower(email)),
  role text NOT NULL CHECK (role = 'admin'),
  granted_by text NOT NULL CHECK (granted_by IN ('bootstrap', 'operator')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- ——— price: one settings row (AUTO by confirmed sales or MANUAL) and an append-only history ———
CREATE TABLE IF NOT EXISTS commerce_price_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  mode text NOT NULL CHECK (mode IN ('auto', 'manual')),
  manual_price_kopeks integer CHECK (manual_price_kopeks IS NULL OR manual_price_kopeks IN (199300, 399000, 590000)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system',
  CHECK ((mode = 'manual') = (manual_price_kopeks IS NOT NULL))
);
INSERT INTO commerce_price_settings(id, mode) VALUES (1, 'auto') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS commerce_price_changes (
  id bigserial PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL CHECK (length(changed_by) BETWEEN 3 AND 254),
  old_mode text NOT NULL CHECK (old_mode IN ('auto', 'manual')),
  old_price_kopeks integer NOT NULL CHECK (old_price_kopeks IN (199300, 399000, 590000)),
  new_mode text NOT NULL CHECK (new_mode IN ('auto', 'manual')),
  new_price_kopeks integer NOT NULL CHECK (new_price_kopeks IN (199300, 399000, 590000)),
  paid_sales integer NOT NULL CHECK (paid_sales >= 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 300)
);
CREATE OR REPLACE FUNCTION commerce_price_changes_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'commerce_price_changes is append-only'; END $$;
DROP TRIGGER IF EXISTS commerce_price_changes_append_only ON commerce_price_changes;
CREATE TRIGGER commerce_price_changes_append_only BEFORE UPDATE OR DELETE ON commerce_price_changes
  FOR EACH ROW EXECUTE FUNCTION commerce_price_changes_append_only();

-- ——— orders: the amount is fixed at creation and never recalculated ———
CREATE SEQUENCE IF NOT EXISTS career_shop_inv_seq START 1001;
CREATE TABLE IF NOT EXISTS career_shop_orders (
  id uuid PRIMARY KEY,
  inv_id bigint NOT NULL UNIQUE DEFAULT nextval('career_shop_inv_seq') CHECK (inv_id BETWEEN 1 AND 2147483647),
  -- Financial records outlive a deleted account (de-identified), so no cascade.
  account_id uuid REFERENCES career_accounts(id) ON DELETE SET NULL,
  price_kopeks integer NOT NULL CHECK (price_kopeks IN (199300, 399000, 590000)),
  price_mode text NOT NULL CHECK (price_mode IN ('auto', 'manual')),
  sale_position integer CHECK (sale_position IS NULL OR sale_position >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'canceled', 'refunded', 'refund_required')),
  provider text NOT NULL DEFAULT 'robokassa' CHECK (provider = 'robokassa'),
  provider_mode text NOT NULL CHECK (provider_mode IN ('test', 'emulator')),
  offer_version text NOT NULL CHECK (length(offer_version) BETWEEN 1 AND 40),
  adult_confirmed boolean NOT NULL CHECK (adult_confirmed),
  reserved_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_out_sum text CHECK (paid_out_sum IS NULL OR paid_out_sum ~ '^[0-9]{1,9}([.][0-9]{1,6})?$'),
  canceled_at timestamptz,
  refunded_at timestamptz,
  refund_kopeks integer CHECK (refund_kopeks IS NULL OR refund_kopeks > 0),
  refund_reason text CHECK (refund_reason IS NULL OR length(refund_reason) BETWEEN 3 AND 300),
  CHECK ((status IN ('paid', 'refunded', 'refund_required')) = (paid_at IS NOT NULL)),
  CHECK ((status = 'refunded') = (refunded_at IS NOT NULL)),
  CHECK ((price_mode = 'auto') = (sale_position IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS career_shop_one_pending ON career_shop_orders(account_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS career_shop_orders_status ON career_shop_orders(status, reserved_until);

CREATE TABLE IF NOT EXISTS career_shop_notifications (
  id bigserial PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  inv_id bigint,
  order_id uuid REFERENCES career_shop_orders(id),
  outcome text NOT NULL CHECK (outcome IN ('paid', 'duplicate', 'bad_signature', 'amount_mismatch', 'unknown_order', 'refund_required', 'not_payable', 'malformed')),
  out_sum text CHECK (out_sum IS NULL OR length(out_sum) <= 20)
);

CREATE TABLE IF NOT EXISTS career_access_grants (
  order_id uuid PRIMARY KEY REFERENCES career_shop_orders(id),
  account_id uuid NOT NULL REFERENCES career_accounts(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > starts_at),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS career_access_grants_account ON career_access_grants(account_id, expires_at);

INSERT INTO career_migrations(version) VALUES (12) ON CONFLICT DO NOTHING;
