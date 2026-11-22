import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions, users, transactions } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";
import { convertToUsd, USD_ADVICE_USER } from "@/lib/fx-server";
import { BOT_PLAN_TIERS } from "@/lib/bots";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's bot subscription history (active + expired), most
// recent first.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db
      .select({
        id: botSubscriptions.id,
        botProductId: botSubscriptions.botProductId,
        botName: botProducts.name,
        amount: botSubscriptions.amount,
        startedAt: botSubscriptions.startedAt,
        expiresAt: botSubscriptions.expiresAt,
      })
      .from(botSubscriptions)
      .innerJoin(botProducts, eq(botSubscriptions.botProductId, botProducts.id))
      .where(eq(botSubscriptions.userId, user.id))
      .orderBy(desc(botSubscriptions.startedAt))
      .limit(100);
    return NextResponse.json({ subscriptions: rows });
  } catch (error) {
    console.error("Bot subscriptions GET:", error);
    return bad("Unable to load your bot subscriptions.", 500);
  }
}

// Start a capital-range bot plan. The submitted amount is validated against
// the product's USD range and saved as the plan allocation.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "subscribe");
    if (blocked) return bad(blocked, 403);
    const body = await request.json().catch(() => ({}));
    const botProductId = String(body.botProductId ?? "");
    if (!botProductId) return bad("Choose a bot plan.");
    const tier = BOT_PLAN_TIERS.find((item) => item.id === botProductId);
    if (!tier) return bad("Choose one of the available bot plans.");

    const [product] = await db.select().from(botProducts).where(and(eq(botProducts.id, botProductId), eq(botProducts.isActive, true))).limit(1);
    if (!product) return bad("This bot is no longer available.");

    const now = new Date();
    const enteredAmount = Number(body.amount);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) return bad("Enter an amount within this plan's range.");
    const conversion = await convertToUsd(enteredAmount, body.currency, USD_ADVICE_USER);
    if (!conversion.ok) return bad(conversion.error);
    const amount = conversion.usd;
    const minAllocation = tier.min;
    const maxAllocation = tier.max;
    if (amount < minAllocation || amount > maxAllocation) {
      return bad(`Choose an amount from $${minAllocation.toLocaleString("en-US")} to $${maxAllocation.toLocaleString("en-US")} USD.`);
    }
    await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!wallet || Number(wallet.cashBalance) < amount) throw new Error("You don't have enough capital to start this plan.");
      await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      await tx.insert(botSubscriptions).values({ userId: user.id, botProductId, amount: amount.toFixed(2), startedAt: now, expiresAt: null, capitalDebited: true });
      await tx.insert(transactions).values({ userId: user.id, type: "bot_subscription", amount: amount.toFixed(2), description: `Bot plan: ${product.name} allocation charged to capital` });
    });

    await notifyUser({
      userId: user.id,
      type: "bot_subscribed",
      title: `${product.name} plan started`,
      message: `Your ${product.name} plan started. $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD was charged from your capital. This plan does not expire.`,
    });

    return NextResponse.json({ success: true, message: `${product.name} started. $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD was charged from your capital.` });
  } catch (error) {
    console.error("Bot subscriptions POST:", error);
    return bad(error instanceof Error ? error.message : "Unable to subscribe. Please try again.", 400);
  }
}
