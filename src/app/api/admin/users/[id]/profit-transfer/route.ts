import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Choose whether profit transfers are enabled." }, { status: 400 });
    const [row] = await db.update(users).set({ profitTransferEnabled: body.enabled }).where(eq(users.id, id)).returning({ id: users.id });
    if (!row) return NextResponse.json({ error: "User not found." }, { status: 404 });
    try { await notifyUser({ userId: id, type: "profit_transfer_permission_updated", title: "Profit transfer permission updated", message: body.enabled ? "An admin enabled transfers from profits to capital on your account." : "An admin disabled transfers from profits to capital on your account.", sentBy: admin.id }); }
    catch (error) { console.error("Profit transfer permission notification:", error); }
    return NextResponse.json({ success: true, enabled: body.enabled });
  } catch (error) { console.error("Profit transfer permission update:", error); return NextResponse.json({ error: "Unable to update permission." }, { status: 500 }); }
}
