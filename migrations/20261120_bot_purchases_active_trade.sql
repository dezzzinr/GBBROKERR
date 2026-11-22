ALTER TABLE bot_subscriptions
  ADD COLUMN IF NOT EXISTS capital_debited boolean NOT NULL DEFAULT false;

-- Preserve capital movements already made by the previous bot purchase flow.
UPDATE bot_subscriptions AS bs
SET capital_debited = true
FROM bot_products AS bp
WHERE bp.id = bs.bot_product_id
  AND EXISTS (
    SELECT 1
    FROM transactions AS tx
    WHERE tx.user_id = bs.user_id
      AND tx.type = 'bot_subscription'
      AND tx.amount = bs.amount
      AND tx.description = 'Bot plan: ' || bp.name || ' allocation charged to capital'
      AND tx.created_at BETWEEN bs.started_at - interval '2 minutes' AND bs.started_at + interval '2 minutes'
  );
