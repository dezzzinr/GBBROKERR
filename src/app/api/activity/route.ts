import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { needsEmailVerification } from "@/lib/accounts";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user || user.accountStatus === "locked" || needsEmailVerification(user)) return NextResponse.json({ error: "Sign in to an active, verified account." }, { status: 401 });
    const offset = Math.min(1000000, Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get("offset")) || 0)));
    const limit = 20;
    // Completed funding is in the ledger; pending and rejected requests are
    // shown separately. Approved requests are omitted to avoid double counting.
    // Trades are in their own table and are not duplicated into the ledger.
    const rows = await db.execute(sql`
      SELECT * FROM (
        SELECT 'ledger:' || t.id::text AS id, t.type, t.description, t.amount::text AS amount,
          'completed'::text AS status, t.created_at AS "createdAt",
          CASE WHEN t.type = 'profit_to_capital' THEN 'transfer'
            WHEN t.type IN ('position_closed', 'position_liquidated') THEN 'pnl'
            WHEN t.type IN ('deposit', 'admin_credit', 'profit_credit', 'referral_bonus') THEN 'credit'
            ELSE 'debit' END AS direction
        FROM transactions t WHERE t.user_id = ${user.id}
        UNION ALL
        SELECT 'trade:' || tr.id::text, 'trade_' || tr.side, (CASE WHEN tr.side = 'buy' THEN 'Bought ' ELSE 'Sold ' END) || tr.symbol,
          tr.total::text, 'completed', tr.created_at, CASE WHEN tr.side = 'buy' THEN 'debit' ELSE 'credit' END
        FROM trades tr WHERE tr.user_id = ${user.id}
        UNION ALL
        SELECT 'deposit-request:' || d.id::text, 'deposit_request', 'Deposit request', d.amount::text,
          d.status, d.created_at, 'none'
        FROM deposit_requests d WHERE d.user_id = ${user.id} AND d.status IN ('pending', 'rejected')
        UNION ALL
        SELECT 'withdrawal-request:' || w.id::text, 'withdrawal_request',
          CASE WHEN w.status = 'pending' THEN 'Withdrawal request · capital reserved' ELSE 'Withdrawal request · funds returned' END,
          w.amount::text, w.status, w.created_at, CASE WHEN w.status = 'pending' THEN 'debit' ELSE 'none' END
        FROM withdrawal_requests w WHERE w.user_id = ${user.id} AND w.status IN ('pending', 'rejected')
      ) activity ORDER BY "createdAt" DESC, id DESC LIMIT ${limit + 1} OFFSET ${offset}
    `);
    return NextResponse.json({ items: rows.rows.slice(0, limit), hasMore: rows.rows.length > limit });
  } catch (error) {
    console.error("Activity GET:", error);
    return NextResponse.json({ error: "Unable to load financial activity." }, { status: 500 });
  }
}
