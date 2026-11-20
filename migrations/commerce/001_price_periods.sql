-- AI Career 3.0 price periods and per-order price snapshots. PREPARED, NOT CONNECTED to live sales
-- (salesEnabled=false, legalApproved=false). Until launch this schema may be applied only to synthetic test DBs.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;

-- Append-only history of price decisions. kind=base: price from starts_at until a later base replaces it.
-- kind=promo: price only within [starts_at, ends_at); promotions never overlap. Cancelling keeps the row.
CREATE TABLE IF NOT EXISTS commerce_price_periods (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('base','promo')),
  price_kopeks integer NOT NULL CHECK (price_kopeks IN (199300, 399000, 590000)),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  CHECK ((kind = 'base' AND ends_at IS NULL) OR (kind = 'promo' AND ends_at IS NOT NULL AND ends_at > starts_at))
);
CREATE INDEX IF NOT EXISTS commerce_price_periods_active ON commerce_price_periods(kind, starts_at) WHERE canceled_at IS NULL;

-- Price fixed for an order at creation; never recalculated. period_id NULL = launch default price.
CREATE TABLE IF NOT EXISTS commerce_order_prices (
  order_id uuid PRIMARY KEY,
  period_id bigint REFERENCES commerce_price_periods(id),
  price_kopeks integer NOT NULL CHECK (price_kopeks IN (199300, 399000, 590000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','canceled','refunded')),
  payment_id text UNIQUE CHECK (payment_id IS NULL OR payment_id ~ '^[A-Za-z0-9-]{8,64}$'),
  paid_at timestamptz,
  refunded_at timestamptz,
  CHECK ((status IN ('paid','refunded')) = (paid_at IS NOT NULL)),
  CHECK ((status = 'refunded') = (refunded_at IS NOT NULL))
);
