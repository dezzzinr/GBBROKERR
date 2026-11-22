// One-time seed script for the trading bot catalog and subscription plans.
// Safe to re-run: it only inserts into a table when that table is empty, so
// it won't duplicate rows or clobber admin edits made after the first run.
//
// Usage:  npm run seed
// Requires DATABASE_URL in your environment / .env file.

import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const BOTS = [
  { id: "6c79b454-49db-4ae2-9049-000000000001", name: "Nexus AI", description: "Entry bot plan for $200–$1,999 allocations. Set your amount and purchase a plan from Capital.", strategy: "DCA", riskLevel: "Low", minAllocation: 200, maxAllocation: 1999 },
  { id: "6c79b454-49db-4ae2-9049-000000000002", name: "Apex Quant", description: "Momentum strategy profile for $2,000–$4,999 allocations, with repeat purchases supported.", strategy: "Momentum", riskLevel: "Moderate", minAllocation: 2000, maxAllocation: 4999 },
  { id: "6c79b454-49db-4ae2-9049-000000000003", name: "Vector Prime", description: "Grid strategy profile for $5,000–$9,999 allocations. Your amount is recorded in plan history.", strategy: "Grid", riskLevel: "Moderate", minAllocation: 5000, maxAllocation: 9999 },
  { id: "6c79b454-49db-4ae2-9049-000000000004", name: "Titan Neural", description: "Rebalancing strategy profile for $10,000–$19,999 allocations, charged directly from Capital.", strategy: "Rebalancing", riskLevel: "Moderate", minAllocation: 10000, maxAllocation: 19999 },
  { id: "6c79b454-49db-4ae2-9049-000000000005", name: "Quantum Edge", description: "Scalping strategy profile for $20,000–$49,999 allocations, with no-expiry plan access.", strategy: "Scalping", riskLevel: "High", minAllocation: 20000, maxAllocation: 49999 },
  { id: "6c79b454-49db-4ae2-9049-000000000006", name: "Sentinel X", description: "Momentum strategy profile for $50,000–$99,999 allocations. Buy a plan as often as you need.", strategy: "Momentum", riskLevel: "High", minAllocation: 50000, maxAllocation: 99999 },
  { id: "6c79b454-49db-4ae2-9049-000000000007", name: "Hyperion AI", description: "Grid strategy profile for $100,000–$249,999 allocations, funded from your Capital balance.", strategy: "Grid", riskLevel: "High", minAllocation: 100000, maxAllocation: 249999 },
  { id: "6c79b454-49db-4ae2-9049-000000000008", name: "OmniCore Elite", description: "Rebalancing strategy profile for $250,000–$500,000 allocations, with repeat purchases and plan history.", strategy: "Rebalancing", riskLevel: "High", minAllocation: 250000, maxAllocation: 500000 },
];

const PLANS = [
  { name: "Starter", description: "The essentials to get started trading with confidence.", priceWeekly: 0, features: ["Paper trading dashboard", "Market overview", "Portfolio tracking", "Basic trade history"], isFeatured: false, sortOrder: 0 },
  { name: "Pro", description: "Powerful tools for traders ready to take the next step.", priceWeekly: 15, features: ["Everything in Starter", "Trading bot subscriptions", "Copy trading subscriptions", "Advanced market signals", "Priority insights"], isFeatured: true, sortOrder: 1 },
  { name: "Elite", description: "The complete experience for serious market explorers.", priceWeekly: 35, features: ["Everything in Pro", "Unlimited bot instances", "All trading signals", "Advanced portfolio analytics", "VIP experience"], isFeatured: false, sortOrder: 2 },
  { name: "Institutional", description: "White-glove tools and priority access for power users.", priceWeekly: 75, features: ["Everything in Elite", "Dedicated account concierge", "Early access to new bots & traders", "Custom portfolio reporting", "Priority support response"], isFeatured: false, sortOrder: 3 },
];

async function main() {
  await client.connect();

  const { rows: botCount } = await client.query("SELECT COUNT(*)::int AS n FROM bot_products");
  if (botCount[0].n === 0) {
    for (const b of BOTS) {
      await client.query(
        `INSERT INTO bot_products (id, name, description, strategy, risk_level, min_allocation, max_allocation, subscription_amount, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true)`,
        [b.id, b.name, b.description, b.strategy, b.riskLevel, b.minAllocation.toFixed(2), b.maxAllocation.toFixed(2)]
      );
    }
    console.log(`Seeded ${BOTS.length} trading bots.`);
  } else {
    console.log(`Skipped bot seed - bot_products already has ${botCount[0].n} row(s).`);
  }

  const { rows: planCount } = await client.query("SELECT COUNT(*)::int AS n FROM plans");
  if (planCount[0].n === 0) {
    for (const p of PLANS) {
      await client.query(
        `INSERT INTO plans (name, description, price_weekly, features, is_featured, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [p.name, p.description, p.priceWeekly.toFixed(2), p.features, p.isFeatured, p.sortOrder]
      );
    }
    console.log(`Seeded ${PLANS.length} plans.`);
  } else {
    console.log(`Skipped plan seed - plans already has ${planCount[0].n} row(s).`);
  }

  await client.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
