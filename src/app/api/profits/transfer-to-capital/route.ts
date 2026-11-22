import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, transactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { moneyFormatterFor } from "@/lib/fx-server";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "trade");
    if (blocked) return bad(blocked, 403);

    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!wallet) throw new Error("User not found.");
      const amount = Math.round(Number(wallet.profitBalance) * 100) / 100;
      if (!Number.isFinite(amount) || amount < 0.01) throw new Error("There are no profits available to move to Capital.");

      await tx.update(users).set({
        cashBalance: sql`${users.cashBalance} + ${amount}`,
        profitBalance: "0.00",
      }).where(eq(users.id, user.id));
      await tx.insert(transactions).values({
        userId: user.id,
        type: "profit_to_capital",
        amount: amount.toFixed(2),
        description: "Profits moved to Capital",
      });
      return { amount, currency: wallet.currency };
    });

    const formatter = await moneyFormatterFor(result.currency);
    await notifyUser({
      userId: user.id,
      type: "profit_to_capital",
      title: "Profits moved to Capital",
      message: `${formatter.money(result.amount)} was moved from your profits to Capital.`,
    });

    return NextResponse.json({ success: true, amount: result.amount, message: `${formatter.money(result.amount)} moved to Capital.` });
  } catch (error) {
    console.error("Profit to capital:", error);
    return bad(error instanceof Error ? error.message : "Unable to move profits to Capital.", 400);
  }
}
