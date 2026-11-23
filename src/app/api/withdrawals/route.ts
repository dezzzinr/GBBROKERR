import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, withdrawalRequests } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { WITHDRAWAL_METHOD_IDS, formatWithdrawalDestination, type WithdrawalMethod } from "@/lib/withdrawals";
import { notifyUser } from "@/lib/notify";
import { moneyFormatterFor, convertToUsd, USD_ADVICE_USER } from "@/lib/fx-server";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// A user's own withdrawal requests.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const requestId = request.nextUrl.searchParams.get("requestId");
    if (requestId) {
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return bad("Invalid request ID.");
      const [found] = await db.select({ id: withdrawalRequests.id, status: withdrawalRequests.status }).from(withdrawalRequests).where(and(eq(withdrawalRequests.id, requestId), eq(withdrawalRequests.userId, user.id))).limit(1);
      return NextResponse.json({ found: !!found, request: found ?? null });
    }
    const rows = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(100);
    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("Withdrawals GET:", error);
    return bad("Unable to load your withdrawal requests.", 500);
  }
}

// Submit a new withdrawal request. The requested amount is held immediately
// (deducted from the user's available cash balance) so it can't be spent or
// withdrawn twice while pending review. It is refunded if rejected, or
// ledgered as completed if approved - no automatic payout is ever sent.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);

    // Formats every amount in this request's messages in the user's own
    // display currency (chosen on their profile). Ledger math stays USD.
    const fmt = await moneyFormatterFor(user.currency);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Invalid request.");

    const method = String(body.method ?? "");
    if (!WITHDRAWAL_METHOD_IDS.includes(method as (typeof WITHDRAWAL_METHOD_IDS)[number])) return bad("Choose a valid payout method.");
    const methodLabel = method === "other" ? String(body.methodLabel ?? "").trim().slice(0, 60) : null;
    if (method === "other" && methodLabel !== null && methodLabel.length < 2) return bad("Tell us the name of the platform you'd like to be paid through.");

    // Typed in the user's own display currency; converted to the USD ledger
    // here on the server (never trusting a client-computed figure). Bounds and
    // the balance check apply to the converted USD value, since that's what the
    // wallet actually holds.
    const requestId = String(body.requestId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return bad("Refresh the page and try again.");
    const amountText = String(body.amount ?? "");
    if (!/^\d+(\.\d{1,2})?$/.test(amountText)) return bad("Enter a USD amount with up to two decimal places.");
    const entered = Number(amountText);
    if (!Number.isFinite(entered) || entered <= 0) return bad(`Enter a valid amount of at least ${fmt.usd(1)}.`);
    const conversion = await convertToUsd(entered, body.currency, USD_ADVICE_USER);
    if (!conversion.ok) return bad(conversion.error);
    const amount = conversion.usd;
    if (amount < 1) return bad(`Enter a valid amount of at least ${fmt.usd(1)}.`);
    if (amount > 10000000) return bad("Enter a smaller amount.");

    const parsed = formatWithdrawalDestination(method as WithdrawalMethod, body.details);
    if (parsed.destination === undefined) return bad(parsed.error);
    const destination = parsed.destination;
    const note = body.note ? String(body.note).trim().slice(0, 1000) || null : null;

    const outcome = await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!wallet) throw new Error("Account not found.");
      const [existing] = await tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, requestId)).limit(1);
      if (existing) {
        if (existing.userId !== user.id || existing.method !== method || existing.methodLabel !== methodLabel || existing.amount !== amount.toFixed(2) || existing.destination !== destination || existing.note !== note) throw new Error("This request ID was already used for different withdrawal details. Check your request history.");
        return { id: existing.id, created: false };
      }
      const blocked = blockedActionMessage(wallet, "withdraw");
      if (blocked) throw new Error(blocked);
      if (Number(wallet.profitBalance) > 0) throw new Error("Move all profits to Capital before requesting a withdrawal.");
      if (Number(wallet.cashBalance) < amount) throw new Error("Insufficient available balance.");
      await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      const [row] = await tx.insert(withdrawalRequests).values({ id: requestId, userId: user.id, method, methodLabel, amount: amount.toFixed(2), destination, note, status: "pending" }).returning({ id: withdrawalRequests.id });
      return { id: row.id, created: true };
    });
    if (outcome.created) try {
      await notifyUser({ userId: user.id, type: "withdrawal_submitted", title: "Withdrawal request submitted", message: `Your ${fmt.money(amount)} withdrawal request via ${method} was submitted and is awaiting admin review. The amount has been reserved from your available balance.` });
    } catch (error) { console.error("Withdrawal notification:", error); }
    return NextResponse.json({ success: true, id: outcome.id, alreadyProcessed: !outcome.created, message: outcome.created ? "Withdrawal submitted. Funds are reserved pending review." : "This withdrawal request was already submitted." });
  } catch (error) {
    console.error("Withdrawals POST:", error);
    const message = error instanceof Error ? error.message : "";
    if (["Account not found.", "Move all profits to Capital before requesting a withdrawal.", "Insufficient available balance.", "This request ID was already used for different withdrawal details. Check your request history."].includes(message) || message.startsWith("Verify your email") || message.startsWith("Your account is suspended") || message.startsWith("Withdrawals are currently disabled") || message.startsWith("Create a free account")) return bad(message);
    return bad("Withdrawal status is uncertain. Retry without changing your details, or check your request history.", 500);
  }
}
