-- AI Career 3.0 price tiers: seat ledger. PREPARED, NOT CONNECTED: real sales are off (salesEnabled=false,
-- legalApproved=false). Until launch this schema may be applied only to synthetic test databases.
-- One row = one seat. Seat N decides the tier (1–10 → 1 993 ₽, 11–20 → 3 990 ₽, 21+ → 5 900 ₽).
--   held       short checkout hold; the price is fixed in the row and shown before payment
--   capturing  ЮKassa reported waiting_for_capture for the matching amount; the seat is kept and the payment captured
--   paid       ЮKassa verified succeeded; permanent — a later refund does NOT return the seat
-- A held/capturing seat whose payment is canceled or whose hold expired (and was never captured) is deleted.
DO $$ BEGIN IF current_database() !~ '^mironovich_career_test(_[a-z0-9]+)*$' THEN RAISE EXCEPTION 'CAREER_TEST_DATABASE_REQUIRED'; END IF; END $$;
CREATE TABLE IF NOT EXISTS commerce_price_seats (
  seat integer PRIMARY KEY CHECK (seat >= 1),
  tier text NOT NULL CHECK (tier IN ('first','second','standard')),
  price_kopeks integer NOT NULL CHECK (price_kopeks IN (199300, 399000, 590000)),
  order_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('held','capturing','paid')),
  hold_expires_at timestamptz NOT NULL,
  payment_id text UNIQUE CHECK (payment_id IS NULL OR payment_id ~ '^[A-Za-z0-9-]{8,64}$'),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tier = 'first' AND seat BETWEEN 1 AND 10 AND price_kopeks = 199300)
      OR (tier = 'second' AND seat BETWEEN 11 AND 20 AND price_kopeks = 399000)
      OR (tier = 'standard' AND seat >= 21 AND price_kopeks = 590000)),
  CHECK ((state = 'paid') = (paid_at IS NOT NULL)),
  CHECK (refunded_at IS NULL OR state = 'paid'),
  CHECK (state = 'held' OR payment_id IS NOT NULL)
);
