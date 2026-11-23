-- Admin must explicitly enable each user's profit-to-capital transfer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profit_transfer_enabled boolean NOT NULL DEFAULT false;
