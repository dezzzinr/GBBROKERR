ALTER TABLE bot_subscriptions
  ALTER COLUMN expires_at DROP NOT NULL;

-- Existing bot plans become permanent as well as all new plans.
UPDATE bot_subscriptions SET expires_at = NULL;
