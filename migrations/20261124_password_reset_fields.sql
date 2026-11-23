ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
