import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, holdings, trades, transactions, planSubscriptions, plans, notifications, botSubscriptions } from "@/db/schema";
import { desc, eq, and, sql, gt, isNull, asc } from "drizzle-orm";
import { getUser, clearSession } from "@/lib/auth";
import { needsEmailVerification } from "@/lib/email-verification";
import { getFxRate } from "@/lib/fx-server";
import { DEFAULT_PLAN_SUBSCRIPTION_MS } from "@/lib/subscriptions";

// Every user should always have a plan - if they've never subscribed to
// anything (brand new account, legacy account from before this feature, or
// a freshly-minted demo user), silently enroll them in the cheapest active
// plan (expected to be a $0 "Starter"-style free tier) so the UI never has
// to show a "No active plan" dead end. No-ops if no active plan exists yet.
async function ensureDefaultPlan(userId: string) {
  const [cheapest] = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.priceWeekly), asc(plans.sortOrder)).limit(1);
  if (!cheapest || Number(cheapest.priceWeekly) !== 0) return null; // no free tier configured - nothing to default to
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_PLAN_SUBSCRIPTION_MS);
  await db.insert(planSubscriptions).values({ userId, planId: cheapest.id, amount: "0.00", startedAt: now, expiresAt });
  return { planName: cheapest.name, expiresAt, amount: "0.00" };
}

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(request: NextRequest) {
  try {
    let user = await getUser(request);
    // A locked account can't be used even with a still-valid session cookie
    // - kill the session and tell the client, instead of silently handing
    // them a fresh demo workspace.
    if (user && user.accountStatus === "locked") {
      return await clearSession(request, NextResponse.json({ error: "This account has been locked. Contact support for help.", locked: true }, { status: 403 }));
    }
    if (user?.isDemo) return await clearSession(request, bad("Demo access has been removed. Please sign in with a registered account.", 401));
    if (!user) return bad("Please sign in to continue.", 401);
    const [h, t, tx, botPlanTotals, currentPlan, notifRows, unreadCount, fx] = await Promise.all([
      db.select().from(holdings).where(eq(holdings.userId, user.id)),
      db.select().from(trades).where(eq(trades.userId, user.id)).orderBy(desc(trades.createdAt)).limit(50),
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(50),
      db.select({ amount: sql<string>`coalesce(sum(${botSubscriptions.amount}), 0)::text` })
        .from(botSubscriptions)
        .where(and(eq(botSubscriptions.userId, user.id), eq(botSubscriptions.capitalDebited, true))),
      db.select({ planName: plans.name, expiresAt: planSubscriptions.expiresAt, amount: planSubscriptions.amount })
        .from(planSubscriptions)
        .innerJoin(plans, eq(planSubscriptions.planId, plans.id))
        .where(and(eq(planSubscriptions.userId, user.id), gt(planSubscriptions.expiresAt, new Date())))
        .orderBy(desc(planSubscriptions.startedAt))
        .limit(1),
      db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(20),
      db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
      // Display-only FX rate for this user's chosen currency; the ledger
      // below (cashBalance, trades, transactions) always stays in USD.
      getFxRate("USD"),
    ]);
    let plan = currentPlan[0];
    if (!plan) {
      const defaulted = await ensureDefaultPlan(user.id);
      if (defaulted) plan = defaulted;
    }
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        isDemo: user.isDemo,
        role: user.role,
        emailVerified: !needsEmailVerification(user),
        cashBalance: Number(user.cashBalance),
        profitBalance: Number(user.profitBalance),
        targetBalance: Number(user.targetBalance),
        targetProgressPercent: Number(user.targetProgressPercent),
        signalStrength: Number(user.signalStrength),
        signalPrice100: user.signalPrice100 === null ? null : Number(user.signalPrice100),
        accountStatus: user.accountStatus,
        maxTradeAmount: user.maxTradeAmount == null ? null : Number(user.maxTradeAmount),
        withdrawalsBlocked: user.withdrawalsBlocked,
        statusReason: user.statusReason,
        profilePhoto: user.profilePhoto,
        currency: "USD",
        language: user.language ?? "en",
      },
      holdings: h,
      activeTradeValue: Number(botPlanTotals[0]?.amount ?? 0),
      trades: t,
      transactions: tx,
      plan: plan?.planName ?? null,
      planExpiresAt: plan?.expiresAt ?? null,
      planAmount: plan ? Number(plan.amount) : null,
      notifications: notifRows,
      unreadNotifications: unreadCount[0]?.count ?? 0,
      fx: { currency: "USD", rate: fx.rate, status: fx.status, updatedAt: fx.updatedAt },
    });
    return response;
  } catch (error) { console.error("App GET:", error); return bad("Unable to load your workspace. Please try again.", 500); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "trade") return bad("Trading has been removed.", 410);
    if (action === "markNotificationsRead") {
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
      return NextResponse.json({ success: true });
    }
    if (action === "withdrawal") return bad("Withdrawals now require admin review. Go to Withdraw to get started.");
    if (action === "deposit") return bad("Deposits now require submitting a payment receipt for admin review. Go to Deposit to get started.");
    if (action === "createBot" || action === "toggleBot") return bad("Trading bots now require a paid 7-day subscription. Go to Trading Bot to subscribe and configure one.");
    if (action === "copy") return bad("Copy trading now uses paid 7-day subscriptions. Go to Copy Trading to subscribe.");
    if (action === "plan") return bad("Plans now use paid weekly subscriptions. Go to Plans to subscribe.");
    return bad("Unknown action.");
  } catch (error) { console.error("App POST:", error); return bad(error instanceof Error ? error.message : "Something went wrong.", 400); }
}
