import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, holdings, trades, transactions, notifications, depositRequests, withdrawalRequests } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { ACCOUNT_STATUSES } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const PUBLIC_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isDemo: users.isDemo,
  cashBalance: users.cashBalance,
  profitBalance: users.profitBalance,
  targetBalance: users.targetBalance,
  targetProgressPercent: users.targetProgressPercent,
  signalStrength: users.signalStrength,
  signalPrice100: users.signalPrice100,
  accountStatus: users.accountStatus,
  maxTradeAmount: users.maxTradeAmount,
  withdrawalsBlocked: users.withdrawalsBlocked,
  profitTransferEnabled: users.profitTransferEnabled,
  statusReason: users.statusReason,
  statusUpdatedAt: users.statusUpdatedAt,
  createdAt: users.createdAt,
  emailVerifiedAt: users.emailVerifiedAt,
  // Read-only profile fields added by the registration overhaul - admins can
  // view these but editing them is left to the user's own profile page.
  username: users.username,
  phone: users.phone,
  country: users.country,
  currency: users.currency,
};

// Full profile for a single user, used by the admin "manage user" screen:
// profile fields, holdings, recent trades/transactions, recent deposit/
// withdrawal requests, and notifications sent to them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const [user] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
    if (!user) return bad("User not found.", 404);

    const [h, t, tx, deposits, withdrawals, notifs] = await Promise.all([
      db.select().from(holdings).where(eq(holdings.userId, id)),
      db.select().from(trades).where(eq(trades.userId, id)).orderBy(desc(trades.createdAt)).limit(30),
      db.select().from(transactions).where(eq(transactions.userId, id)).orderBy(desc(transactions.createdAt)).limit(30),
      db.select().from(depositRequests).where(eq(depositRequests.userId, id)).orderBy(desc(depositRequests.createdAt)).limit(10),
      db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, id)).orderBy(desc(withdrawalRequests.createdAt)).limit(10),
      db.select().from(notifications).where(eq(notifications.userId, id)).orderBy(desc(notifications.createdAt)).limit(20),
    ]);

    return NextResponse.json({
      user,
      holdings: h,
      trades: t,
      transactions: tx,
      depositRequests: deposits,
      withdrawalRequests: withdrawals,
      notifications: notifs,
    });
  } catch (error) {
    console.error("Admin user GET:", error);
    return bad("Unable to load this user.", 500);
  }
}

// Edit profile fields and/or account standing (status, trade limit,
// withdrawal block). Locking a user also terminates their active sessions.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 80) return bad("Name must be between 2 and 80 characters.");
      updates.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email address.");
      const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email} and ${users.id} != ${id}`).limit(1);
      if (existing) return bad("Another account already uses this email.", 409);
      updates.email = email;
    }
    if (body.role !== undefined) {
      const role = String(body.role);
      if (!["user", "admin"].includes(role)) return bad("Choose a valid role.");
      if (id === admin.id && role !== "admin") return bad("You can't remove your own admin access.");
      updates.role = role;
    }
    let statusChanging = false;
    let newStatus: string | null = null;
    if (body.accountStatus !== undefined) {
      const accountStatus = String(body.accountStatus);
      if (!ACCOUNT_STATUSES.includes(accountStatus as typeof ACCOUNT_STATUSES[number])) return bad("Choose a valid account status.");
      if (id === admin.id && accountStatus !== "active") return bad("You can't change your own account status.");
      updates.accountStatus = accountStatus;
      statusChanging = true;
      newStatus = accountStatus;
    }
    if (body.maxTradeAmount !== undefined) {
      if (body.maxTradeAmount === null || body.maxTradeAmount === "") updates.maxTradeAmount = null;
      else {
        const amount = Number(body.maxTradeAmount);
        if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) return bad("Enter a valid trade limit.");
        updates.maxTradeAmount = amount.toFixed(2);
      }
    }
    if (typeof body.withdrawalsBlocked === "boolean") updates.withdrawalsBlocked = body.withdrawalsBlocked;
    if (body.statusReason !== undefined) updates.statusReason = body.statusReason === null ? null : (String(body.statusReason).trim().slice(0, 500) || null);
    if (statusChanging) updates.statusUpdatedAt = new Date();

    if (Object.keys(updates).length === 0) return bad("Nothing to update.");

    const [row] = await db.update(users).set(updates).where(eq(users.id, id)).returning(PUBLIC_COLUMNS);
    if (!row) return bad("User not found.", 404);

    if (statusChanging && newStatus) {
      const statusLabel: Record<string, string> = { active: "reinstated to active standing", limited: "placed under limited restrictions", suspended: "suspended", locked: "locked" };
      const reason = typeof body.statusReason === "string" ? body.statusReason.trim() : "";
      await notifyUser({
        userId: id,
        type: "account_status_changed",
        title: "Your account status changed",
        message: `Your account was ${statusLabel[newStatus] ?? `set to ${newStatus}`}.${reason ? ` Reason: ${reason}` : ""} Contact support if you have questions.`,
      });
    }

    // Note: we deliberately don't delete the user's existing sessions here.
    // Their session stays valid in the database, so the next request they
    // make (e.g. the dashboard's periodic /api/app refresh) finds a locked
    // user and shows a clear "account locked" message while terminating the
    // session right then - rather than the cookie simply going stale and
    // silently handing them a fresh anonymous demo workspace.

    return NextResponse.json({ success: true, user: row });
  } catch (error) {
    console.error("Admin update user:", error);
    return bad("Unable to update this user.", 500);
  }
}

// Manual approval bypasses the OTP; this does not prove email ownership.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "approve") return bad("Invalid action.");
    const [row] = await db.update(users).set({ emailVerifiedAt: new Date(), verificationCodeHash: null, verificationCodeExpiresAt: null, verificationCodeSentAt: null, verificationAttempts: 0 })
      .where(and(eq(users.id, id), eq(users.isDemo, false), isNull(users.emailVerifiedAt), sql`${users.email} is not null`)).returning(PUBLIC_COLUMNS);
    if (!row) return bad("User not found or not awaiting approval.", 409);
    return NextResponse.json({ success: true, user: row });
  } catch (error) {
    console.error("Admin approve user:", error);
    return bad("Unable to approve this user.", 500);
  }
}

// Permanently remove regular users and their dependent records via database cascades.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    if (id === admin.id) return bad("You cannot delete your own account.");
    const [row] = await db.delete(users)
      .where(and(eq(users.id, id), eq(users.role, "user"), eq(users.isDemo, false))).returning({ id: users.id });
    if (!row) return bad("User not found or cannot be deleted.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete user:", error);
    return bad("Unable to delete this user.", 500);
  }
}
