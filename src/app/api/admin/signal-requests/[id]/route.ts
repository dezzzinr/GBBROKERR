import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { signalPurchaseRequests, transactions, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";
export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "approve" && body.action !== "reject") return bad("Choose approve or reject.");
    const action = body.action as "approve" | "reject";
    const result = await db.transaction(async tx => {
      const [item] = await tx.select().from(signalPurchaseRequests).where(eq(signalPurchaseRequests.id, id)).for("update");
      if (!item) throw new Error("Request not found.");
      if (item.status !== "pending") {
        if (item.status === (action === "approve" ? "approved" : "rejected")) return { item, alreadyProcessed: true };
        throw new Error("Request has already been reviewed.");
      }
      if (action === "approve") {
        const [wallet] = await tx.select().from(users).where(eq(users.id, item.userId)).for("update");
        if (!wallet) throw new Error("User not found.");
        const blocked = blockedActionMessage(wallet, "subscribe");
        if (blocked) throw new Error(blocked);
        if (Number(wallet.signalStrength) + item.percent > 100) throw new Error("Approval would exceed 100% signal strength. Reject the request or adjust the user's current strength.");
        if (Number(wallet.cashBalance) < Number(item.cost)) throw new Error("User has insufficient capital. Request remains pending.");
        await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${item.cost}`, signalStrength: sql`${users.signalStrength} + ${item.percent}` }).where(eq(users.id, item.userId));
        await tx.insert(transactions).values({ id: item.id, userId: item.userId, type: "signal_purchase", amount: item.cost, description: `Signal strength purchase: +${item.percent}% at $${item.price100} per 100%, approved by admin ${admin.id}` });
      }
      await tx.update(signalPurchaseRequests).set({ status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date(), reviewedBy: admin.id }).where(eq(signalPurchaseRequests.id, id));
      return { item, alreadyProcessed: false };
    });
    if (!result.alreadyProcessed) try { await notifyUser({ userId: result.item.userId, type: action === "approve" ? "signal_request_approved" : "signal_request_rejected", title: action === "approve" ? "Signal request approved" : "Signal request rejected", message: action === "approve" ? `Your signal strength increased by ${result.item.percent}% and $${result.item.cost} was charged from capital.` : `Your request for ${result.item.percent}% signal strength was rejected. No capital was charged.` }); } catch (error) { console.error("Signal review notification:", error); }
    return NextResponse.json({ success: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    console.error("Admin signal review:", error);
    const message = error instanceof Error ? error.message : "";
    if (["Request not found.", "Request has already been reviewed.", "User not found.", "Approval would exceed 100% signal strength. Reject the request or adjust the user's current strength.", "User has insufficient capital. Request remains pending."].includes(message) || message.startsWith("Verify your email") || message.startsWith("Your account is suspended") || message.startsWith("Create a free account")) return bad(message);
    return bad("Unable to review request.", 500);
  }
}
