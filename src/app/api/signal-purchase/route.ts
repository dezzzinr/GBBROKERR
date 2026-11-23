import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, signalPurchaseRequests } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";
export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user || user.accountStatus === "locked") return bad("Please sign in.", 401);
  try {
    const rows = await db.select().from(signalPurchaseRequests).where(eq(signalPurchaseRequests.userId, user.id)).orderBy(desc(signalPurchaseRequests.createdAt)).limit(100);
    return NextResponse.json({ requests: rows });
  } catch (error) { console.error("Signal requests GET:", error); return bad("Unable to load requests.", 500); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Please sign in.", 401);
    const body = await request.json().catch(() => ({}));
    const id = String(body.requestId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return bad("Invalid request ID.");
    const percent = Number(body.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) return bad("Enter a whole percentage from 1 to 100.");
    const raw = String(body.price100 ?? "");
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0 || Number(raw) > 100000000) return bad("Price unavailable. Refresh and try again.");
    const price = Number(raw).toFixed(2);
    const cents = Math.floor((Math.round(Number(price) * 100) * percent + 50) / 100);
    if (cents < 1) return bad("The request must cost at least $0.01.");
    const cost = (cents / 100).toFixed(2);
    const created = await db.transaction(async tx => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!wallet) throw new Error("Account not found.");
      const [existing] = await tx.select().from(signalPurchaseRequests).where(eq(signalPurchaseRequests.id, id)).limit(1);
      if (existing) {
        if (existing.userId !== user.id || existing.percent !== percent || existing.price100 !== price) throw new Error("Request ID already used.");
        return false;
      }
      const blocked = blockedActionMessage(wallet, "subscribe");
      if (blocked) throw new Error(blocked);
      if (!wallet.signalPrice100 || Number(wallet.signalPrice100) !== Number(price)) throw new Error("Signal price changed or is unavailable. Refresh before requesting.");
      if (Number(wallet.signalStrength) + percent > 100) throw new Error("This request would exceed 100% signal strength.");
      const [pending] = await tx.select({ id: signalPurchaseRequests.id }).from(signalPurchaseRequests).where(and(eq(signalPurchaseRequests.userId, user.id), eq(signalPurchaseRequests.status, "pending"))).limit(1);
      if (pending) throw new Error("You already have a pending signal request.");
      await tx.insert(signalPurchaseRequests).values({ id, userId: user.id, percent, price100: price, cost });
      return true;
    });
    if (created) try { await notifyUser({ userId: user.id, type: "signal_request_submitted", title: "Signal request submitted", message: `Your request for ${percent}% signal strength at $${cost} is awaiting review. Capital is charged only if approved.` }); } catch (error) { console.error("Signal request notification:", error); }
    return NextResponse.json({ success: true, alreadyProcessed: !created });
  } catch (error) {
    console.error("Signal request:", error);
    const message = error instanceof Error ? error.message : "";
    const safe = ["Account not found.", "Request ID already used.", "Signal price changed or is unavailable. Refresh before requesting.", "This request would exceed 100% signal strength.", "You already have a pending signal request."];
    if (safe.includes(message) || message.startsWith("Verify your email") || message.startsWith("Your account is suspended") || message.startsWith("Create a free account")) return bad(message);
    return bad("Unable to submit request. Retry without changing the form.", 500);
  }
}
