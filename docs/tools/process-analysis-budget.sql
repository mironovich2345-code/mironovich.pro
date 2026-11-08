-- Apply ONLY to a separately approved shared PostgreSQL database, using a migration role.
-- This file neither connects to Railway nor creates/funds a production budget.
CREATE TABLE process_analysis_budgets (
  id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  reservation_micro_usd bigint NOT NULL CHECK (reservation_micro_usd > 0),
  max_requests integer NOT NULL CHECK (max_requests > 0),
  max_micro_usd bigint NOT NULL CHECK (max_micro_usd > 0),
  used_requests integer NOT NULL DEFAULT 0 CHECK (used_requests >= 0),
  reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK (reserved_micro_usd >= 0)
);
CREATE TABLE process_analysis_reservations (
  id uuid PRIMARY KEY,
  budget_id text NOT NULL REFERENCES process_analysis_budgets(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_until timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '60 seconds'),
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd > 0),
  outcome text NOT NULL DEFAULT 'reserved' CHECK (outcome IN ('reserved','completed','refusal','invalid','failed')),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  usage_micro_usd bigint CHECK (usage_micro_usd >= 0)
);
CREATE INDEX ON process_analysis_reservations(budget_id,created_at);
-- Least privilege runtime role: SELECT on both; INSERT on reservations;
-- UPDATE(used_requests,reserved_micro_usd,enabled) on budgets;
-- UPDATE(outcome,input_tokens,output_tokens,usage_micro_usd) on reservations.
-- No DELETE, TRUNCATE, DDL, budget INSERT or updates to maxima/dates/model.
-- One funded, finite, enabled row for all replicas. No auto-renewal or per-instance IDs.
-- Durability requires persistent storage/backups; do not restore an older budget ledger
-- into an active service. Missing/expired rows and failed connections fail closed.
