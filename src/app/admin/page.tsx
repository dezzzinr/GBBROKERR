"use client";
import DdcmMark from "@/components/ddcm-mark";

import { LocalizedText, useLanguage } from "@/components/i18n-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, CreditCard, History, LayoutDashboard, LockKeyhole, Menu, Moon, Pencil, Plus, RefreshCw, Search, Send, ShieldAlert, ShieldCheck, Sun, Target, Trash2, TrendingUp, UserPlus, UserRound, UsersRound, Wallet, X } from "lucide-react";
import { notificationVisual, timeAgo } from "@/lib/notification-visual";
import { DEPOSIT_METHODS, depositMethodLabel, type DepositMethod } from "@/lib/deposits";
import { withdrawalMethodLabel } from "@/lib/withdrawals";
import { COUNTRIES, DEFAULT_COUNTRY, flagEmoji } from "@/lib/countries";
import { BOT_PLAN_TIERS } from "@/lib/bots";
import { ACCOUNT_STATUSES, accountStatusLabel, type AccountStatus } from "@/lib/accounts";
import { ConfirmProvider, useConfirm } from "@/components/confirm-provider";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { formatMoney, formatMarketPrice, formatInCurrency } from "@/lib/currency";

type AdminUser = { id: string; name: string; email: string | null; currency?: string };
function deferEffect(task: () => void | (() => void)) {
  let cleanup: void | (() => void);
  const timer = window.setTimeout(() => { cleanup = task(); }, 0);
  return () => { window.clearTimeout(timer); cleanup?.(); };
}
type Notification = { id: string; type?: string; title: string; message: string; readAt: string | null; createdAt: string; aboutUserId?: string | null };
type DepositRequestRow = {
  id: string; method: string; amount: string; destinationLabel: string | null; reference: string | null; note: string | null;
  status: string; adminNote: string | null; receiptFilename: string; receiptMimeType: string; createdAt: string; reviewedAt: string | null;
  userId: string; userName: string; userEmail: string | null;
};
type WithdrawalRequestRow = {
  id: string; method: string; methodLabel: string | null; amount: string; destination: string; note: string | null;
  status: string; adminNote: string | null; createdAt: string; reviewedAt: string | null;
  userId: string; userName: string; userEmail: string | null;
};
type DepositAccountRow = { id: string; method: string; label: string; instructions: string; isActive: boolean; createdAt: string; updatedAt: string };

type AdminUserRow = { id: string; name: string; email: string; role: string; isDemo: boolean; cashBalance: string; profitBalance: string; targetBalance: string; targetProgressPercent: string; signalStrength: string; signalPrice100: string | null; emailVerifiedAt: string | null; accountStatus: string; maxTradeAmount: string | null; withdrawalsBlocked: boolean; statusReason: string | null; statusUpdatedAt: string | null; createdAt: string; username?: string | null; phone?: string | null; country?: string | null; currency?: string | null };
type UserDetail = {
  user: AdminUserRow;
  holdings: { id: string; symbol: string; quantity: string; avgPrice: string }[];
  trades: { id: string; symbol: string; side: string; quantity: string; price: string; total: string; createdAt: string; placedBy: string | null; adminNote: string | null }[];
  transactions: { id: string; type: string; amount: string; description: string; createdAt: string }[];
  depositRequests: DepositRequestRow[]; withdrawalRequests: WithdrawalRequestRow[];
  notifications: { id: string; title: string; message: string; createdAt: string; readAt: string | null }[];
};
type Overview = { totalUsers: number; totalCashBalance: string; totalProfitBalance: string; pendingDeposits: number; pendingWithdrawals: number; restrictedAccounts: number };

type Tab = "signal-requests" | "overview" | "notifications" | "users" | "deposits" | "withdrawals" | "accounts" | "broadcast";
const navGroups: { label: string; items: { name: Tab; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { label: "OVERVIEW", items: [{ name: "overview", label: "Overview", icon: LayoutDashboard }, { name: "notifications", label: "Notifications", icon: Bell }] },
  { label: "USERS", items: [{ name: "users", label: "Manage users", icon: UsersRound }, { name: "signal-requests", label: "Signal requests", icon: Activity }, { name: "broadcast", label: "Broadcast message", icon: Send }] },
  { label: "PAYMENTS", items: [{ name: "deposits", label: "Deposit requests", icon: ArrowDownLeft }, { name: "withdrawals", label: "Withdrawal requests", icon: ArrowUpRight }, { name: "accounts", label: "Deposit destinations", icon: CreditCard }] },
];
const tabTitles: Record<Tab, { title: string; description: string }> = {
  "signal-requests": { title: "Signal requests", description: "Review requests before charging capital and increasing signal strength." },
  overview: { title: "Overview", description: "A quick snapshot of your platform's users, payments, and subscriptions." },
  notifications: { title: "Notifications", description: "Every notable event across every user account, in one place." },
  users: { title: "Manage users", description: "View every account, edit profiles, change access, send notifications, place trades, and adjust balances." },
  deposits: { title: "Deposits & withdrawals", description: "Verify receipts submitted by users and credit their balance." },
  withdrawals: { title: "Deposits & withdrawals", description: "Review payout requests submitted by users." },
  accounts: { title: "Deposit destinations", description: "Manage where users are told to send funds for each payment method." },
  broadcast: { title: "Broadcast message", description: "Send an announcement to every user at once." },
};

// Catalog prices (bot minimum allocation, subscription prices, weekly plan
// prices) and the per-account max-trade-size limit are stored in USD and loaded
// back into these forms when editing, so they stay USD-denominated on purpose:
// converting on the way in and out would let an hourly rate refresh silently
// change a product's stored price. The labels say USD, and this hint shows what
// users will actually see in the admin's own display currency.
function StoredUsdHint({ typed, money }: { typed: string; money: (n: number) => string }) {
  const value = Number(typed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return <p className="input-hint">{<LocalizedText text={"Users see ≈"}/>} {money(value)}</p>;
}

// Currencies an admin can enter a funding amount in: the same list users can
// choose as their display currency (derived from the supported countries),
// with USD first because it's the ledger currency and the default.
const FUNDING_CURRENCIES = [
  "USD",
  ...Array.from(new Set(COUNTRIES.map((c) => c.currency).filter((c): c is string => !!c && c !== "USD"))).sort(),
];

// Currency picker for the admin funding forms, with a live preview of the USD
// amount that will actually be stored in the ledger.
//
// The preview is informational only. The authoritative conversion happens in
// the API route (convertToUsd), and both sides refuse to guess: if there's no
// real rate for the chosen currency the preview warns here and the server
// rejects the request, because converting at 1:1 would credit e.g. $1,331
// instead of $1 for an NGN amount.
export default function AdminPage() {
  return <ThemeProvider><ConfirmProvider><AdminPageInner /></ConfirmProvider></ThemeProvider>;
}

function AdminPageInner() {
  const { t: translateUI } = useLanguage();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const { theme, toggleTheme } = useTheme();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [fx, setFx] = useState<{ currency: string; rate: number; status: string; rates?: Record<string, number> } | null>(null);
  // Every money amount in the admin panel (totals, user balances, trade
  // history, deposit/withdrawal requests, catalog prices, etc.) is rendered
  // through this helper, so it always matches the signed-in admin's own
  // display-currency preference - set from their profile, same as the main
  // dashboard. The underlying ledger stays in USD; only the display changes.
  const currency = fx?.currency ?? admin?.currency ?? "USD";
  const fxRate = fx?.rate ?? 1;
  const money = (n: number, digits = 2) => formatMoney(n, currency, fxRate, digits);
  const marketPrice = (n: number) => formatMarketPrice(n, currency, fxRate);

  // Preview, for confirm dialogs, of what an amount entered in `enteredIn`
  // becomes in the USD ledger. Mirrors the server's convertToUsd, but is
  // informational only - the API route always redoes the conversion itself and
  // is the one that refuses to proceed without a real rate.
  const fundingPreview = (amount: number, enteredIn: string) => {
    if (enteredIn === "USD") return formatMoney(amount, "USD", 1);
    const rate = fx?.rates?.[enteredIn];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return `${formatInCurrency(amount, enteredIn)} - no exchange rate available, so this will be rejected. Enter the amount in USD instead.`;
    }
    return `${formatInCurrency(amount, enteredIn)} → stored as ${formatMoney(amount / rate, "USD", 1)} (1 USD = ${formatInCurrency(rate, enteredIn, 4)})`;
  };
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const notify = (text: string, error = false) => { setToast({ text: translateUI(text), error }); setTimeout(() => setToast(null), 4500); };
  const go = (t: Tab) => { setTab(t); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // --- Notifications: every notable event across every user account (see
  // notifyAdmins in src/lib/notify.ts), surfaced the same way the main app
  // surfaces a user's own activity - a bell + popover everywhere, plus a
  // dedicated paginated page here.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifOffset, setNotifOffset] = useState(0);
  const [notifTypeFilter, setNotifTypeFilter] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);
  const NOTIF_PAGE_SIZE = 20;
  const loadNotifSummary = async () => {
    try {
      const res = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (!res.ok) return;
      const result = await res.json();
      setRecentNotifications(result.notifications ?? []);
      setUnreadNotifications(result.unread ?? 0);
    } catch { /* ignore - the bell just won't update this cycle */ }
  };
  useEffect(() => {
    if (authState !== "ok") return;
    return deferEffect(() => {
    void loadNotifSummary();
    const id = window.setInterval(() => void loadNotifSummary(), 30000);
    return () => window.clearInterval(id);
    });
  }, [authState]);
  const toggleNotifications = () => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (opening && unreadNotifications > 0) { fetch("/api/notifications", { method: "POST" }).then(() => loadNotifSummary()).catch(() => {}); }
  };
  const loadAllNotifications = async (offset: number, type: string) => {
    setNotifLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(NOTIF_PAGE_SIZE), offset: String(offset) });
      if (type) params.set("type", type);
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const result = await res.json();
      setAllNotifications(result.notifications ?? []);
      setNotifTotal(result.total ?? 0);
      setNotifOffset(offset);
    } catch { /* ignore */ } finally { setNotifLoading(false); }
  };
  useEffect(() => {
    if (authState !== "ok" || tab !== "notifications") return;
    return deferEffect(() => {
      void loadAllNotifications(0, notifTypeFilter);
      if (unreadNotifications > 0) fetch("/api/notifications", { method: "POST" }).then(() => loadNotifSummary()).catch(() => {});
    });
  }, [authState, tab]);
  const markOneNotificationRead = async (id: string) => {
    try { await fetch(`/api/notifications/${id}`, { method: "PATCH" }); } catch { /* ignore */ }
    setAllNotifications((rows) => rows.map((n) => n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
    void loadNotifSummary();
  };
  const markAllNotificationsRead = async () => {
    if (!(await confirm({ title: "Mark all notifications as read?" }))) return;
    await fetch("/api/notifications", { method: "POST" });
    void loadNotifSummary();
    void loadAllNotifications(0, notifTypeFilter);
  };
  // Jump from a notification straight to the account it's about.
  const viewAccountFromNotification = (userId: string) => { setNotificationsOpen(false); setTab("users"); openUser(userId); };

  const [signalRequests, setSignalRequests] = useState<{ id: string; userId: string; userName: string; userEmail: string | null; percent: number; price100: string; cost: string; status: string; createdAt: string; currentSignal: string; capital: string }[]>([]);
  const [signalRequestsLoading, setSignalRequestsLoading] = useState(false);
  const [signalReviewBusy, setSignalReviewBusy] = useState<string | null>(null);
  const loadSignalRequests = async () => {
    setSignalRequestsLoading(true);
    try {
      const res = await fetch("/api/admin/signal-requests", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load signal requests.");
      setSignalRequests(result.requests ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load signal requests.", true); }
    finally { setSignalRequestsLoading(false); }
  };
  useEffect(() => authState === "ok" && tab === "signal-requests" ? deferEffect(() => { void loadSignalRequests(); }) : undefined, [authState, tab]);
  const reviewSignalRequest = async (item: typeof signalRequests[number], action: "approve" | "reject") => {
    if (signalReviewBusy) return;
    if (!(await confirm({ title: action === "approve" ? "Approve signal request?" : "Reject signal request?", message: action === "approve" ? `Charge $${Number(item.cost).toFixed(2)} from ${item.userName}'s capital and add ${item.percent}% to their current signal strength? The balance and 100% limit will be checked again.` : `Reject ${item.userName}'s request? No capital will be charged.`, confirmLabel: action === "approve" ? "Approve and charge" : "Reject request", danger: true }))) return;
    setSignalReviewBusy(item.id);
    try {
      const res = await fetch(`/api/admin/signal-requests/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to review request.");
      notify(result.alreadyProcessed ? "Request was already reviewed." : action === "approve" ? "Request approved and capital charged." : "Request rejected.");
      await loadSignalRequests();
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to review request.", true); await loadSignalRequests(); }
    finally { setSignalReviewBusy(null); }
  };

  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [requests, setRequests] = useState<DepositRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [wStatusFilter, setWStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [wRequests, setWRequests] = useState<WithdrawalRequestRow[]>([]);
  const [wRequestsLoading, setWRequestsLoading] = useState(false);
  const [wBusyId, setWBusyId] = useState<string | null>(null);
  const [wRejectingId, setWRejectingId] = useState<string | null>(null);
  const [wRejectNote, setWRejectNote] = useState("");

  const [accounts, setAccounts] = useState<DepositAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [newMethod, setNewMethod] = useState<DepositMethod>("crypto");
  const [newLabel, setNewLabel] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editInstructions, setEditInstructions] = useState("");

  // --- Broadcast ---
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "" });
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<number | null>(null);

  // --- Overview ---
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load overview");
      setOverview(result);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load overview", true); } finally { setOverviewLoading(false); }
  };
  useEffect(() => authState === "ok" && tab === "overview" ? deferEffect(() => { void loadOverview(); }) : undefined, [authState, tab]);

  // --- Users ---
  const [userRows, setUserRows] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userTotals, setUserTotals] = useState({ total: 0, totalCashBalance: "0", totalProfitBalance: "0" });
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: "", email: "", password: "", cashBalance: "0", profitBalance: "0", currency: "USD" });
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  const [userActionBusy, setUserActionBusy] = useState(false);
  const [botPlanId, setBotPlanId] = useState("");
  const [botAmount, setBotAmount] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const [activeBotIds, setActiveBotIds] = useState<string[]>([]);
  const [botCatalogError, setBotCatalogError] = useState("");
  const [botRequestId, setBotRequestId] = useState<string | null>(null);

  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", role: "user" });
  const [editUserBusy, setEditUserBusy] = useState(false);
  const [statusForm, setStatusForm] = useState({ accountStatus: "active" as AccountStatus, maxTradeAmount: "", withdrawalsBlocked: false, statusReason: "" });
  const [statusBusy, setStatusBusy] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ newBalance: "", note: "", currency: "USD" });
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [profitForm, setProfitForm] = useState({ newProfit: "", note: "", currency: "USD" });
  const [profitBusy, setProfitBusy] = useState(false);
  const [targetForm, setTargetForm] = useState({ newTarget: "", newProgress: "", signalStrength: "0", currency: "USD" });
  const [targetBusy, setTargetBusy] = useState(false);
  const [signalPrice, setSignalPrice] = useState("");
  const [signalPriceBusy, setSignalPriceBusy] = useState(false);
  const [notifForm, setNotifForm] = useState({ title: "", message: "" });
  const [notifBusy, setNotifBusy] = useState(false);

  const loadUsers = async (q = userSearch) => {
    setUsersLoading(true);
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/admin/users${query}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load users");
      setUserRows(result.users ?? []);
      setUserTotals({ total: result.total ?? 0, totalCashBalance: result.totalCashBalance ?? "0", totalProfitBalance: result.totalProfitBalance ?? "0" });
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load users", true); } finally { setUsersLoading(false); }
  };
  useEffect(() => authState === "ok" && tab === "users" && !selectedUserId ? deferEffect(() => { void loadUsers(userSearch); }) : undefined, [authState, tab, selectedUserId]);
  useEffect(() => {
    if (authState !== "ok" || tab !== "users" || selectedUserId) return;
    const t = window.setTimeout(() => void loadUsers(userSearch), 350);
    return () => window.clearTimeout(t);
  }, [userSearch]);

  const loadUserDetail = async (id: string) => {
    setUserDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load this user");
      setUserDetail(result);
      setEditUserForm({ name: result.user.name, email: result.user.email, role: result.user.role });
      setStatusForm({ accountStatus: result.user.accountStatus, maxTradeAmount: result.user.maxTradeAmount ?? "", withdrawalsBlocked: result.user.withdrawalsBlocked, statusReason: result.user.statusReason ?? "" });
      // Default each funding form to the target user's own display currency:
      // an admin funding a Nigerian user is most likely thinking in NGN. USD
      // stays selectable, and the picker previews the USD amount either way.
      const fundCurrency = "USD";
      setBalanceForm({ newBalance: result.user.cashBalance, note: "", currency: fundCurrency });
      setProfitForm({ newProfit: result.user.profitBalance, note: "", currency: fundCurrency });
      setSignalPrice(result.user.signalPrice100 ?? "");
      setTargetForm({ newTarget: result.user.targetBalance, newProgress: result.user.targetProgressPercent ?? "0", signalStrength: result.user.signalStrength ?? "0", currency: "USD" });
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load this user", true); setSelectedUserId(null); } finally { setUserDetailLoading(false); }
  };
  const openUser = (id: string) => {
    setSelectedUserId(id); setBotPlanId(""); setBotAmount(""); setBotRequestId(null); setActiveBotIds([]); setBotCatalogError("");
    void loadUserDetail(id);
    void fetch("/api/bots", { cache: "no-store" }).then(async res => {
      if (!res.ok) throw new Error("Unable to load active bot plans.");
      const result = await res.json();
      setActiveBotIds((result.bots ?? []).map((bot: { id: string }) => bot.id));
    }).catch(() => setBotCatalogError("Unable to load active bot plans. Reopen this user to retry."));
  };
  const closeUser = () => { setSelectedUserId(null); setUserDetail(null); void loadUsers(userSearch); };
  const runUserAction = async (action: "approve" | "delete") => {
    if (!selectedUserId || !userDetail || userActionBusy) return;
    const approved = await confirm(action === "approve" ? {
      title: "Approve this account without an OTP?",
      message: "This grants access without proving that the user owns their email address. Only continue after checking their identity independently.",
      confirmLabel: "Approve account",
    } : {
      title: "Permanently delete this user?",
      message: `This permanently deletes ${userDetail.user.name} and their associated records, including sessions, trades, transactions, deposits and withdrawals. This cannot be undone.`,
      confirmLabel: "Delete permanently", danger: true,
    });
    if (!approved) return;
    if (action === "delete" && !(await confirm({ title: "Confirm permanent deletion", message: `Are you certain you want to permanently delete ${userDetail.user.name} and their records? This cannot be undone.`, confirmLabel: "Yes, delete permanently", danger: true }))) return;
    setUserActionBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}`, action === "approve" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) } : { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to update user.");
      notify(action === "approve" ? "Account approved." : "User permanently deleted.");
      if (action === "delete") closeUser();
      else await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to update user.", true); }
    finally { setUserActionBusy(false); }
  };

  const startBotForUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !userDetail || botBusy) return;
    const tier = BOT_PLAN_TIERS.find(item => item.id === botPlanId);
    const amount = Number(botAmount);
    if (!tier || !activeBotIds.includes(tier.id)) return notify("Choose an available bot plan.", true);
    if (!/^\d+(\.\d{1,2})?$/.test(botAmount) || amount < tier.min || amount > tier.max) return notify(`Enter a USD amount from $${tier.min.toLocaleString()} to $${tier.max.toLocaleString()}, with at most two decimal places.`, true);
    if (!(await confirm({ title: "Start bot plan for this user?", message: `This will debit $${amount.toFixed(2)} USD from ${userDetail.user.name}'s capital to start ${tier.name}. The plan does not expire.`, confirmLabel: "Start and debit capital", danger: true }))) return;
    setBotBusy(true);
    const requestId = botRequestId ?? crypto.randomUUID();
    setBotRequestId(requestId);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/bot-subscriptions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, botProductId: tier.id, amount: botAmount }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to start the plan.");
      notify(result.alreadyProcessed ? "This subscription was already processed." : "Bot plan started and capital debited.");
      setBotRequestId(null);
      setBotAmount("");
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to start the plan. Retry without changing the form.", true); }
    finally { setBotBusy(false); }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createUserBusy) return;
    if (createUserForm.name.trim().length < 2) return notify("Enter the user's name.", true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserForm.email.trim())) return notify("Enter a valid email address.", true);
    if (createUserForm.password.length < 8) return notify("Password must be at least 8 characters.", true);
    // Spell out any starting-funds conversion in the confirmation: the amounts
    // are stored in USD, so if they were entered in another currency the admin
    // should see both figures before the account is created.
    const startCash = Number(createUserForm.cashBalance || 0);
    const startProfit = Number(createUserForm.profitBalance || 0);
    const fundingLine = createUserForm.currency !== "USD" && (startCash > 0 || startProfit > 0)
      ? ` Starting funds are entered in ${createUserForm.currency} and will be stored as USD: balance ${fundingPreview(startCash, createUserForm.currency)}, profits ${fundingPreview(startProfit, createUserForm.currency)}.`
      : "";
    if (!(await confirm({ title: "Create this user?", message: `Creates an account for ${createUserForm.name.trim()} (${createUserForm.email.trim()}).${fundingLine}` }))) return;
    setCreateUserBusy(true);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createUserForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(`${result.user?.name ?? "User"} created`);
      setCreateUserForm({ name: "", email: "", password: "", cashBalance: "0", profitBalance: "0", currency: "USD" });
      setShowCreateUser(false);
      await loadUsers(userSearch);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCreateUserBusy(false); }
  };

  const saveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || editUserBusy) return;
    if (!(await confirm({ title: "Save this user's profile changes?" }))) return;
    setEditUserBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editUserForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Profile updated");
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setEditUserBusy(false); }
  };

  const saveUserStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || statusBusy) return;
    if (!(await confirm({ title: `Set account standing to "${accountStatusLabel(statusForm.accountStatus as AccountStatus)}"?`, message: statusForm.accountStatus === "locked" ? "The user will be signed out immediately and unable to log back in until you change this." : undefined, danger: statusForm.accountStatus === "locked" || statusForm.accountStatus === "suspended" }))) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountStatus: statusForm.accountStatus, maxTradeAmount: statusForm.maxTradeAmount === "" ? null : statusForm.maxTradeAmount, withdrawalsBlocked: statusForm.withdrawalsBlocked, statusReason: statusForm.statusReason || null }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Account standing updated");
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setStatusBusy(false); }
  };

  const saveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || balanceBusy) return;
    const newBalance = Number(balanceForm.newBalance);
    if (!Number.isFinite(newBalance) || newBalance < 0) return notify("Enter a valid capital amount.", true);
    if (!(await confirm({ title: "Set this user's capital?", message: `This directly sets their capital to ${fundingPreview(newBalance, balanceForm.currency)} and logs the difference as an admin credit/debit.`, confirmLabel: "Set capital", danger: true }))) return;
    setBalanceBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/balance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newBalance, currency: balanceForm.currency, note: balanceForm.note }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Capital updated");
      setBalanceForm({ newBalance: String(newBalance.toFixed(2)), note: "", currency: balanceForm.currency });
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBalanceBusy(false); }
  };

  const saveProfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || profitBusy) return;
    const newProfit = Number(profitForm.newProfit);
    if (!Number.isFinite(newProfit) || newProfit < 0) return notify("Enter a valid profit amount.", true);
    if (!(await confirm({ title: "Set this user's profits?", message: `This directly sets their profit balance to ${fundingPreview(newProfit, profitForm.currency)} and logs the difference as a profit credit/debit. It's folded into their total balance.`, confirmLabel: "Set profits", danger: true }))) return;
    setProfitBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/profit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newProfit, currency: profitForm.currency, note: profitForm.note }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Profit balance updated");
      setProfitForm({ newProfit: String(newProfit.toFixed(2)), note: "", currency: profitForm.currency });
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setProfitBusy(false); }
  };

  const saveGauge = async (gauge: "target" | "progress" | "signal") => {
    if (!selectedUserId || targetBusy || !userDetail) return;
    const raw = gauge === "target" ? targetForm.newTarget : gauge === "progress" ? targetForm.newProgress : targetForm.signalStrength;
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < 0 || value > (gauge === "target" ? 100000000 : 100)) return notify("Enter a valid gauge value.", true);
    const expected = gauge === "target" ? userDetail.user.targetBalance : gauge === "progress" ? userDetail.user.targetProgressPercent : userDetail.user.signalStrength;
    const label = gauge === "target" ? "Target amount" : gauge === "progress" ? "Trade progress" : "Signal strength";
    const display = gauge === "target" ? fundingPreview(value, "USD") : `${value.toFixed(2)}%`;
    if (!(await confirm({ title: `Update ${label.toLowerCase()}?`, message: `Set ${label.toLowerCase()} to ${display}? Other gauges will not change.`, confirmLabel: "Update" }))) return;
    setTargetBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/target-balance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gauge, value, expected, currency: "USD" }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to update gauge.");
      notify(result.message || `${label} updated`);
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setTargetBusy(false); }
  };

  const saveSignalPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || signalPriceBusy) return;
    const raw = signalPrice.trim();
    if (raw && (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) < 0.01 || Number(raw) > 100000000)) return notify("Enter a valid USD price, or leave blank to disable purchases.", true);
    if (!(await confirm({ title: "Update signal purchase price?", message: raw ? `Set the price for 100% signal strength to $${Number(raw).toFixed(2)} for this user?` : "Disable signal purchases for this user?", confirmLabel: "Save price" }))) return;
    setSignalPriceBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/signal-price`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: raw || null }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to save price.");
      notify(raw ? "Signal price saved." : "Signal purchases disabled.");
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to save price.", true); }
    finally { setSignalPriceBusy(false); }
  };

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || notifBusy) return;
    if (notifForm.title.trim().length < 2) return notify("Enter a title.", true);
    if (notifForm.message.trim().length < 2) return notify("Enter a message.", true);
    if (!(await confirm({ title: "Send this notification?", message: "The user will see it in their notification bell and, if they have email notifications on, get an email." }))) return;
    setNotifBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Notification sent");
      setNotifForm({ title: "", message: "" });
      await loadUserDetail(selectedUserId);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setNotifBusy(false); }
  };

  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" }).then(async r => {
      if (!r.ok) { setAuthState("denied"); return; }
      const result = await r.json();
      setAdmin(result.user);
      setFx(result.fx ?? null);
      setAuthState("ok");
    }).catch(() => setAuthState("denied"));
  }, []);

  const loadRequests = async (status = statusFilter) => {
    setRequestsLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/deposits${query}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load deposit requests");
      setRequests(result.requests ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load deposit requests", true); } finally { setRequestsLoading(false); }
  };
  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/admin/deposit-accounts", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load deposit accounts");
      setAccounts(result.accounts ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load deposit accounts", true); } finally { setAccountsLoading(false); }
  };
  useEffect(() => authState === "ok" && tab === "deposits" ? deferEffect(() => { void loadRequests(statusFilter); }) : undefined, [authState, tab, statusFilter]);
  useEffect(() => authState === "ok" && tab === "accounts" ? deferEffect(() => { void loadAccounts(); }) : undefined, [authState, tab]);

  const review = async (id: string, action: "approve" | "reject", adminNote?: string) => {
    if (action === "approve" && !(await confirm({ title: "Approve and credit this deposit?", message: "This immediately adds the claimed amount to the user's balance." }))) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Done");
      setRejectingId(null);
      setRejectNote("");
      await loadRequests(statusFilter);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBusyId(null); }
  };

  const loadWithdrawalRequests = async (status = wStatusFilter) => {
    setWRequestsLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/withdrawals${query}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load withdrawal requests");
      setWRequests(result.requests ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load withdrawal requests", true); } finally { setWRequestsLoading(false); }
  };
  useEffect(() => authState === "ok" && tab === "withdrawals" ? deferEffect(() => { void loadWithdrawalRequests(wStatusFilter); }) : undefined, [authState, tab, wStatusFilter]);

  const reviewWithdrawal = async (id: string, action: "approve" | "reject", adminNote?: string) => {
    if (action === "approve" && !(await confirm({ title: "Approve this withdrawal?", message: "Only confirm once you've actually sent the payout to the user's destination yourself - this just finalizes the record." }))) return;
    setWBusyId(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Done");
      setWRejectingId(null);
      setWRejectNote("");
      await loadWithdrawalRequests(wStatusFilter);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setWBusyId(null); }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (newLabel.trim().length < 2) return notify("Enter a label for this destination.", true);
    if (newInstructions.trim().length < 2) return notify("Enter the account details users should send funds to.", true);
    if (!(await confirm({ title: "Add this deposit destination?", message: "It becomes visible to every user depositing with this method." }))) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/deposit-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: newMethod, label: newLabel, instructions: newInstructions }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination added");
      setNewLabel(""); setNewInstructions("");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCreating(false); }
  };
  const toggleActive = async (account: DepositAccountRow) => {
    if (!(await confirm({ title: account.isActive ? "Deactivate this destination?" : "Activate this destination?" }))) return;
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${account.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !account.isActive }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };
  const saveEdit = async (id: string) => {
    if (!(await confirm({ title: "Save changes to this destination?" }))) return;
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: editLabel, instructions: editInstructions }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination updated");
      setEditingId(null);
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };
  const removeAccount = async (id: string) => {
    if (!(await confirm({ title: "Delete this deposit destination?", message: "Past deposit requests keep a record of what was shown at the time.", confirmLabel: "Delete", danger: true }))) return;
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination removed");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (broadcastSending) return;
    if (broadcastForm.title.trim().length < 2) return notify("Enter a title.", true);
    if (broadcastForm.message.trim().length < 1) return notify("Enter a message.", true);
    if (!(await confirm({ title: "Send this announcement to every user right now?", message: "This goes out immediately to every real (non-demo) account, in-app and by email.", confirmLabel: "Send broadcast", danger: true }))) return;
    setBroadcastSending(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(broadcastForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(`Broadcast sent to ${result.sent} user${result.sent === 1 ? "" : "s"}.`);
      setBroadcastResult(result.sent);
      setBroadcastForm({ title: "", message: "" });
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBroadcastSending(false); }
  };
  if (authState === "loading") return <div className="admin-shell admin-center"><Clock3 size={22}/><p>{<LocalizedText text={"Loading admin panel…"}/>}</p></div>;
  if (authState === "denied") return <div className="admin-shell admin-center">
    <div className="panel admin-denied">
      <LockKeyhole size={28}/>
      <h2>{<LocalizedText text={"Admins only"}/>}</h2>
      <p>{<LocalizedText text={"You need an admin account to view this page. Sign in with an admin account on the main app, then come back here."}/>}</p>
      <Link className="primary-btn" href="/dashboard"><ArrowLeft size={16}/> {<LocalizedText text={"Back to Denary Drill Capital Markets"}/>}</Link>
    </div>
  </div>;

  const active = tabTitles[tab];

  return <div className="admin-shell">
    {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand" onClick={() => go("overview")}><div className="brand-icon"><DdcmMark size={23}/></div><span><span className="ddcm-wordmark">DDCM</span></span><button className="mobile-close" onClick={(e) => { e.stopPropagation(); setMobileMenu(false); }}><X size={19}/></button></div>
      <div className="sidebar-body">{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => { const Icon = item.icon; return <button key={item.name} className={`nav-item ${tab === item.name ? "selected" : ""}`} onClick={() => go(item.name)}><Icon size={19} strokeWidth={tab === item.name ? 2.25 : 1.8}/><span>{item.label}</span></button>; })}</div>)}</div>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-bubble"><ShieldCheck size={18}/></span><strong>{admin?.name}</strong><p>{admin?.email ?? translateUI("Signed in as admin")}</p><Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>{<LocalizedText text={"Exit to app"}/>} <ArrowRight size={14}/></Link></div>
        <div className="sidebar-footer"><ShieldCheck size={15}/> {<LocalizedText text={"Denary Drill Capital Markets admin panel"}/>}</div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn menu-btn" onClick={() => setMobileMenu(true)} aria-label={translateUI("Open menu")}><Menu size={22}/></button><div className="breadcrumb">{<LocalizedText text={"Admin"}/>} <ChevronRight size={15}/> <strong>{active.title}</strong></div></div>
        <div className="topbar-right">
          <div className="notification-wrap">
            <button className="icon-btn notif-btn" aria-label={translateUI("Notifications")} onClick={toggleNotifications}><Bell size={20}/>{unreadNotifications > 0 && <i/>}</button>
            {notificationsOpen && <div className="popover notification-popover">
              <div className="popover-title">{<LocalizedText text={"Notifications"}/>} {unreadNotifications > 0 && <span>{unreadNotifications} {<LocalizedText text={"new"}/>}</span>}</div>
              {recentNotifications.length === 0 ? <div className="notification-empty"><Bell size={18}/><p>{<LocalizedText text={"No notifications yet"}/>}</p></div> : recentNotifications.map(n => { const { Icon, color } = notificationVisual(n.type); return <div className={`notification-item ${n.readAt ? "" : "unread"}`} key={n.id}>
                <span className={`notification-icon ${color}`}><Icon size={16}/></span>
                <div><strong><LocalizedText text={n.title}/></strong><p><LocalizedText text={n.message}/></p><small>{timeAgo(n.createdAt)}</small>{n.aboutUserId && <button className="notification-view-account" onClick={() => viewAccountFromNotification(n.aboutUserId!)}><UserRound size={11}/> {<LocalizedText text={"View account"}/>}</button>}</div>
              </div>; })}
              <button className="notification-see-all" onClick={() => { setNotificationsOpen(false); setTab("notifications"); }}>{<LocalizedText text={"See all notifications"}/>} <ArrowRight size={13}/></button>
            </div>}
          </div>
          <button className="theme-toggle" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={19}/> : <Moon size={19}/>}</button>{currency !== "USD" && <span className="admin-whoami" title={translateUI("Change this from your Profile page in the main app")}><Wallet size={14}/> {<LocalizedText text={"Amounts in"}/>} {currency}</span>}<Link href="/dashboard" className="outline-btn small"><ArrowLeft size={14}/> {<LocalizedText text={"Exit to app"}/>}</Link></div>
      </header>
      <main className="admin-content">
        <div className="page-heading"><div><div className="eyebrow">{<LocalizedText text={"ADMIN PANEL"}/>}</div><h1>{active.title}</h1><p>{active.description}</p></div></div>

        {tab === "overview" && <>
          {overviewLoading && !overview ? <div className="no-results">{<LocalizedText text={"Loading overview…"}/>}</div> : overview && <>
            <div className="stats-grid five">
              <div className="stat-card"><span className="stat-icon blue"><UsersRound size={19}/></span><span className="stat-label">{<LocalizedText text={"Total users"}/>}</span><strong className="stat-value">{overview.totalUsers}</strong><div className="stat-foot"><span>{overview.restrictedAccounts} {<LocalizedText text={"restricted"}/>}</span></div></div>
              <div className="stat-card"><span className="stat-icon green"><Wallet size={19}/></span><span className="stat-label">{<LocalizedText text={"Total capital"}/>}</span><strong className="stat-value">{money(Number(overview.totalCashBalance))}</strong><div className="stat-foot"><span>{<LocalizedText text={"Across all accounts"}/>}</span></div></div>
              <div className="stat-card"><span className="stat-icon green"><TrendingUp size={19}/></span><span className="stat-label">{<LocalizedText text={"Total profits"}/>}</span><strong className="stat-value">{money(Number(overview.totalProfitBalance))}</strong><div className="stat-foot"><span>{<LocalizedText text={"Across all accounts"}/>}</span></div></div>
              <div className="stat-card"><span className="stat-icon orange"><ArrowDownLeft size={19}/></span><span className="stat-label">{<LocalizedText text={"Pending deposits"}/>}</span><strong className="stat-value">{overview.pendingDeposits}</strong><div className="stat-foot"><button className="text-link" onClick={() => go("deposits")} style={{ fontSize: 11 }}>{<LocalizedText text={"Review"}/>} <ArrowRight size={13}/></button></div></div>
              <div className="stat-card"><span className="stat-icon purple"><ArrowUpRight size={19}/></span><span className="stat-label">{<LocalizedText text={"Pending withdrawals"}/>}</span><strong className="stat-value">{overview.pendingWithdrawals}</strong><div className="stat-foot"><button className="text-link" onClick={() => go("withdrawals")} style={{ fontSize: 11 }}>{<LocalizedText text={"Review"}/>} <ArrowRight size={13}/></button></div></div>
            </div>
          </>}
          <section className="panel admin-panel" style={{ marginTop: 18, padding: 20 }}>
            <SectionHeadSimple title={translateUI("Quick actions")}/>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 0 4px" }}>
              <button className="outline-btn" onClick={() => go("users")}><UsersRound size={16}/> {<LocalizedText text={"Manage users"}/>}</button>
              <button className="outline-btn" onClick={() => go("deposits")}><ArrowDownLeft size={16}/> {<LocalizedText text={"Review deposits"}/>}</button>
              <button className="outline-btn" onClick={() => go("withdrawals")}><ArrowUpRight size={16}/> {<LocalizedText text={"Review withdrawals"}/>}</button>
              <button className="outline-btn" onClick={() => { setShowCreateUser(true); go("users"); }}><UserPlus size={16}/> {<LocalizedText text={"Add a user"}/>}</button>
            </div>
          </section>
        </>}

        {tab === "notifications" && (() => {
          const notifFilterOptions: { label: string; value: string }[] = [
            { label: "All", value: "" },
            { label: "New accounts", value: "account_created" },
            { label: "Logins", value: "login" },
            { label: "Trading", value: "trade_placed" },
            { label: "Orders", value: "order_filled" },
            { label: "Positions", value: "position_auto_closed" },
            { label: "Deposits", value: "deposit_submitted" },
            { label: "Withdrawals", value: "withdrawal_submitted" },
            { label: "Security", value: "password_changed" },
            { label: "Admin actions", value: "admin_message" },
          ];
          const page1 = notifOffset + 1;
          const pageCount = Math.max(Math.ceil(notifTotal / NOTIF_PAGE_SIZE), 1);
          const currentPageNum = Math.floor(notifOffset / NOTIF_PAGE_SIZE) + 1;
          return <section className="panel">
            <div className="section-head"><div><h2>{<LocalizedText text={"All notifications"}/>}</h2><p>{notifTotal} {<LocalizedText text={"total · every notable event across every user account"}/>}</p></div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {unreadNotifications > 0 && <button className="outline-btn small" onClick={() => void markAllNotificationsRead()}><Check size={14}/> {<LocalizedText text={"Mark all read"}/>}</button>}
                <div className="select-wrap" style={{ height: 37 }}><select value={notifTypeFilter} onChange={(e) => { setNotifTypeFilter(e.target.value); void loadAllNotifications(0, e.target.value); }}>{notifFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              </div>
            </div>
            {notifLoading ? <div className="no-results">{<LocalizedText text={"Loading notifications..."}/>}</div> : allNotifications.length === 0 ? <div className="empty-state"><span className="empty-icon"><Bell size={27}/></span><h3>{<LocalizedText text={"No notifications"}/>}</h3><p>{<LocalizedText text={"Activity across every user account will show up here."}/>}</p></div> : <>
              <div className="notifications-page-list">{allNotifications.map(n => { const { Icon, color } = notificationVisual(n.type); return <div className={`notification-item ${n.readAt ? "" : "unread"}`} key={n.id} onClick={() => !n.readAt && markOneNotificationRead(n.id)} style={{ cursor: n.readAt ? "default" : "pointer" }}>
                <span className={`notification-icon ${color}`}><Icon size={16}/></span>
                <div><strong><LocalizedText text={n.title}/></strong><p><LocalizedText text={n.message}/></p><small>{new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</small>
                  {n.aboutUserId && <button className="notification-view-account" onClick={(e) => { e.stopPropagation(); viewAccountFromNotification(n.aboutUserId!); }}><UserRound size={11}/> {<LocalizedText text={"View account"}/>}</button>}
                </div>
              </div>; })}</div>
              <div className="notifications-pagination">
                <button className="outline-btn small" disabled={page1 <= 1} onClick={() => loadAllNotifications(Math.max(notifOffset - NOTIF_PAGE_SIZE, 0), notifTypeFilter)}><ChevronLeft size={14}/> {<LocalizedText text={"Previous"}/>}</button>
                <span>{<LocalizedText text={"Page"}/>} {currentPageNum} {<LocalizedText text={"of"}/>} {pageCount}</span>
                <button className="outline-btn small" disabled={notifOffset + NOTIF_PAGE_SIZE >= notifTotal} onClick={() => loadAllNotifications(notifOffset + NOTIF_PAGE_SIZE, notifTypeFilter)}>{<LocalizedText text={"Next"}/>} <ChevronRight size={14}/></button>
              </div>
            </>}
          </section>;
        })()}

        {tab === "users" && !selectedUserId && <>
          <div className="admin-filter-row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
            <div className="top-search" style={{ width: 280 }}><Search size={17}/><input placeholder={translateUI("Search by name or email…")} value={userSearch} onChange={e => setUserSearch(e.target.value)}/></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="subtle-label">{userTotals.total} {<LocalizedText text={"user"}/>}{userTotals.total === 1 ? "" : translateUI("s")} {<LocalizedText text={"·"}/>} {money(Number(userTotals.totalCashBalance))} {<LocalizedText text={"total balance ·"}/>} {money(Number(userTotals.totalProfitBalance))} {<LocalizedText text={"total profits"}/>}</span>
              <button className="outline-btn small" onClick={() => loadUsers(userSearch)}><RefreshCw size={13} className={usersLoading ? "spin" : ""}/> {<LocalizedText text={"Refresh"}/>}</button>
              <button className="primary-btn small" onClick={() => setShowCreateUser(s => !s)}><UserPlus size={15}/> {<LocalizedText text={"Add user"}/>}</button>
            </div>
          </div>
          {showCreateUser && <section className="panel admin-panel" style={{ marginBottom: 18 }}>
            <div className="section-head"><div><h2>{<LocalizedText text={"Create a new user"}/>}</h2><p>{<LocalizedText text={"Useful for setting up an account for a customer who signed up another way."}/>}</p></div></div>
            <form className="admin-account-form" onSubmit={createUser} style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0 16px" }}>
              <div><label className="input-label">{<LocalizedText text={"Full name"}/>}</label><input className="text-input" value={createUserForm.name} onChange={e => setCreateUserForm({ ...createUserForm, name: e.target.value })} maxLength={80}/></div>
              <div><label className="input-label">{<LocalizedText text={"Email"}/>}</label><input className="text-input" type="email" value={createUserForm.email} onChange={e => setCreateUserForm({ ...createUserForm, email: e.target.value })}/></div>
              <div><label className="input-label">{<LocalizedText text={"Password"}/>}</label><input className="text-input" type="password" placeholder={translateUI("At least 8 characters")} value={createUserForm.password} onChange={e => setCreateUserForm({ ...createUserForm, password: e.target.value })}/></div>
              <div><label className="input-label">{<LocalizedText text={"Starting balance"}/>}</label><input className="text-input" type="number" step="0.01" min="0" value={createUserForm.cashBalance} onChange={e => setCreateUserForm({ ...createUserForm, cashBalance: e.target.value })}/></div>
              <div><label className="input-label">{<LocalizedText text={"Starting profits"}/>}</label><input className="text-input" type="number" step="0.01" min="0" value={createUserForm.profitBalance} onChange={e => setCreateUserForm({ ...createUserForm, profitBalance: e.target.value })}/></div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, marginTop: 14 }}><button className="primary-btn" disabled={createUserBusy}>{createUserBusy ? translateUI("Creating...") : translateUI("Create user")}</button><button type="button" className="outline-btn" onClick={() => setShowCreateUser(false)}>{<LocalizedText text={"Cancel"}/>}</button></div>
            </form>
          </section>}
          <section className="panel admin-panel">
            <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"User"}/>}</th><th>{<LocalizedText text={"Role"}/>}</th><th>{<LocalizedText text={"Balance"}/>}</th><th>{<LocalizedText text={"Profits"}/>}</th><th>{<LocalizedText text={"Target"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th><th>Verification</th><th>{<LocalizedText text={"Joined"}/>}</th><th></th></tr></thead><tbody>
              {userRows.map(u => <tr key={u.id} className="clickable-row" onClick={() => openUser(u.id)}>
                <td><div className="coin-cell"><span className="avatar" style={{ width: 34, height: 34, fontSize: 11 }}>{u.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><div><strong>{u.name}</strong><span>{u.email}</span></div></div></td>
                <td className="capitalize">{u.role}{u.isDemo ? translateUI(" · demo") : ""}</td>
                <td className="table-strong">{money(Number(u.cashBalance))}</td>
                <td className="table-strong">{money(Number(u.profitBalance))}</td>
                <td className="table-strong">{money(Number(u.targetBalance))}</td>
                <td><span className={`status-pill ${u.accountStatus}`}><span/>{accountStatusLabel(u.accountStatus as AccountStatus)}</span></td>
                <td>{u.isDemo ? "Demo" : u.emailVerifiedAt ? "Verified / approved" : "Pending approval"}</td>
                <td className="muted-cell">{new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td><button className="outline-btn small" onClick={e => { e.stopPropagation(); openUser(u.id); }}>{<LocalizedText text={"Manage"}/>}</button></td>
              </tr>)}
            </tbody></table>{userRows.length === 0 && !usersLoading && <div className="empty-state"><span className="empty-icon"><UsersRound size={27}/></span><h3>{<LocalizedText text={"No users found"}/>}</h3><p>{<LocalizedText text={"Try a different search, or add a new user above."}/>}</p></div>}</div>
          </section>
        </>}

        {tab === "users" && selectedUserId && <>
          <button className="outline-btn small" onClick={closeUser} style={{ marginBottom: 16 }}><ArrowLeft size={14}/> {<LocalizedText text={"Back to all users"}/>}</button>
          {userDetailLoading && !userDetail ? <div className="no-results">{<LocalizedText text={"Loading user…"}/>}</div> : userDetail && <>
            <div className="panel admin-panel" style={{ padding: 20, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="avatar" style={{ width: 48, height: 48, fontSize: 14 }}>{userDetail.user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
                <div><h2 style={{ margin: 0, fontSize: 18 }}>{userDetail.user.name}</h2><p style={{ margin: "4px 0 0", color: "#8995a9", fontSize: 12 }}>{userDetail.user.email} {<LocalizedText text={"·"}/>} {userDetail.user.role}{userDetail.user.isDemo ? translateUI(" · demo account") : ""}</p></div>
              </div>
              <span className={`status-pill ${userDetail.user.accountStatus}`} style={{ fontSize: 12, padding: "7px 12px" }}><span/>{accountStatusLabel(userDetail.user.accountStatus as AccountStatus)}</span>
            </div>

            <div className="panel admin-panel" style={{ padding: 20, marginBottom: 18 }}>
              <p>Verification: <strong>{userDetail.user.isDemo ? "Demo account" : userDetail.user.emailVerifiedAt ? "Verified / approved" : "Pending approval"}</strong></p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {!userDetail.user.isDemo && !userDetail.user.emailVerifiedAt && <button type="button" className="primary-btn" disabled={userActionBusy} onClick={() => void runUserAction("approve")}>Approve without OTP</button>}
                {userDetail.user.role === "user" && !userDetail.user.isDemo && <button type="button" className="outline-btn" disabled={userActionBusy} onClick={() => void runUserAction("delete")}>Permanently delete user</button>}
              </div>
            </div>
            <div className="admin-accounts-layout">
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Profile")} subtitle="Name, email, and role"/>
                  <form className="admin-account-form" onSubmit={saveUserProfile}>
                    <label className="input-label">{<LocalizedText text={"Full name"}/>}</label><input className="text-input" value={editUserForm.name} onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} maxLength={80}/>
                    <label className="input-label">{<LocalizedText text={"Email"}/>}</label><input className="text-input" type="email" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}/>
                    <label className="input-label">{<LocalizedText text={"Role"}/>}</label>
                    <div className="select-wrap"><select value={editUserForm.role} onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}><option value="user">{<LocalizedText text={"User"}/>}</option><option value="admin">{<LocalizedText text={"Admin"}/>}</option></select><ChevronDown size={16}/></div>
                    <button className="primary-btn full-btn" disabled={editUserBusy} style={{ marginTop: 14 }}><Pencil size={15}/> {editUserBusy ? translateUI("Saving...") : translateUI("Save profile")}</button>
                  </form>
                  <div className="profile-readonly-row"><span>{<LocalizedText text={"Username"}/>}</span><span>{userDetail.user.username ? `@${userDetail.user.username}` : translateUI("Not set")}</span></div>
                  <div className="profile-readonly-row"><span>{<LocalizedText text={"Phone"}/>}</span><span>{userDetail.user.phone ?? translateUI("Not set")}</span></div>
                  <div className="profile-readonly-row"><span>{<LocalizedText text={"Country"}/>}</span><span>{userDetail.user.country ?? translateUI("Not set")}</span></div>
                  <div className="profile-readonly-row"><span>{<LocalizedText text={"Display currency"}/>}</span><span>{"USD"}</span></div>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Account standing")} subtitle="Lock, suspend, or limit this account"/>
                  <form className="admin-account-form" onSubmit={saveUserStatus}>
                    <label className="input-label">{<LocalizedText text={"Status"}/>}</label>
                    <div className="select-wrap"><select value={statusForm.accountStatus} onChange={e => setStatusForm({ ...statusForm, accountStatus: e.target.value as AccountStatus })}>{ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{accountStatusLabel(s)}</option>)}</select><ChevronDown size={16}/></div>
                    {statusForm.accountStatus === "limited" && <>
                      <label className="input-label">{<LocalizedText text={"Max trade size (USD, optional)"}/>}</label>
                      <input className="text-input" type="number" step="0.01" min="0" placeholder={translateUI("No limit")} value={statusForm.maxTradeAmount} onChange={e => setStatusForm({ ...statusForm, maxTradeAmount: e.target.value })}/>
                      {currency !== "USD" && <StoredUsdHint typed={statusForm.maxTradeAmount} money={money}/>}
                      <label className="checkbox-row"><input type="checkbox" checked={statusForm.withdrawalsBlocked} onChange={e => setStatusForm({ ...statusForm, withdrawalsBlocked: e.target.checked })}/> {<LocalizedText text={"Block withdrawals"}/>}</label>
                    </>}
                    <label className="input-label">{<LocalizedText text={"Reason (optional, shown to user)"}/>}</label>
                    <textarea className="text-input" rows={2} value={statusForm.statusReason} onChange={e => setStatusForm({ ...statusForm, statusReason: e.target.value })} maxLength={500}/>
                    <button className="primary-btn full-btn" disabled={statusBusy} style={{ marginTop: 14 }}><ShieldAlert size={15}/> {statusBusy ? translateUI("Saving...") : translateUI("Update standing")}</button>
                  </form>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Edit capital")} subtitle="Directly set this user's capital"/>
                  <form className="admin-account-form" onSubmit={saveBalance}>
                    <label className="input-label">{<LocalizedText text={"New capital"}/>}</label>
                    <input className="text-input" type="number" step="0.01" min="0" value={balanceForm.newBalance} onChange={e => setBalanceForm({ ...balanceForm, newBalance: e.target.value })}/>
                    <label className="input-label">{<LocalizedText text={"Note (optional)"}/>}</label>
                    <input className="text-input" placeholder={translateUI("e.g. Manual correction, bonus credit...")} value={balanceForm.note} onChange={e => setBalanceForm({ ...balanceForm, note: e.target.value })} maxLength={300}/>
                    <button className="primary-btn full-btn" disabled={balanceBusy} style={{ marginTop: 14 }}><Wallet size={15}/> {balanceBusy ? translateUI("Saving...") : translateUI("Update capital")}</button>
                  </form>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Edit profits")} subtitle="Directly set this user's profit balance — folded into their total balance"/>
                  <form className="admin-account-form" onSubmit={saveProfit}>
                    <label className="input-label">{<LocalizedText text={"New profits"}/>}</label>
                    <input className="text-input" type="number" step="0.01" min="0" value={profitForm.newProfit} onChange={e => setProfitForm({ ...profitForm, newProfit: e.target.value })}/>
                    <label className="input-label">{<LocalizedText text={"Note (optional)"}/>}</label>
                    <input className="text-input" placeholder={translateUI("e.g. Copy trading gains, bonus profit...")} value={profitForm.note} onChange={e => setProfitForm({ ...profitForm, note: e.target.value })} maxLength={300}/>
                    <button className="primary-btn full-btn" disabled={profitBusy} style={{ marginTop: 14 }}><TrendingUp size={15}/> {profitBusy ? translateUI("Saving...") : translateUI("Update profits")}</button>
                  </form>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title="Start a bot plan" subtitle="The allocation is debited from this user's capital. Plans do not expire."/>
                  <form className="admin-account-form" onSubmit={startBotForUser}>
                    <p>Available capital: <strong>{money(Number(userDetail.user.cashBalance))}</strong></p>
                    {botCatalogError && <p role="alert">{botCatalogError}</p>}
                    <label className="input-label" htmlFor="admin-bot-plan">Bot plan</label>
                    <div className="select-wrap"><select id="admin-bot-plan" required value={botPlanId} disabled={botBusy} onChange={e => { setBotPlanId(e.target.value); setBotRequestId(null); }}><option value="">Choose a plan</option>{BOT_PLAN_TIERS.filter(tier => activeBotIds.includes(tier.id)).map(tier => <option key={tier.id} value={tier.id}>{tier.name} (${tier.min.toLocaleString()}–${tier.max.toLocaleString()})</option>)}</select></div>
                    <label className="input-label" htmlFor="admin-bot-amount">Allocation (USD)</label>
                    <input id="admin-bot-amount" className="text-input" type="number" min="0" step="0.01" required value={botAmount} disabled={botBusy} onChange={e => { setBotAmount(e.target.value); setBotRequestId(null); }}/>
                    <button className="primary-btn full-btn" disabled={botBusy || !activeBotIds.length} style={{ marginTop: 14 }}>{botBusy ? "Starting…" : "Start plan for user"}</button>
                  </form>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title="Signal purchase price" subtitle="Set this user's USD price for 100% signal strength. Leave blank to disable purchases."/>
                  <form className="admin-account-form" onSubmit={saveSignalPrice}>
                    <label className="input-label" htmlFor="signal-price">Price for 100% (USD)</label>
                    <input id="signal-price" className="text-input" type="number" min="0.01" max="100000000" step="0.01" value={signalPrice} onChange={e => setSignalPrice(e.target.value)} placeholder="Purchases disabled"/>
                    <button className="primary-btn full-btn" disabled={signalPriceBusy} style={{ marginTop: 14 }}>{signalPriceBusy ? "Saving…" : "Save signal price"}</button>
                  </form>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Dashboard gauges")} subtitle="Set the values shown to this user below their balance. These gauges are display controls and do not change account funds."/>

                  <div className="admin-account-form">
                    <label className="input-label">Target amount · {targetForm.currency}</label>
                    <input className="text-input" type="number" step="0.01" min="0" value={targetForm.newTarget} onChange={e => setTargetForm({ ...targetForm, newTarget: e.target.value })}/>
                    <input className="admin-gauge-slider target-amount-slider" aria-label="Target amount slider" type="range" min="0" max="500000" step="100" value={Math.min(500000, Number(targetForm.newTarget) || 0)} onChange={e => setTargetForm({ ...targetForm, newTarget: e.target.value })}/>
                    <button type="button" className="outline-btn" disabled={targetBusy} onClick={() => saveGauge("target")}>Save target amount</button>
                    <label className="input-label gauge-admin-label">Trade progress <strong>{Number(targetForm.newProgress || 0)}%</strong></label>
                    <input className="admin-gauge-slider" aria-label="Trade progress" type="range" min="0" max="100" step="1" value={Math.max(0, Math.min(100, Number(targetForm.newProgress) || 0))} onChange={e => setTargetForm({ ...targetForm, newProgress: e.target.value })}/>
                    <button type="button" className="outline-btn" disabled={targetBusy} onClick={() => saveGauge("progress")}>Save trade progress</button>
                    <label className="input-label gauge-admin-label">Signal strength <strong>{Number(targetForm.signalStrength || 0)}%</strong></label>
                    <input className="admin-gauge-slider signal-slider" aria-label="Signal strength" type="range" min="0" max="100" step="1" value={Math.max(0, Math.min(100, Number(targetForm.signalStrength) || 0))} onChange={e => setTargetForm({ ...targetForm, signalStrength: e.target.value })}/>
                    <button type="button" className="outline-btn" disabled={targetBusy} onClick={() => saveGauge("signal")}>Save signal strength</button>
                  </div>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Send a notification")} subtitle="Shown in this user's notification bell"/>
                  <form className="admin-account-form" onSubmit={sendNotification}>
                    <label className="input-label">{<LocalizedText text={"Title"}/>}</label>
                    <input className="text-input" value={notifForm.title} onChange={e => setNotifForm({ ...notifForm, title: e.target.value })} maxLength={120}/>
                    <label className="input-label">{<LocalizedText text={"Message"}/>}</label>
                    <textarea className="text-input" rows={3} value={notifForm.message} onChange={e => setNotifForm({ ...notifForm, message: e.target.value })} maxLength={1000}/>
                    <button className="primary-btn full-btn" disabled={notifBusy} style={{ marginTop: 14 }}><Send size={15}/> {notifBusy ? translateUI("Sending...") : translateUI("Send notification")}</button>
                  </form>
                </section>

              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Recent trades")}/>
                  <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Asset"}/>}</th><th>{<LocalizedText text={"Side"}/>}</th><th>{<LocalizedText text={"Qty"}/>}</th><th>{<LocalizedText text={"Price"}/>}</th><th>{<LocalizedText text={"Total"}/>}</th><th>{<LocalizedText text={"Date"}/>}</th></tr></thead><tbody>
                    {userDetail.trades.map(t => <tr key={t.id}><td className="table-strong">{t.symbol}{t.placedBy && <span className="placed-by-support-badge"> <UserRound size={11}/> {<LocalizedText text={"Admin"}/>}</span>}</td><td className="capitalize">{t.side}</td><td>{Number(t.quantity)}</td><td>{marketPrice(Number(t.price))}</td><td className="table-strong">{money(Number(t.total))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleDateString()}</td></tr>)}
                  </tbody></table>{userDetail.trades.length === 0 && <div className="empty-state"><span className="empty-icon"><History size={27}/></span><h3>{<LocalizedText text={"No trades yet"}/>}</h3><p>{<LocalizedText text={"&nbsp;"}/>}</p></div>}</div>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Recent transactions")}/>
                  <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Description"}/>}</th><th>{<LocalizedText text={"Type"}/>}</th><th>{<LocalizedText text={"Amount"}/>}</th><th>{<LocalizedText text={"Date"}/>}</th></tr></thead><tbody>
                    {userDetail.transactions.map(t => <tr key={t.id}><td>{t.description}</td><td className="capitalize">{t.type.replace("_", " ")}</td><td className="table-strong">{money(Number(t.amount))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleDateString()}</td></tr>)}
                  </tbody></table>{userDetail.transactions.length === 0 && <div className="empty-state"><span className="empty-icon"><CreditCard size={27}/></span><h3>{<LocalizedText text={"No transactions yet"}/>}</h3><p>{<LocalizedText text={"&nbsp;"}/>}</p></div>}</div>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Deposit & withdrawal requests")}/>
                  <div className="admin-account-list">
                    {[...userDetail.depositRequests.map(r => ({ ...r, kind: "Deposit" })), ...userDetail.withdrawalRequests.map(r => ({ ...r, kind: "Withdrawal" }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => <div className="admin-account-item" key={`${r.kind}-${r.id}`}>
                      <div className="admin-account-item-top"><strong>{r.kind} {<LocalizedText text={"·"}/>} {money(Number(r.amount))}</strong><span className={`status-pill ${r.status}`}><span/>{r.status}</span></div>
                      <p>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                    </div>)}
                    {userDetail.depositRequests.length + userDetail.withdrawalRequests.length === 0 && <div className="empty-state"><span className="empty-icon"><Wallet size={27}/></span><h3>{<LocalizedText text={"No requests yet"}/>}</h3><p>{<LocalizedText text={"&nbsp;"}/>}</p></div>}
                  </div>
                </section>

                <section className="panel admin-panel">
                  <SectionHeadSimple title={translateUI("Notifications sent")} subtitle="Admin notifications sent to this user"/>
                  <div className="admin-account-list">
                    {userDetail.notifications.map(n => <div className="admin-account-item" key={n.id}>
                      <div className="admin-account-item-top"><strong><LocalizedText text={n.title}/></strong><span className={`status-pill ${n.readAt ? "approved" : "pending"}`}><span/>{n.readAt ? translateUI("Read") : translateUI("Unread")}</span></div>
                      <p><LocalizedText text={n.message}/></p>
                    </div>)}
                    {userDetail.notifications.length === 0 && <div className="empty-state"><span className="empty-icon"><Bell size={27}/></span><h3>{<LocalizedText text={"No notifications sent"}/>}</h3><p>{<LocalizedText text={"&nbsp;"}/>}</p></div>}
                  </div>
                </section>
              </div>
            </div>
          </>}
        </>}

        {tab === "signal-requests" && <section className="panel admin-panel">
          <div className="section-head"><div><h2>Signal purchase requests</h2><p>The quoted cost is charged only on approval. Prices are locked at request time; capital is not reserved.</p></div><button className="outline-btn small" onClick={() => void loadSignalRequests()} disabled={signalRequestsLoading}>Refresh</button></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>User</th><th>Requested</th><th>Current strength</th><th>Quoted cost</th><th>Current capital</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{signalRequests.map(item => <tr key={item.id}>
            <td><strong>{item.userName}</strong><br/>{item.userEmail}</td><td>+{item.percent}%</td><td>{Number(item.currentSignal).toFixed(2)}%</td><td>{money(Number(item.cost))}</td><td>{money(Number(item.capital))}</td><td>{new Date(item.createdAt).toLocaleString()}</td><td className="capitalize">{item.status}</td><td>{item.status === "pending" && <div style={{ display: "flex", gap: 6 }}><button className="primary-btn small" disabled={!!signalReviewBusy} onClick={() => void reviewSignalRequest(item, "approve")}>Approve</button><button className="outline-btn small" disabled={!!signalReviewBusy} onClick={() => void reviewSignalRequest(item, "reject")}>Reject</button></div>}</td>
          </tr>)}</tbody></table></div>
          {!signalRequestsLoading && signalRequests.length === 0 && <div className="empty-state"><p>No signal requests yet.</p></div>}
        </section>}

        {tab === "deposits" && <section className="panel admin-panel">
          <div className="section-head">
            <div><h2>{<LocalizedText text={"Deposit requests"}/>}</h2><p>{<LocalizedText text={"Approving credits the user's balance immediately; nothing is credited automatically."}/>}</p></div>
            <div className="admin-filter-row">
              <div className="segmented">{(["pending", "approved", "rejected", "all"] as const).map(s => <button key={s} className={statusFilter === s ? "active" : ""} onClick={() => setStatusFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
              <button className="outline-btn small" onClick={() => loadRequests(statusFilter)}><RefreshCw size={13} className={requestsLoading ? "spin" : ""}/> {<LocalizedText text={"Refresh"}/>}</button>
            </div>
          </div>
          <div className="admin-request-list">
            {requests.length === 0 && !requestsLoading && <div className="empty-state"><span className="empty-icon"><Clock3 size={27}/></span><h3>{<LocalizedText text={"No"}/>} {statusFilter === "all" ? "" : statusFilter} {<LocalizedText text={"deposit requests"}/>}</h3><p>{<LocalizedText text={"Submitted deposit requests will appear here."}/>}</p></div>}
            {requests.map(r => <div className="admin-request-card" key={r.id}>
              <div className="admin-request-head">
                <div><strong>{money(Number(r.amount))}</strong><span className="admin-request-method">{translateUI(depositMethodLabel(r.method))}{r.destinationLabel ? ` · ${r.destinationLabel}` : ""}</span></div>
                <span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? translateUI("Pending review") : r.status === "approved" ? translateUI("Approved") : translateUI("Rejected")}</span>
              </div>
              <div className="admin-request-meta">
                <div><span>{<LocalizedText text={"User"}/>}</span><strong>{r.userName}</strong><small>{r.userEmail}</small></div>
                <div><span>{<LocalizedText text={"Submitted"}/>}</span><strong>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong></div>
                {r.reference && <div><span>{<LocalizedText text={"Reference"}/>}</span><strong>{r.reference}</strong></div>}
                <div><span>{<LocalizedText text={"Receipt"}/>}</span><a href={`/api/deposits/${r.id}/receipt`} target="_blank" rel="noreferrer" className="text-link">{<LocalizedText text={"View file"}/>} <Activity size={13}/></a></div>
              </div>
              {r.note && <p className="admin-request-note"><strong>{<LocalizedText text={"User note:"}/>}</strong> {r.note}</p>}
              {r.adminNote && <p className="admin-request-note admin-note-flag"><AlertTriangle size={13}/> {r.adminNote}</p>}
              {r.status === "pending" && <div className="admin-request-actions">
                {rejectingId === r.id ? <div className="admin-reject-form">
                  <textarea className="text-input" placeholder={translateUI("Reason for rejection (shown to the user)")} value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}/>
                  <div className="admin-reject-buttons">
                    <button className="outline-btn small" onClick={() => { setRejectingId(null); setRejectNote(""); }}>{<LocalizedText text={"Cancel"}/>}</button>
                    <button className="primary-btn small reject-btn" disabled={busyId === r.id || !rejectNote.trim()} onClick={() => review(r.id, "reject", rejectNote)}><X size={14}/> {<LocalizedText text={"Confirm reject"}/>}</button>
                  </div>
                </div> : <>
                  <button className="primary-btn small" disabled={busyId === r.id} onClick={() => review(r.id, "approve")}><Check size={14}/> {<LocalizedText text={"Approve & credit"}/>}</button>
                  <button className="outline-btn small reject-outline" disabled={busyId === r.id} onClick={() => setRejectingId(r.id)}><X size={14}/> {<LocalizedText text={"Reject"}/>}</button>
                </>}
              </div>}
            </div>)}
          </div>
        </section>}

        {tab === "withdrawals" && <section className="panel admin-panel">
          <div className="section-head">
            <div><h2>{<LocalizedText text={"Withdrawal requests"}/>}</h2><p>{<LocalizedText text={"The requested amount is already held from the user's balance. Send the payout yourself, then approve here to finalize, or reject to refund it."}/>}</p></div>
            <div className="admin-filter-row">
              <div className="segmented">{(["pending", "approved", "rejected", "all"] as const).map(s => <button key={s} className={wStatusFilter === s ? "active" : ""} onClick={() => setWStatusFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
              <button className="outline-btn small" onClick={() => loadWithdrawalRequests(wStatusFilter)}><RefreshCw size={13} className={wRequestsLoading ? "spin" : ""}/> {<LocalizedText text={"Refresh"}/>}</button>
            </div>
          </div>
          <div className="admin-request-list">
            {wRequests.length === 0 && !wRequestsLoading && <div className="empty-state"><span className="empty-icon"><Clock3 size={27}/></span><h3>{<LocalizedText text={"No"}/>} {wStatusFilter === "all" ? "" : wStatusFilter} {<LocalizedText text={"withdrawal requests"}/>}</h3><p>{<LocalizedText text={"Submitted withdrawal requests will appear here."}/>}</p></div>}
            {wRequests.map(r => <div className="admin-request-card" key={r.id}>
              <div className="admin-request-head">
                <div><strong>{money(Number(r.amount))}</strong><span className="admin-request-method">{translateUI(withdrawalMethodLabel(r.method, r.methodLabel))}</span></div>
                <span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? translateUI("Pending review") : r.status === "approved" ? translateUI("Approved") : translateUI("Rejected")}</span>
              </div>
              <div className="admin-request-meta">
                <div><span>{<LocalizedText text={"User"}/>}</span><strong>{r.userName}</strong><small>{r.userEmail}</small></div>
                <div><span>{<LocalizedText text={"Submitted"}/>}</span><strong>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong></div>
                <div><span>{<LocalizedText text={"Send payout to"}/>}</span><strong style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{r.destination}</strong></div>
              </div>
              {r.note && <p className="admin-request-note"><strong>{<LocalizedText text={"User note:"}/>}</strong> {r.note}</p>}
              {r.adminNote && <p className="admin-request-note admin-note-flag"><AlertTriangle size={13}/> {r.adminNote}</p>}
              {r.status === "pending" && <div className="admin-request-actions">
                {wRejectingId === r.id ? <div className="admin-reject-form">
                  <textarea className="text-input" placeholder={translateUI("Reason for rejection (shown to the user; the held amount is refunded)")} value={wRejectNote} onChange={e => setWRejectNote(e.target.value)} rows={2}/>
                  <div className="admin-reject-buttons">
                    <button className="outline-btn small" onClick={() => { setWRejectingId(null); setWRejectNote(""); }}>{<LocalizedText text={"Cancel"}/>}</button>
                    <button className="primary-btn small reject-btn" disabled={wBusyId === r.id || !wRejectNote.trim()} onClick={() => reviewWithdrawal(r.id, "reject", wRejectNote)}><X size={14}/> {<LocalizedText text={"Confirm reject & refund"}/>}</button>
                  </div>
                </div> : <>
                  <button className="primary-btn small" disabled={wBusyId === r.id} onClick={() => reviewWithdrawal(r.id, "approve")}><Check size={14}/> {<LocalizedText text={"Approve (I sent it)"}/>}</button>
                  <button className="outline-btn small reject-outline" disabled={wBusyId === r.id} onClick={() => setWRejectingId(r.id)}><X size={14}/> {<LocalizedText text={"Reject & refund"}/>}</button>
                </>}
              </div>}
            </div>)}
          </div>
        </section>}

        {tab === "accounts" && <section className="admin-accounts-layout">
          <section className="panel admin-panel">
            <div className="section-head"><div><h2>{<LocalizedText text={"Add a deposit destination"}/>}</h2><p>{<LocalizedText text={"This is shown to users when they choose this payment method."}/>}</p></div></div>
            <form className="admin-account-form" onSubmit={createAccount}>
              <label className="input-label">{<LocalizedText text={"Method"}/>}</label>
              <div className="select-wrap"><select value={newMethod} onChange={e => setNewMethod(e.target.value as DepositMethod)}>{DEPOSIT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
              <label className="input-label">{<LocalizedText text={"Label"}/>}</label>
              <input className="text-input" placeholder={translateUI("e.g. Bitcoin (BTC) or Chase Bank - Checking")} value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={120}/>
              <label className="input-label">{<LocalizedText text={"Details shown to users"}/>}</label>
              <textarea className="text-input deposit-textarea" placeholder={"e.g.\nAddress: bc1q...\nNetwork: Bitcoin (BTC only)"} value={newInstructions} onChange={e => setNewInstructions(e.target.value)} rows={4} maxLength={2000}/>
              <button className="primary-btn full-btn" disabled={creating}>{creating ? translateUI("Adding...") : translateUI("Add destination")}</button>
            </form>
          </section>
          <section className="panel admin-panel">
            <div className="section-head"><div><h2>{<LocalizedText text={"Current destinations"}/>}</h2><p>{accounts.length} {<LocalizedText text={"configured"}/>}</p></div><button className="outline-btn small" onClick={loadAccounts}><RefreshCw size={13} className={accountsLoading ? "spin" : ""}/> {<LocalizedText text={"Refresh"}/>}</button></div>
            <div className="admin-account-list">
              {DEPOSIT_METHODS.map(m => {
                const items = accounts.filter(a => a.method === m.id);
                if (!items.length) return null;
                return <div key={m.id} className="admin-account-group">
                  <h3>{m.label}</h3>
                  {items.map(a => <div className={`admin-account-item ${a.isActive ? "" : "inactive"}`} key={a.id}>
                    {editingId === a.id ? <div className="admin-account-edit">
                      <input className="text-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={120}/>
                      <textarea className="text-input deposit-textarea" value={editInstructions} onChange={e => setEditInstructions(e.target.value)} rows={3} maxLength={2000}/>
                      <div className="admin-reject-buttons"><button className="outline-btn small" onClick={() => setEditingId(null)}>{<LocalizedText text={"Cancel"}/>}</button><button className="primary-btn small" onClick={() => saveEdit(a.id)}>{<LocalizedText text={"Save"}/>}</button></div>
                    </div> : <>
                      <div className="admin-account-item-top"><strong>{a.label}</strong><span className={`status-pill ${a.isActive ? "approved" : "rejected"}`}><span/>{a.isActive ? translateUI("Active") : translateUI("Hidden")}</span></div>
                      <p>{a.instructions}</p>
                      <div className="admin-account-item-actions">
                        <button className="outline-btn small" onClick={() => { setEditingId(a.id); setEditLabel(a.label); setEditInstructions(a.instructions); }}>{<LocalizedText text={"Edit"}/>}</button>
                        <button className="outline-btn small" onClick={() => toggleActive(a)}>{a.isActive ? translateUI("Hide") : translateUI("Activate")}</button>
                        <button className="outline-btn small danger-outline" onClick={() => removeAccount(a.id)}><Trash2 size={13}/> {<LocalizedText text={"Delete"}/>}</button>
                      </div>
                    </>}
                  </div>)}
                </div>;
              })}
              {accounts.length === 0 && !accountsLoading && <div className="empty-state"><span className="empty-icon"><ShieldCheck size={27}/></span><h3>{<LocalizedText text={"No destinations configured"}/>}</h3><p>{<LocalizedText text={"Add one on the left so users know where to send funds."}/>}</p></div>}
            </div>
          </section>
        </section>}

        {tab === "broadcast" && <section className="admin-accounts-layout">
          <section className="panel admin-panel">
            <div className="section-head"><div><h2>{<LocalizedText text={"Broadcast an announcement"}/>}</h2><p>{<LocalizedText text={"Sends an in-app notification (and email, unless the user has email notifications off) to every real user account. Demo accounts are skipped."}/>}</p></div></div>
            <form className="admin-account-form" onSubmit={sendBroadcast}>
              <label className="input-label">{<LocalizedText text={"Title"}/>}</label>
              <input className="text-input" placeholder={translateUI("e.g. Scheduled maintenance tonight")} value={broadcastForm.title} onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })} maxLength={120}/>
              <label className="input-label">{<LocalizedText text={"Message"}/>}</label>
              <textarea className="text-input" rows={5} placeholder={translateUI("Write the announcement body here...")} value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} maxLength={2000}/>
              <button className="primary-btn full-btn" disabled={broadcastSending || !broadcastForm.title.trim() || !broadcastForm.message.trim()}>{broadcastSending ? translateUI("Sending...") : translateUI("Send to all users")}</button>
              {broadcastResult && <p style={{ color: "var(--green)", fontSize: 13, marginTop: 4 }}>{<LocalizedText text={"Sent to"}/>} {broadcastResult} {<LocalizedText text={"user"}/>}{broadcastResult === 1 ? "" : translateUI("s")}{<LocalizedText text={"."}/>}</p>}
            </form>
          </section>
        </section>}
      </main>
    </div>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`}><span>{toast.error ? <X size={17}/> : <Check size={17}/>}</span><LocalizedText text={toast.text}/><button onClick={() => setToast(null)}><X size={15}/></button></div>}
  </div>;
}

function SectionHeadSimple({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="section-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>;
}
