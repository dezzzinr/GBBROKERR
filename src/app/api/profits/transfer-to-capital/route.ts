import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, transactions, notifications } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { moneyFormatterFor } from "@/lib/fx-server";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const deniedMessage = "You cannot withdraw profits to capital because your trade has not been marked as completed by an admin.";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const body = await request.json().catch(() => ({}));
    const checkOnly = body.checkOnly === true;
    const result = await db.transaction(async tx => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!wallet) return { kind: "error" as const, message: "User not found." };
      const blocked = blockedActionMessage(wallet, "trade");
      if (blocked) return { kind: "error" as const, message: blocked };
      if (!wallet.profitTransferEnabled) {
        // Commit the in-app notification even though the transfer is denied.
        await tx.insert(notifications).values({ userId: wallet.id, type: "profit_transfer_denied", title: "Profit transfer unavailable", message: deniedMessage });
        return { kind: "denied" as const };
      }
      if (checkOnly) return { kind: "allowed" as const };
      const amount = Math.round(Number(wallet.profitBalance) * 100) / 100;
      if (!Number.isFinite(amount) || amount < 0.01) return { kind: "error" as const, message: "There are no profits available to move to Capital." };
      await tx.update(users).set({ cashBalance: sql`${users.cashBalance} + ${amount}`, profitBalance: "0.00" }).where(eq(users.id, user.id));
      await tx.insert(transactions).values({ userId: user.id, type: "profit_to_capital", amount: amount.toFixed(2), description: "Profits moved to Capital" });
      return { kind: "success" as const, amount, currency: wallet.currency };
    });
    if (result.kind === "denied") return NextResponse.json({ error: deniedMessage, code: "PROFIT_TRANSFER_DISABLED" }, { status: 403 });
    if (result.kind === "error") return bad(result.message, 403);
    if (result.kind === "allowed") return NextResponse.json({ success: true, allowed: true });
    const formatter = await moneyFormatterFor(result.currency);
    try { await notifyUser({ userId: user.id, type: "profit_to_capital", title: "Profits moved to Capital", message: `${formatter.money(result.amount)} was moved from your profits to Capital.` }); }
    catch (error) { console.error("Profit transfer notification:", error); }
    return NextResponse.json({ success: true, amount: result.amount, message: `${formatter.money(result.amount)} moved to Capital.` });
  } catch (error) { console.error("Profit to capital:", error); return bad("Unable to move profits to Capital. Please try again.", 500); }
}
