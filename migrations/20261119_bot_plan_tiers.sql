ALTER TABLE bot_products
  ADD COLUMN IF NOT EXISTS max_allocation numeric(18, 2) NOT NULL DEFAULT 500000.00;

UPDATE bot_products SET is_active = false;

INSERT INTO bot_products
  (id, name, description, strategy, risk_level, min_allocation, max_allocation,
   subscription_amount, subscription_duration_days, subscriber_count, rating,
   country, is_active)
VALUES
  ('6c79b454-49db-4ae2-9049-000000000001', 'Core Compass', 'A steady, diversified plan built for consistent participation in major digital assets.', 'DCA', 'Low', 200.00, 4999.00, 0.00, 7, 0, 4.8, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000002', 'Momentum Atlas', 'A balanced plan combining trend signals with measured entries across leading assets.', 'Momentum', 'Moderate', 5000.00, 14999.00, 0.00, 7, 0, 4.8, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000003', 'Portfolio Vanguard', 'A multi-asset approach with adaptive allocation and regular portfolio rebalancing.', 'Rebalancing', 'Moderate', 15000.00, 49999.00, 0.00, 7, 0, 4.9, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000004', 'Apex Navigator', 'An advanced multi-strategy plan designed for larger allocations and active risk controls.', 'Grid', 'High', 50000.00, 500000.00, 0.00, 7, 0, 5.0, 'US', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  strategy = EXCLUDED.strategy,
  risk_level = EXCLUDED.risk_level,
  min_allocation = EXCLUDED.min_allocation,
  max_allocation = EXCLUDED.max_allocation,
  subscription_amount = EXCLUDED.subscription_amount,
  subscription_duration_days = EXCLUDED.subscription_duration_days,
  rating = EXCLUDED.rating,
  is_active = true,
  updated_at = now();
