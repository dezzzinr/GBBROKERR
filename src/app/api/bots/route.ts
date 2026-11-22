import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions } from "@/db/schema";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { BOT_PLAN_TIERS } from "@/lib/bots";

export const dynamic = "force-dynamic";

// Signed-in catalog of active capital-range bot plans.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const products = await db.select().from(botProducts).where(and(eq(botProducts.isActive, true), inArray(botProducts.id, BOT_PLAN_TIERS.map((tier) => tier.id))));
    products.sort((a, b) => BOT_PLAN_TIERS.findIndex((tier) => tier.id === a.id) - BOT_PLAN_TIERS.findIndex((tier) => tier.id === b.id));
    const now = new Date();
    const activeSubs = await db.select().from(botSubscriptions)
      .where(and(eq(botSubscriptions.userId, user.id), or(isNull(botSubscriptions.expiresAt), gt(botSubscriptions.expiresAt, now))))
      .orderBy(desc(botSubscriptions.startedAt));
    const mySubByProduct = new Map<string, (typeof activeSubs)[number][]>();
    for (const sub of activeSubs) mySubByProduct.set(sub.botProductId, [...(mySubByProduct.get(sub.botProductId) ?? []), sub]);

    const result = products.map((p) => {
      const tier = BOT_PLAN_TIERS.find((item) => item.id === p.id)!;
      const mine = mySubByProduct.get(p.id) ?? [];
      return {
        id: p.id,
        name: tier.name,
        description: tier.description,
        strategy: tier.strategy,
        riskLevel: tier.riskLevel,
        features: tier.features,
        minAllocation: tier.min.toFixed(2),
        maxAllocation: tier.max.toFixed(2),
        subscriptionAmount: p.subscriptionAmount,
        subscriptionDurationDays: p.subscriptionDurationDays,
        rating: p.rating,
        country: p.country,
        photoUrl: p.photoUrl,
        subscriberCount: p.subscriberCount,
        mySubscription: mine.length ? {
          expiresAt: mine[0].expiresAt,
          startedAt: mine[0].startedAt,
          amount: mine.reduce((total, sub) => total + Number(sub.amount), 0).toFixed(2),
          purchaseCount: mine.length,
        } : null,
      };
    });

    return NextResponse.json({ bots: result });
  } catch (error) {
    console.error("Bots GET:", error);
    return NextResponse.json({ error: "Unable to load trading bots." }, { status: 500 });
  }
}
