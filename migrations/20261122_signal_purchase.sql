-- Run before deploying this version; existing accounts remain disabled until priced.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signal_price_100 numeric(18, 2);
