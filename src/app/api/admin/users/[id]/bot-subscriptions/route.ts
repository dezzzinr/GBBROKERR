import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions, transactions, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { BOT_PLAN_TIERS } from "@/lib/bots";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return bad("Invalid request ID. Refresh and try again.");
    const tier = BOT_PLAN_TIERS.find(t => t.id === body.botProductId);
    if (!tier) return bad("Choose a valid bot plan.");
    const raw = String(body.amount ?? "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return bad("Enter a valid USD amount with at most two decimal places.");
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < tier.min || amount > tier.max) return bad(`Choose an amount from $${tier.min.toLocaleString()} to $${tier.max.toLocaleString()} USD.`);
    const amountString = amount.toFixed(2);
    const [product] = await db.select().from(botProducts).where(and(eq(botProducts.id, tier.id), eq(botProducts.isActive, true))).limit(1);
    if (!product) return bad("This bot plan is not currently available.");

    const created = await db.transaction(async tx => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!wallet) throw new Error("User not found.");
      const [existing] = await tx.select().from(botSubscriptions).where(eq(botSubscriptions.id, requestId)).limit(1);
      if (existing) {
        if (existing.userId !== id || existing.botProductId !== tier.id || existing.amount !== amountString) throw new Error("This request ID was already used for a different subscription.");
        return false;
      }
      const blocked = blockedActionMessage(wallet, "subscribe");
      if (blocked) throw new Error(blocked);
      if (Number(wallet.cashBalance) < amount) throw new Error("The user does not have enough capital for this plan.");
      await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amountString}` }).where(eq(users.id, id));
      await tx.insert(botSubscriptions).values({ id: requestId, userId: id, botProductId: tier.id, amount: amountString, startedAt: new Date(), expiresAt: null, capitalDebited: true });
      await tx.insert(transactions).values({ userId: id, type: "bot_subscription", amount: amountString, description: `Bot plan: ${product.name} allocation charged to capital by admin ${admin.id}` });
      return true;
    });
    if (created) {
      try {
        await notifyUser({ userId: id, type: "bot_subscribed", title: `${product.name} plan started`, message: `An admin started your ${product.name} plan. $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD was charged from your capital. This plan does not expire.` });
      } catch (error) { console.error("Admin bot subscription notification:", error); }
    }
    return NextResponse.json({ success: true, alreadyProcessed: !created });
  } catch (error) {
    console.error("Admin bot subscription:", error);
    const safe = ["User not found.", "The user does not have enough capital for this plan.", "This request ID was already used for a different subscription."];
    const message = error instanceof Error ? error.message : "";
    if (safe.includes(message) || message.startsWith("Verify your email") || message.startsWith("Your account is suspended") || message.startsWith("Create a free account")) return bad(message);
    return bad("Unable to start the plan. You may safely retry without changing the form.", 500);
  }
}
