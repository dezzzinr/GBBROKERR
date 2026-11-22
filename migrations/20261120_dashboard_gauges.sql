ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signal_strength numeric(5, 2) NOT NULL DEFAULT 0.00;
