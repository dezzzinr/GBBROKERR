-- Replace the previous four bot plan ranges with the eight requested tiers.
-- Existing tier IDs are retained so previously purchased plans remain linked.
INSERT INTO bot_products
  (id, name, description, strategy, risk_level, min_allocation, max_allocation,
   subscription_amount, subscription_duration_days, subscriber_count, rating,
   country, is_active)
VALUES
  ('6c79b454-49db-4ae2-9049-000000000001', 'Nexus AI', 'Entry bot plan for $200–$1,999 allocations. Set your amount and purchase a plan from Capital.', 'DCA', 'Low', 200.00, 1999.00, 0.00, 7, 0, 4.8, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000002', 'Apex Quant', 'Momentum strategy profile for $2,000–$4,999 allocations, with repeat purchases supported.', 'Momentum', 'Moderate', 2000.00, 4999.00, 0.00, 7, 0, 4.8, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000003', 'Vector Prime', 'Grid strategy profile for $5,000–$9,999 allocations. Your amount is recorded in plan history.', 'Grid', 'Moderate', 5000.00, 9999.00, 0.00, 7, 0, 4.9, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000004', 'Titan Neural', 'Rebalancing strategy profile for $10,000–$19,999 allocations, charged directly from Capital.', 'Rebalancing', 'Moderate', 10000.00, 19999.00, 0.00, 7, 0, 4.9, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000005', 'Quantum Edge', 'Scalping strategy profile for $20,000–$49,999 allocations, with no-expiry plan access.', 'Scalping', 'High', 20000.00, 49999.00, 0.00, 7, 0, 4.9, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000006', 'Sentinel X', 'Momentum strategy profile for $50,000–$99,999 allocations. Buy a plan as often as you need.', 'Momentum', 'High', 50000.00, 99999.00, 0.00, 7, 0, 4.9, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000007', 'Hyperion AI', 'Grid strategy profile for $100,000–$249,999 allocations, funded from your Capital balance.', 'Grid', 'High', 100000.00, 249999.00, 0.00, 7, 0, 5.0, 'US', true),
  ('6c79b454-49db-4ae2-9049-000000000008', 'OmniCore Elite', 'Rebalancing strategy profile for $250,000–$500,000 allocations, with repeat purchases and plan history.', 'Rebalancing', 'High', 250000.00, 500000.00, 0.00, 7, 0, 5.0, 'US', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  strategy = EXCLUDED.strategy,
  risk_level = EXCLUDED.risk_level,
  min_allocation = EXCLUDED.min_allocation,
  max_allocation = EXCLUDED.max_allocation,
  is_active = true,
  updated_at = now();

-- Keep existing non-expiring plans and configured bots attached to a tier
-- whose new range contains their saved amount.
UPDATE bot_subscriptions
SET bot_product_id = CASE
  WHEN amount <= 1999.00 THEN '6c79b454-49db-4ae2-9049-000000000001'::uuid
  WHEN amount <= 4999.00 THEN '6c79b454-49db-4ae2-9049-000000000002'::uuid
  WHEN amount <= 9999.00 THEN '6c79b454-49db-4ae2-9049-000000000003'::uuid
  WHEN amount <= 19999.00 THEN '6c79b454-49db-4ae2-9049-000000000004'::uuid
  WHEN amount <= 49999.00 THEN '6c79b454-49db-4ae2-9049-000000000005'::uuid
  WHEN amount <= 99999.00 THEN '6c79b454-49db-4ae2-9049-000000000006'::uuid
  WHEN amount <= 249999.00 THEN '6c79b454-49db-4ae2-9049-000000000007'::uuid
  ELSE '6c79b454-49db-4ae2-9049-000000000008'::uuid
END
WHERE bot_product_id IN (
  '6c79b454-49db-4ae2-9049-000000000001'::uuid,
  '6c79b454-49db-4ae2-9049-000000000002'::uuid,
  '6c79b454-49db-4ae2-9049-000000000003'::uuid,
  '6c79b454-49db-4ae2-9049-000000000004'::uuid
);

UPDATE bot_instances
SET bot_product_id = CASE
  WHEN amount <= 1999.00 THEN '6c79b454-49db-4ae2-9049-000000000001'::uuid
  WHEN amount <= 4999.00 THEN '6c79b454-49db-4ae2-9049-000000000002'::uuid
  WHEN amount <= 9999.00 THEN '6c79b454-49db-4ae2-9049-000000000003'::uuid
  WHEN amount <= 19999.00 THEN '6c79b454-49db-4ae2-9049-000000000004'::uuid
  WHEN amount <= 49999.00 THEN '6c79b454-49db-4ae2-9049-000000000005'::uuid
  WHEN amount <= 99999.00 THEN '6c79b454-49db-4ae2-9049-000000000006'::uuid
  WHEN amount <= 249999.00 THEN '6c79b454-49db-4ae2-9049-000000000007'::uuid
  ELSE '6c79b454-49db-4ae2-9049-000000000008'::uuid
END
WHERE bot_product_id IN (
  '6c79b454-49db-4ae2-9049-000000000001'::uuid,
  '6c79b454-49db-4ae2-9049-000000000002'::uuid,
  '6c79b454-49db-4ae2-9049-000000000003'::uuid,
  '6c79b454-49db-4ae2-9049-000000000004'::uuid
);
