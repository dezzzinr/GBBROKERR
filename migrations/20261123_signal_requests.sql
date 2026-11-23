CREATE TABLE IF NOT EXISTS signal_purchase_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
  price_100 numeric(18, 2) NOT NULL CHECK (price_100 > 0),
  cost numeric(18, 2) NOT NULL CHECK (cost > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS signal_requests_status_created_idx ON signal_purchase_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS signal_requests_user_idx ON signal_purchase_requests(user_id, created_at DESC);
