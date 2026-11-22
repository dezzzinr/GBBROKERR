// Shared constants/helpers for the trading bot feature. Admins curate a
// catalog of bot products (strategy, risk, price) from the admin panel;
// users pay for a 7-day subscription to a product, then can configure any
// number of their own instances of it (e.g. one per asset) while that
// subscription stays active.

export { SUBSCRIPTION_DAYS, SUBSCRIPTION_MS } from "@/lib/subscriptions";
export { RISK_LEVELS, type RiskLevel } from "@/lib/copy-trading";
export { SUBSCRIPTION_DURATION_OPTIONS, type SubscriptionDurationDays } from "@/lib/catalog-profile";

export const BOT_STRATEGIES = ["DCA", "Grid", "Momentum", "Scalping", "Rebalancing", "Yield"] as const;
export type BotStrategy = (typeof BOT_STRATEGIES)[number];

export const BOT_PLAN_TIERS = [
  { id: "6c79b454-49db-4ae2-9049-000000000001", name: "Nexus AI", min: 200, max: 1999, strategy: "DCA", riskLevel: "Low", description: "Entry bot plan for $200–$1,999 allocations. Set your amount and purchase a plan from Capital.", features: ["Basic automated trading access", "Standard market analysis", "Basic technical indicators", "Real-time market monitoring", "Standard customer support"] },
  { id: "6c79b454-49db-4ae2-9049-000000000002", name: "Apex Quant", min: 2000, max: 4999, strategy: "Momentum", riskLevel: "Moderate", description: "Momentum strategy profile for $2,000–$4,999 allocations, with repeat purchases supported.", features: ["Enhanced algorithmic trading", "Advanced technical indicators", "Automated trade signals", "Portfolio performance tracking", "Priority customer support"] },
  { id: "6c79b454-49db-4ae2-9049-000000000003", name: "Vector Prime", min: 5000, max: 9999, strategy: "Grid", riskLevel: "Moderate", description: "Grid strategy profile for $5,000–$9,999 allocations. Your amount is recorded in plan history.", features: ["Multi-strategy trading access", "Advanced market analytics", "Customizable trading parameters", "Risk exposure monitoring", "Detailed performance reports"] },
  { id: "6c79b454-49db-4ae2-9049-000000000004", name: "Titan Neural", min: 10000, max: 19999, strategy: "Rebalancing", riskLevel: "Moderate", description: "Rebalancing strategy profile for $10,000–$19,999 allocations, charged directly from Capital.", features: ["Advanced algorithmic execution", "Multi-market monitoring", "Strategy optimization tools", "Automated portfolio analysis", "Dedicated account assistance"] },
  { id: "6c79b454-49db-4ae2-9049-000000000005", name: "Quantum Edge", min: 20000, max: 49999, strategy: "Scalping", riskLevel: "High", description: "Scalping strategy profile for $20,000–$49,999 allocations, with no-expiry plan access.", features: ["Multi-asset trading strategies", "Advanced quantitative analytics", "Configurable risk controls", "Real-time portfolio insights", "Priority technical assistance"] },
  { id: "6c79b454-49db-4ae2-9049-000000000006", name: "Sentinel X", min: 50000, max: 99999, strategy: "Momentum", riskLevel: "High", description: "Momentum strategy profile for $50,000–$99,999 allocations. Buy a plan as often as you need.", features: ["Sophisticated trading algorithms", "Advanced strategy configuration", "Enhanced risk management tools", "Comprehensive portfolio reporting", "Dedicated support channel"] },
  { id: "6c79b454-49db-4ae2-9049-000000000007", name: "Hyperion AI", min: 100000, max: 249999, strategy: "Grid", riskLevel: "High", description: "Grid strategy profile for $100,000–$249,999 allocations, funded from your Capital balance.", features: ["Institutional-style analytics", "Multi-strategy portfolio tools", "Advanced execution controls", "Custom performance reporting", "Dedicated account manager", "Priority service handling"] },
  { id: "6c79b454-49db-4ae2-9049-000000000008", name: "OmniCore Elite", min: 250000, max: 500000, strategy: "Rebalancing", riskLevel: "High", description: "Rebalancing strategy profile for $250,000–$500,000 allocations, with repeat purchases and plan history.", features: ["Full premium platform access", "Advanced quantitative strategy tools", "Customizable multi-asset configurations", "Institutional-grade reporting", "Personalized account management", "Dedicated technical assistance", "Customized platform integrations", "Priority service and onboarding"] },
] as const;

import { RISK_LEVELS, type RiskLevel } from "@/lib/copy-trading";
import { validateProfileFields } from "@/lib/catalog-profile";

// Validates/normalizes admin-submitted bot product fields. When `partial`
// is true (PATCH), only fields present in `body` are validated/returned.
export function validateBotProductFields(body: Record<string, unknown>, partial: boolean): { error: string; updates?: undefined } | { error?: undefined; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) return { error: "Name must be between 2 and 80 characters." };
    updates.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    if (description.length < 1 || description.length > 400) return { error: "Description must be between 1 and 400 characters." };
    updates.description = description;
  }
  if (!partial || body.strategy !== undefined) {
    const strategy = String(body.strategy ?? "");
    if (!BOT_STRATEGIES.includes(strategy as BotStrategy)) return { error: "Choose a valid strategy." };
    updates.strategy = strategy;
  }
  if (!partial || body.riskLevel !== undefined) {
    const riskLevel = String(body.riskLevel ?? "Moderate");
    if (!RISK_LEVELS.includes(riskLevel as RiskLevel)) return { error: "Choose a valid risk level." };
    updates.riskLevel = riskLevel;
  }
  if (!partial || body.minAllocation !== undefined) {
    const minAllocation = Number(body.minAllocation);
    if (!Number.isFinite(minAllocation) || minAllocation < 0 || minAllocation > 1000000) return { error: "Enter a valid minimum allocation." };
    updates.minAllocation = minAllocation.toFixed(2);
  }
  if (!partial || body.subscriptionAmount !== undefined) {
    const subscriptionAmount = Number(body.subscriptionAmount);
    if (!Number.isFinite(subscriptionAmount) || subscriptionAmount < 0 || subscriptionAmount > 1000000) return { error: "Enter a valid subscription price." };
    updates.subscriptionAmount = subscriptionAmount.toFixed(2);
  }
  if (!partial || body.subscriberCount !== undefined) {
    const subscriberCount = Number(body.subscriberCount ?? 0);
    if (!Number.isInteger(subscriberCount) || subscriberCount < 0 || subscriberCount > 1000000000) return { error: "Subscriber count must be a whole number between 0 and 1,000,000,000." };
    updates.subscriberCount = subscriberCount;
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  const profile = validateProfileFields(body, partial);
  if (profile.error !== undefined) return { error: profile.error };
  return { updates: { ...updates, ...profile.updates } };
}
