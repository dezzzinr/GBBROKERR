"use client";

import { LocalizedText, useLanguage, readStoredLanguage } from "@/components/i18n-provider";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, BellRing, Bot, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Copy, CreditCard, Download, Eye, EyeOff, FileText, Gift, Globe, Hourglass, History, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, MoreHorizontal, Paperclip, Plus, RefreshCw, Search, ShieldCheck, Signal, SlidersHorizontal, Sparkles, Star, Moon, Sun, Target, Trash2, TrendingDown, TrendingUp, UploadCloud, UserRound, UsersRound, Wallet, WandSparkles, X, XCircle, Zap } from "lucide-react";
import { assets as catalogAssets, getAsset as getCatalogAsset, type Asset } from "@/lib/market";
import { formatMoney, formatMarketPrice, formatUsdAmount, formatInCurrency, currencySymbol } from "@/lib/currency";
import { DEPOSIT_METHODS, MAX_RECEIPT_BYTES, type DepositMethod } from "@/lib/deposits";
import { WITHDRAWAL_METHODS, type WithdrawalMethod } from "@/lib/withdrawals";
import { ORDER_TYPES, LEVERAGE_OPTIONS, MIN_MARGIN, DURATION_PRESETS, DURATION_UNITS, MIN_DURATION_MINUTES, minutesPerUnit, formatDurationMinutes, allowedOrderTypesForSide, liquidationPrice, orderTypeLabel, positionPnl, closeReasonLabel, type OrderType, type PositionSide, type DurationUnitId } from "@/lib/trading";
import RegisterModal from "@/components/register-modal";
import ForgotPasswordModal from "@/components/forgot-password-modal";
import ProfilePage from "@/components/profile-page";
import { LANGUAGES, isLanguageCode, type LanguageCode } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv";
import { AVATAR_COLORS } from "@/lib/copy-trading";
import { flagEmoji, countryInfo } from "@/lib/countries";
import { ConfirmProvider, useConfirm } from "@/components/confirm-provider";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { notificationVisual, timeAgo } from "@/lib/notification-visual";

type Page = "Overview" | "Portfolio" | "Trade" | "Trading Bot" | "Markets" | "Plans" | "Copy Trading" | "Deposit" | "Withdraw" | "Trading Signals" | "Transactions" | "Trade History" | "Notifications" | "Profile";
function deferEffect(task: () => void | (() => void)) {
  let cleanup: void | (() => void);
  const timer = window.setTimeout(() => { cleanup = task(); }, 0);
  return () => { window.clearTimeout(timer); cleanup?.(); };
}
const PAGE_VALUES: Page[] = ["Overview", "Portfolio", "Trading Bot", "Deposit", "Withdraw", "Transactions", "Trade History", "Notifications", "Profile"];
const LAST_PAGE_KEY = "nexa_last_page";
type DepositAccount = { id: string; method: string; label: string; instructions: string };
type DepositRequest = { id: string; method: string; amount: string; destinationLabel: string | null; reference: string | null; note: string | null; status: string; adminNote: string | null; receiptFilename: string; createdAt: string; reviewedAt: string | null };
type WithdrawalRequest = { id: string; method: string; methodLabel: string | null; amount: string; destination: string; note: string | null; status: string; adminNote: string | null; createdAt: string; reviewedAt: string | null };

function FundingMethodIcon({ method, size = 18 }: { method: string; size?: number }) {
  const Icon = method === "crypto" ? Wallet : method === "bank_transfer" ? CreditCard : method === "paypal" ? ArrowLeftRight : method === "cashapp" ? Activity : method === "giftcard" ? Sparkles : SlidersHorizontal;
  return <Icon size={size} aria-hidden="true"/>;
}
type Notification = { id: string; type?: string; title: string; message: string; readAt: string | null; createdAt: string; aboutUserId?: string | null };
type AppData = { user: { id: string; name: string; email: string | null; username?: string | null; isDemo: boolean; role: string; emailVerified: boolean; cashBalance: number; profitBalance: number; targetBalance: number; targetProgressPercent: number; signalStrength: number; accountStatus: string; maxTradeAmount: number | null; withdrawalsBlocked: boolean; statusReason: string | null; profilePhoto?: string | null; currency?: string; language?: string }; holdings: { id: string; symbol: string; quantity: string; avgPrice: string }[]; activeTradeValue: number; trades: { id: string; symbol: string; side: string; quantity: string; price: string; total: string; createdAt: string; placedBy: string | null; adminNote: string | null }[]; transactions: { id: string; type: string; amount: string; description: string; createdAt: string }[]; plan: string | null; planExpiresAt: string | null; planAmount: number | null; notifications: Notification[]; unreadNotifications: number; fx?: { currency: string; rate: number; status: string; updatedAt: string | null } };
type CopyTrader = { id: string; name: string; handle: string; avatarInitials: string; avatarColor: string; focus: string; bio: string; riskLevel: string; returnPercent: string; winRate: string; subscriptionAmount: string; subscriptionDurationDays: number; rating: string; country: string; photoUrl: string | null; activeSubscribers: number; mySubscription: { expiresAt: string; amount: string } | null };
type CopySubscription = { id: string; traderId: string; traderName: string; traderHandle: string; amount: string; startedAt: string; expiresAt: string };
type TradingBot = { id: string; name: string; description: string; strategy: string; riskLevel: string; minAllocation: string; maxAllocation: string; features: string[]; subscriptionAmount: string; subscriptionDurationDays: number; rating: string; country: string; photoUrl: string | null; subscriberCount: number; mySubscription: { expiresAt: string | null; startedAt: string; amount: string; purchaseCount: number } | null };
type BotSubscription = { id: string; botProductId: string; botName: string; amount: string; startedAt: string; expiresAt: string | null };
type Plan = { id: string; name: string; description: string; priceWeekly: string; features: string[]; isFeatured: boolean; activeSubscribers: number; mySubscription: { expiresAt: string; amount: string; isCurrent: boolean } | null };
type PlanSubscription = { id: string; planId: string; planName: string; amount: string; startedAt: string; expiresAt: string };
type Order = { id: string; symbol: string; side: "buy" | "sell"; type: OrderType; quantity: string; triggerPrice: string; status: string; filledPrice: string | null; filledAt: string | null; cancelledAt: string | null; expiresAt: string | null; createdAt: string };
type Position = { id: string; symbol: string; side: PositionSide; leverage: string; margin: string; quantity: string; entryPrice: string; liquidationPrice: string; takeProfitPrice: string | null; stopLossPrice: string | null; status: string; closePrice: string | null; closeReason: string | null; realizedPnl: string | null; expiresAt: string | null; createdAt: string; closedAt: string | null; currentPrice?: number; unrealizedPnl?: number };
const preview: AppData = {
  user: { id: "", name: "Account", email: null, username: null, isDemo: false, role: "user", emailVerified: true, cashBalance: 0, profitBalance: 0, targetBalance: 0, targetProgressPercent: 0, signalStrength: 0, accountStatus: "active", maxTradeAmount: null, withdrawalsBlocked: false, statusReason: null, profilePhoto: null, currency: "USD" },
  holdings: [],
  trades: [],
  activeTradeValue: 0, transactions: [], plan: null, planExpiresAt: null, planAmount: null, notifications: [], unreadNotifications: 0, fx: { currency: "USD", rate: 1, status: "live", updatedAt: null }
};
const navGroups: { label: string; items: { name: Page; icon: typeof LayoutDashboard }[] }[] = [
  { label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Portfolio", icon: Wallet }] },
  { label: "GROW YOUR WEALTH", items: [{ name: "Trading Bot", icon: Bot }] },
  { label: "ACCOUNT", items: [{ name: "Profile", icon: UserRound }, { name: "Deposit", icon: ArrowDownLeft }, { name: "Withdraw", icon: ArrowUpRight }, { name: "Transactions", icon: CreditCard }, { name: "Trade History", icon: History }, { name: "Notifications", icon: Bell }] },
];
const fmtQty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 8 });
function supportBadge(trade: AppData["trades"][number]) {
  return trade.placedBy ? <span className="placed-by-support-badge"> <UserRound size={11}/> Admin</span> : null;
}
function AssetIcon({ asset, size = 38 }: { asset: Asset; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <span className="asset-icon" style={{ width: size, height: size, background: asset.image && !imageFailed ? "transparent" : asset.color, fontSize: size * .52 }}>
    {asset.image && !imageFailed ? <img src={asset.image} alt={`${asset.name} logo`} width={size} height={size} loading="lazy" onError={() => setImageFailed(true)}/> : asset.mark}
  </span>;
}
function PageTitle({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: React.ReactNode }) {
  const { t: translateUI } = useLanguage(); return <div className="page-heading"><div><div className="eyebrow">{eyebrow || translateUI("YOUR WORKSPACE")}</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>; }
function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) { return <div className="section-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Bot; title: string; text: string }) { return <div className="empty-state"><span className="empty-icon"><Icon size={27}/></span><h3>{title}</h3><p>{text}</p></div>; }

export default function HomePage() {
  return <ThemeProvider><ConfirmProvider><HomePageInner /></ConfirmProvider></ThemeProvider>;
}

function HomePageInner() {
  const { t: translateUI } = useLanguage();
  const [renderNow, setRenderNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setRenderNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const { t, language, setLanguage, translating } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const confirm = useConfirm();
  const [data, setData] = useState<AppData>(preview);
  // Every balance/price/P&L figure users see is converted to their chosen
  // display currency here; the ledger underneath (data.user.cashBalance,
  // trades, transactions, etc.) always stays USD. This shadows the plain
  // USD money()/marketPrice() helpers imported above so the rest of this
  // file's ~60 call sites automatically render in the user's currency.
  const currency = data.fx?.currency ?? data.user.currency ?? "USD";
  const fxRate = data.fx?.rate ?? 1;
  const money = (value: number, digits = 2) => formatMoney(value, currency, fxRate, digits);
  const marketPrice = (value: number) => formatMarketPrice(value, currency, fxRate);
  // For thresholds defined in USD (minimum margin, minimum order value): shows
  // the USD figure, plus its converted equivalent so it lines up with
  // everything else on screen.
  const usdAmount = (value: number, digits = 2) => formatUsdAmount(value, currency, fxRate, digits);

  // --- Typing in your own currency -------------------------------------
  // Amount and price fields are entered in the user's display currency - the
  // same one every balance, chart and price on the page already uses - and the
  // API route converts to the USD ledger authoritatively. These helpers only
  // drive labels, placeholders and the "≈ $X" preview; they never decide
  // what gets stored, and the server re-does every conversion itself.
  const inputSymbol = currencySymbol(currency);
  // False when the provider has no usable rate for this currency. Amounts must
  // not be typed in it then: the server would (correctly) refuse the request,
  // because guessing a rate would mis-state real money.
  const fxUsable = currency === "USD" || data.fx?.status === "live" || data.fx?.status === "stale";
  // The USD value of a figure typed into a field. Previews and confirm dialogs
  // use this so they agree with what the server will store.
  const usdOf = (typed: string | number) => {
    const value = Number(typed);
    if (!Number.isFinite(value)) return 0;
    return currency === "USD" ? value : value / fxRate;
  };
  // Echoes exactly what's in the field, in the user's currency and with no
  // conversion - so a confirm dialog never shows a number that drifts from the
  // one still on screen.
  const typedMoney = (typed: string | number) => formatInCurrency(Number(typed) || 0, currency);
  // "≈ $1,000.00 USD" - what the typed figure will be stored as. Preview only,
  // and pointless (so suppressed) when they're already typing in USD.
  const usdPreview = (typed: string) => {
    const value = Number(typed);
    if (currency === "USD" || !fxUsable || !Number.isFinite(value) || value <= 0) return null;
    return `≈ ${formatMoney(value / fxRate, "USD", 1)} USD`;
  };
  // The hint line under an amount field: normally the USD equivalent of what's
  // typed, but when the provider has no usable rate for this currency it warns
  // instead - the server would refuse the request, so the user should know
  // before they press the button rather than after.
  const amountHint = (typed: string) => {
    const preview = usdPreview(typed);
    if (preview) return <p className="form-hint">{preview}</p>;
    if (!fxUsable && Number(typed) > 0) return <p className="form-hint" style={{ color: "var(--tint-red-fg)", display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={13}/> {<LocalizedText text={"Rates for"}/>} {currency} {<LocalizedText text={"are unavailable, so this can't be converted yet. Switch your display currency to USD to continue."}/>}</p>;
    return null;
  };
  // A USD constant (a minimum, a live market price) expressed as a plain number
  // in the user's currency - for input placeholders and HTML min attributes,
  // where a formatted symbol string wouldn't be valid.
  const inMyCurrency = (usdValue: number, decimals = 2) => String(Number((usdValue * (currency === "USD" ? 1 : fxRate)).toFixed(decimals)));
  // Remember which tab the user was on across browser refreshes - previously
  // every reload silently dumped everyone back to Overview, which felt like
  // the whole app "started over" even though their data was untouched.
  // The initial state must stay "Overview" (matching what the server
  // renders, since localStorage isn't available during SSR) so hydration
  // doesn't mismatch; the saved tab is adopted a moment later, client-side
  // only, in the effect below.
  const [page, setPage] = useState<Page>("Overview");
  useEffect(() => {
    // Wrapped in an inner function so the setState call below isn't a direct
    // child of the effect body - functionally identical, just keeps the
    // stricter React Compiler lint rule happy the same way the rest of this
    // one-time "adopt a saved preference" pattern does elsewhere in the app.
    (() => {
      try {
        const saved = window.localStorage.getItem(LAST_PAGE_KEY);
        if (saved && (PAGE_VALUES as string[]).includes(saved)) setPage(saved as Page);
      } catch { /* ignore quota/availability errors */ }
    })();
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(LAST_PAGE_KEY, page); } catch { /* ignore quota/availability errors */ }
  }, [page]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profitTransferBusy, setProfitTransferBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  // --- Notifications page (full history, paginated) ---
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifOffset, setNotifOffset] = useState(0);
  const [notifTypeFilter, setNotifTypeFilter] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);
  const NOTIF_PAGE_SIZE = 20;

  // --- Watchlist ---
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState<string | null>(null);

  // --- Price alerts ---
  type PriceAlertRow = { id: string; symbol: string; direction: "above" | "below"; targetPrice: string; status: string; createdAt: string; triggeredAt: string | null };
  const [priceAlerts, setPriceAlerts] = useState<{ open: PriceAlertRow[]; history: PriceAlertRow[] }>({ open: [], history: [] });
  const [priceAlertsLoaded, setPriceAlertsLoaded] = useState(false);
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");
  const [alertTargetPrice, setAlertTargetPrice] = useState("");
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [cancellingAlertId, setCancellingAlertId] = useState<string | null>(null);

  // --- Trade History / Transactions filters ---
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState(""); // shared symbol search box across the Trades/Orders/Positions tabs on Trade History
  const changeLanguage = async (code: LanguageCode) => {
    setLanguage(code);
    setLanguageMenuOpen(false);
    if (!data.user.isDemo) {
      try {
        await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateProfile", language: code }) });
      } catch { /* non-critical: the local choice still applies immediately */ }
    }
  };
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  // Email-verification gate: a freshly registered account is signed in
  // immediately but sees a full-screen "enter your code" gate (rendered
  // further below) instead of the dashboard until data.user.emailVerified.
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);
  const verifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verifyEmail", code: verifyCode }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Incorrect code. Please try again.");
      setVerifyCode("");
      await refresh();
      notify("Email verified - welcome to Tetratrades!");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Something went wrong. Please try again.", true);
    } finally {
      setVerifying(false);
    }
  };
  const resendCode = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resendVerificationCode" }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Could not resend the code.");
      setResendCooldown(60);
      notify(result.message || "A new code has been sent to your email.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Something went wrong. Please try again.", true);
    } finally {
      setResending(false);
    }
  };
  // Demo/guest accounts can look around freely, but any action that would
  // actually create a lasting record (trade, deposit, withdrawal,
  // subscription) prompts sign-up instead of silently going through - this
  // is the client-side half of the gate; src/lib/accounts.ts enforces the
  // same rule server-side so it can't be bypassed.
  const [demoGateOpen, setDemoGateOpen] = useState(false);
  const requireRealAccount = (): boolean => {
    if (!ready) { notify("Your account is still refreshing. Please try again in a moment.", true); return false; }
    if (data.user.isDemo) { setDemoGateOpen(true); return false; }
    return true;
  };
  // Time-based nudge: a demo visitor who just browses (never hits one of the
  // action gates above) still sees the sign-up prompt once after a couple of
  // minutes, rather than being able to explore in demo mode indefinitely
  // without ever being invited to create an account.
  useEffect(() => {
    if (!ready || !data.user.isDemo) return;
    const timer = window.setTimeout(() => setDemoGateOpen(true), 2 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [ready, data.user.isDemo]);
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("crypto");
  const [depositAccounts, setDepositAccounts] = useState<DepositAccount[]>([]);
  const [depositAccountsLoaded, setDepositAccountsLoaded] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [myDeposits, setMyDeposits] = useState<DepositRequest[]>([]);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>("crypto");
  const [withdrawalMethodLabelInput, setWithdrawalMethodLabelInput] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalDestination, setWithdrawalDestination] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [botAmount, setBotAmount] = useState("500");
  const [botStrategy, setBotStrategy] = useState("DCA");
  const [botSymbol, setBotSymbol] = useState("BTC");
  const [copyTraders, setCopyTraders] = useState<CopyTrader[]>([]);
  const [copyTradersLoaded, setCopyTradersLoaded] = useState(false);
  const [mySubscriptions, setMySubscriptions] = useState<CopySubscription[]>([]);
  const [subscribingId, setSubscribingId] = useState("");
  const [tradingBots, setTradingBots] = useState<TradingBot[]>([]);
  const [tradingBotsLoaded, setTradingBotsLoaded] = useState(false);
  const [botSubHistory, setBotSubHistory] = useState<BotSubscription[]>([]);
  const [botSubscribingId, setBotSubscribingId] = useState("");
  const [botPlanAmounts, setBotPlanAmounts] = useState<Record<string, string>>({});
  const [plansCatalog, setPlansCatalog] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [planSubHistory, setPlanSubHistory] = useState<PlanSubscription[]>([]);
  const [planSubscribingId, setPlanSubscribingId] = useState("");
  const [historyTab, setHistoryTab] = useState("All");
  const [historySection, setHistorySection] = useState<"Trades" | "Orders" | "Positions">("Trades");
  const [tradeMode, setTradeMode] = useState<"Spot" | "Margin">("Spot");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderDurationOn, setOrderDurationOn] = useState(false);
  const [orderDurationAmount, setOrderDurationAmount] = useState("15");
  const [orderDurationUnit, setOrderDurationUnit] = useState<DurationUnitId>("minutes");
  const [myOrders, setMyOrders] = useState<{ open: Order[]; history: Order[] }>({ open: [], history: [] });
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [leverageX, setLeverageX] = useState<number>(10);
  const [marginAmount, setMarginAmount] = useState("");
  const [positionTP, setPositionTP] = useState("");
  const [positionSL, setPositionSL] = useState("");
  const [positionDurationOn, setPositionDurationOn] = useState(false);
  const [positionDurationAmount, setPositionDurationAmount] = useState("1");
  const [positionDurationUnit, setPositionDurationUnit] = useState<DurationUnitId>("hours");
  const [myPositions, setMyPositions] = useState<{ open: Position[]; history: Position[] }>({ open: [], history: [] });
  const [positionsLoaded, setPositionsLoaded] = useState(false);
  const [openingPosition, setOpeningPosition] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState("");

  const notify = (text: string, error = false) => { setToast({ text: translateUI(text), error }); setTimeout(() => setToast(null), 4500); };
  const copyDestination = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Destination details copied");
    } catch {
      notify("Could not copy destination details. Please select and copy them manually.", true);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/app", { cache: "no-store" });
      if (response.status === 403) {
        const result = await response.json().catch(() => ({}));
        if (result.locked) { notify(result.error || "This account has been locked.", true); return void refresh(); }
      }
      if (response.status === 401) { window.location.replace("/sign-in"); return; }
      if (!response.ok) throw new Error("Could not load your account");
      setData(await response.json());
      setReady(true);
    } catch { notify("Could not connect to your workspace. Please refresh.", true); }
    finally { setRefreshing(false); }
  };
  useEffect(() => { void refresh(); }, []);
  // A signed-in user's saved language preference (set from their Profile
  // page or this selector on another device) is adopted once, but only if
  // this browser doesn't already have its own explicit local choice -
  // language is never auto-detected, only ever remembered from a past
  // manual pick (here or on the profile page).
  useEffect(() => {
    if (data.user.language && isLanguageCode(data.user.language) && !readStoredLanguage()) {
      setLanguage(data.user.language as LanguageCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.user.language]);
  const loadMyOrders = async () => { try { const res = await fetch("/api/orders", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); setMyOrders({ open: result.open ?? [], history: result.history ?? [] }); } catch { /* ignore */ } finally { setOrdersLoaded(true); } };
  const loadMyPositions = async () => { try { const res = await fetch("/api/positions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); setMyPositions({ open: result.open ?? [], history: result.history ?? [] }); } catch { /* ignore */ } finally { setPositionsLoaded(true); } };
  useEffect(() => ready && page === "Trade" ? deferEffect(() => { void loadMyOrders(); void loadMyPositions(); }) : undefined, [ready, page]);
  const loadMyDeposits = async () => { try { const res = await fetch("/api/deposits", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.requests)) setMyDeposits(result.requests); } catch { /* ignore */ } };
  useEffect(() => {
    if (!ready || page !== "Deposit") return;
    return deferEffect(() => {
    void loadMyDeposits();
    if (!depositAccountsLoaded) fetch("/api/deposit-accounts", { cache: "no-store" }).then(r => r.json()).then(result => { if (Array.isArray(result.accounts)) setDepositAccounts(result.accounts); setDepositAccountsLoaded(true); }).catch(() => setDepositAccountsLoaded(true));
    });
  }, [ready, page, depositAccountsLoaded]);
  const methodAccounts = depositAccounts.filter(a => a.method === depositMethod);
  const selectedDepositAccountId = methodAccounts.some(account => account.id === depositAccountId)
    ? depositAccountId
    : methodAccounts[0]?.id ?? "";
  const handleReceiptFile = (file: File | null) => {
    setReceiptError("");
    if (!file) { setReceiptFile(null); return; }
    const okType = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"].includes(file.type);
    if (!okType) { setReceiptError("Upload a JPG, PNG, WEBP, HEIC, or PDF file."); setReceiptFile(null); return; }
    if (file.size > MAX_RECEIPT_BYTES) { setReceiptError(`File is too large. Max size is ${(MAX_RECEIPT_BYTES / (1024 * 1024)).toFixed(0)}MB.`); setReceiptFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setReceiptFile({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.onerror = () => setReceiptError("Could not read that file. Please try again.");
    reader.readAsDataURL(file);
  };
  const submitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRealAccount()) return;
    if (depositSubmitting) return;
    if (methodAccounts.length && !selectedDepositAccountId) return notify("Select a destination account.", true);
    if (!receiptFile) return notify("Attach a receipt or screenshot of your payment.", true);
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return notify("Enter a valid deposit amount.", true);
    if (!(await confirm({ title: "Submit this deposit request?", message: `We'll review your ${typedMoney(depositAmount)} deposit and credit it to your balance once your payment is verified.`, confirmLabel: "Submit request" }))) return;
    setDepositSubmitting(true);
    try {
      const res = await fetch("/api/deposits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: depositMethod, amount, currency, depositAccountId: selectedDepositAccountId || null, reference: depositReference, note: depositNote, receipt: receiptFile.dataUrl, receiptFilename: receiptFile.name }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Deposit request submitted");
      setDepositAmount(""); setDepositReference(""); setDepositNote(""); setReceiptFile(null);
      await loadMyDeposits();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setDepositSubmitting(false); }
  };
  const action = async (body: Record<string, unknown>) => { if (loading) return false; setLoading(true); try { const res = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await res.json(); if (!res.ok) throw new Error(result.error || "Something went wrong"); notify(result.message || "Done successfully"); await refresh(); return true; } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); return false; } finally { setLoading(false); } };
  const authenticate = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); try { const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier: authIdentifier, password: authPassword }) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); setAuthMode(null); setAuthPassword(""); setAuthIdentifier(""); setPage("Overview"); await refresh(); notify("Welcome back!"); } catch (error) { notify(error instanceof Error ? error.message : "Authentication failed", true); } finally { setLoading(false); } };
  const handleRegistered = async () => { setAuthMode(null); setPage("Overview"); await refresh(); notify("Welcome to Tetratrades! Your account is ready."); };
  const logout = async () => { if (!(await confirm({ title: "Sign out?" }))) return; await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); setProfileOpen(false); window.location.replace("/sign-in"); };
  const toggleNotifications = () => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    setProfileOpen(false);
    if (opening && data.unreadNotifications > 0) { fetch("/api/notifications", { method: "POST" }).then(() => refresh()).catch(() => {}); }
  };
  const go = (p: Page) => { if (p === "Trade" || p === "Markets" || p === "Copy Trading" || p === "Plans") return; setPage(p); setMobileMenu(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const assets: Asset[] = catalogAssets;
  const getAsset = (ticker: string) => assets.find(a => a.symbol === ticker) ?? getCatalogAsset(ticker);
  const hasQuotes = false;
  const quoteLive = false;
  const currentAsset = getAsset(symbol)!;
  const holdingsCostBasis = data.holdings.reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgPrice), 0);
  const portfolioValue = data.activeTradeValue;
  const totalBalance = holdingsCostBasis + portfolioValue + data.user.cashBalance + data.user.profitBalance;
  const latestSubscribedBot = tradingBots.filter(bot => bot.mySubscription).sort((a, b) => Date.parse(b.mySubscription!.startedAt) - Date.parse(a.mySubscription!.startedAt))[0];
  const activeBotSummary = !tradingBotsLoaded ? "Loading subscribed bot…" : latestSubscribedBot ? `Current bot: ${latestSubscribedBot.name}` : "No active bot subscription";
  const firstName = data.user.name.split(" ")[0];
  const date = useMemo(() => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()), []);
  const placeSpotOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRealAccount()) return;
    const orderDurationMinutes = computeDurationMinutes(orderDurationOn, orderDurationAmount, orderDurationUnit);
    if (orderType === "market") {
      if (!quoteLive || currentAsset.price <= 0) return notify("Live quotes are unavailable. Live trading is paused.", true);
      // tradeAmount is typed in the user's own currency; the server converts
      // it to the USD ledger and derives the quantity from its own live price.
      const typed = Number(tradeAmount);
      if (!typed || typed <= 0) return notify("Enter a valid amount", true);
      // A market order with a duration set doesn't land in holdings - it
      // opens as a 1x (no leverage amplification) position instead, which
      // automatically closes and realizes P&L once the timer is up, just
      // like a leveraged position's duration expiry.
      if (orderDurationMinutes) {
        if (loading) return;
        if (!(await confirm({ title: `${side === "buy" ? "Buy" : "Sell"} ${symbol} for ${formatDurationMinutes(orderDurationMinutes)}?`, message: `This opens a timed ${side === "buy" ? "long" : "short"} trade on ${symbol} with ${typedMoney(tradeAmount)} at the live market price. It automatically closes and realizes your profit/loss after ${formatDurationMinutes(orderDurationMinutes)}, unless you close it sooner.`, confirmLabel: side === "buy" ? "Buy now" : "Sell now" }))) return;
        setLoading(true);
        try {
          const res = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, side: side === "buy" ? "long" : "short", leverage: 1, margin: typed, currency, durationMinutes: orderDurationMinutes }) });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Something went wrong");
          notify(result.message || "Trade opened");
          setTradeAmount("");
          await Promise.all([loadMyPositions(), refresh()]);
        } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setLoading(false); }
        return;
      }
      const quantity = Math.floor((usdOf(tradeAmount) / currentAsset.price) * 1e8) / 1e8;
      if (!quantity) return notify("Amount is too small for this asset", true);
      if (!(await confirm({ title: `${side === "buy" ? "Buy" : "Sell"} ${symbol}?`, message: `This will ${side} about ${quantity} ${symbol} (~${typedMoney(tradeAmount)}) at the live market price.`, confirmLabel: side === "buy" ? "Buy now" : "Sell now" }))) return;
      const ok = await action({ action: "trade", symbol, side, amount: typed, currency });
      if (ok) { setTradeAmount(""); ; void loadMyOrders(); }
      return;
    }
    if (!quoteLive) return notify("Live quotes are unavailable. Live trading is paused.", true);
    // Both the trigger price and the amount are typed in the user's currency.
    // The quantity below is a preview only - the server converts both values
    // and derives the real order size itself.
    const price = Number(orderPrice);
    if (!price || price <= 0) return notify("Enter a valid price.", true);
    const typed = Number(tradeAmount);
    if (!typed || typed <= 0) return notify("Enter a valid amount", true);
    const quantity = Math.floor((usdOf(tradeAmount) / usdOf(orderPrice)) * 1e8) / 1e8;
    if (!quantity) return notify("Amount is too small for this asset", true);
    if (loading) return;
    if (!(await confirm({ title: `Place ${orderTypeLabel(orderType)} order?`, message: `${side === "buy" ? "Buy" : "Sell"} about ${quantity} ${symbol} (~${typedMoney(tradeAmount)}) when the price reaches ${marketPrice(usdOf(price))}. You can cancel it anytime before it fills.`, confirmLabel: "Place order" }))) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, side, type: orderType, amount: typed, currency, triggerPrice: price, durationMinutes: orderDurationMinutes }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Order placed");
      setTradeAmount(""); setOrderPrice("");
      await Promise.all([loadMyOrders(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setLoading(false); }
  };
  const cancelOrder = async (id: string) => {
    if (cancellingOrderId) return;
    if (!(await confirm({ title: "Cancel this order?", message: "This pending order will be removed and won't fill. This can't be undone." }))) return;
    setCancellingOrderId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Order cancelled");
      await loadMyOrders();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCancellingOrderId(""); }
  };
  const openPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRealAccount()) return;
    if (!quoteLive) return notify("Live quotes are unavailable. Live trading is paused.", true);
    const margin = Number(marginAmount);
    // MIN_MARGIN is a USD floor; the field holds the user's currency.
    if (!margin || usdOf(margin) < MIN_MARGIN) return notify(`Enter a margin amount of at least ${usdAmount(MIN_MARGIN)}.`, true);
    if (openingPosition) return;
    if (!(await confirm({ title: `Open ${leverageX}x ${positionSide} position?`, message: `Posting ${typedMoney(marginAmount)} margin on ${symbol} at ${leverageX}x leverage. You can lose up to your full margin if the price moves against you, including automatic liquidation.`, confirmLabel: "Open position", danger: leverageX >= 20 }))) return;
    setOpeningPosition(true);
    try {
      const res = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, side: positionSide, leverage: leverageX, margin, currency, takeProfitPrice: positionTP || null, stopLossPrice: positionSL || null, durationMinutes: computeDurationMinutes(positionDurationOn, positionDurationAmount, positionDurationUnit) }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Position opened");
      setMarginAmount(""); setPositionTP(""); setPositionSL("");
      await Promise.all([loadMyPositions(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setOpeningPosition(false); }
  };
  const quickTrade = async (e: React.FormEvent) => { e.preventDefault(); if (!requireRealAccount()) return; if (!quoteLive || currentAsset.price <= 0) return notify("Live quotes are unavailable. Live trading is paused.", true); const typed = Number(tradeAmount); if (!typed || typed <= 0) return notify("Enter a valid amount", true); const quantity = Math.floor((usdOf(tradeAmount) / currentAsset.price) * 1e8) / 1e8; if (!quantity) return notify("Amount is too small for this asset", true); if (!(await confirm({ title: `${side === "buy" ? "Buy" : "Sell"} ${symbol}?`, message: `This will ${side} about ${quantity} ${symbol} (~${typedMoney(tradeAmount)}) at the live market price.`, confirmLabel: side === "buy" ? "Buy now" : "Sell now" }))) return; const ok = await action({ action: "trade", symbol, side, amount: typed, currency }); if (ok) { setTradeAmount(""); ; } };
  const closePosition = async (id: string) => {
    if (closingPositionId) return;
    if (!(await confirm({ title: "Close this position?", message: "This realizes its current profit or loss immediately and returns remaining margin to your capital." }))) return;
    setClosingPositionId(id);
    try {
      const res = await fetch(`/api/positions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Position closed");
      await Promise.all([loadMyPositions(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setClosingPositionId(""); }
  };
  const loadMyWithdrawals = async () => { try { const res = await fetch("/api/withdrawals", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.requests)) setMyWithdrawals(result.requests); } catch { /* ignore */ } };
  useEffect(() => ready && page === "Withdraw" ? deferEffect(() => { void loadMyWithdrawals(); }) : undefined, [ready, page]);

  // --- Watchlist ---
  const loadWatchlist = async () => { try { const res = await fetch("/api/watchlist", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.symbols)) setWatchlist(result.symbols); } catch { /* ignore */ } finally { setWatchlistLoaded(true); } };
  // Live market features (including the watchlist) have been removed.
  const toggleWatchlist = async (sym: string) => {
    if (!requireRealAccount()) return;
    if (watchlistBusy) return;
    const starred = watchlist.includes(sym);
    if (!(await confirm({ title: starred ? `Remove ${sym} from your watchlist?` : `Add ${sym} to your watchlist?` }))) return;
    setWatchlistBusy(sym);
    try {
      if (starred) {
        await fetch(`/api/watchlist?symbol=${encodeURIComponent(sym)}`, { method: "DELETE" });
        setWatchlist((w) => w.filter((s) => s !== sym));
      } else {
        await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym }) });
        setWatchlist((w) => [...w, sym]);
      }
    } catch { notify("Something went wrong", true); } finally { setWatchlistBusy(null); }
  };

  // --- Price alerts ---
  const loadPriceAlerts = async () => { try { const res = await fetch("/api/price-alerts", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); setPriceAlerts({ open: result.open ?? [], history: result.history ?? [] }); } catch { /* ignore */ } finally { setPriceAlertsLoaded(true); } };
  useEffect(() => ready && page === "Trade" ? deferEffect(() => { void loadPriceAlerts(); }) : undefined, [ready, page]);
  const createPriceAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRealAccount()) return;
    const target = Number(alertTargetPrice);
    if (!target || target <= 0) return notify("Enter a valid target price.", true);
    if (creatingAlert) return;
    if (!(await confirm({ title: "Create this price alert?", message: `We'll notify you the moment ${symbol} goes ${alertDirection} ${marketPrice(usdOf(target))}.`, confirmLabel: "Create alert" }))) return;
    setCreatingAlert(true);
    try {
      const res = await fetch("/api/price-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, direction: alertDirection, targetPrice: target, currency }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Price alert created");
      setAlertTargetPrice("");
      await loadPriceAlerts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCreatingAlert(false); }
  };
  const cancelPriceAlert = async (id: string) => {
    if (cancellingAlertId) return;
    if (!(await confirm({ title: "Cancel this price alert?" }))) return;
    setCancellingAlertId(id);
    try {
      const res = await fetch(`/api/price-alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadPriceAlerts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCancellingAlertId(null); }
  };

  // --- Full Notifications page ---
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
  useEffect(() => ready && page === "Notifications" ? deferEffect(() => { void loadAllNotifications(0, notifTypeFilter); if (data.unreadNotifications > 0) fetch("/api/notifications", { method: "POST" }).then(() => refresh()).catch(() => {}); }) : undefined, [ready, page]);
  const markOneNotificationRead = async (id: string) => {
    if (!(await confirm({ title: "Mark this notification as read?" }))) return;
    try { await fetch(`/api/notifications/${id}`, { method: "PATCH" }); } catch { /* ignore */ }
    setAllNotifications((rows) => rows.map((n) => n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
  };
  const markAllNotificationsRead = async () => {
    if (!(await confirm({ title: "Mark all notifications as read?" }))) return;
    await fetch("/api/notifications", { method: "POST" });
    refresh();
    loadAllNotifications(0, notifTypeFilter);
  };
  const loadCopyTraders = async () => { try { const res = await fetch("/api/copy-traders", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.traders)) setCopyTraders(result.traders); } catch { /* ignore */ } finally { setCopyTradersLoaded(true); } };
  const loadMySubscriptions = async () => { try { const res = await fetch("/api/copy-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setMySubscriptions(result.subscriptions); } catch { /* ignore */ } };
  useEffect(() => ready && page === "Copy Trading" ? deferEffect(() => { void loadCopyTraders(); void loadMySubscriptions(); }) : undefined, [ready, page]);
  const subscribeToTrader = async (trader: CopyTrader) => {
    if (!requireRealAccount()) return;
    if (subscribingId) return;
    if (!(await confirm({ title: `Subscribe to ${trader.name}?`, message: `${Number(trader.subscriptionAmount) > 0 ? `${money(Number(trader.subscriptionAmount))} will be charged from your capital for a` : "This starts a"} 7-day subscription.`, confirmLabel: "Subscribe" }))) return;
    setSubscribingId(trader.id);
    try {
      const res = await fetch("/api/copy-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traderId: trader.id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `Subscribed to ${trader.name}`);
      await Promise.all([loadCopyTraders(), loadMySubscriptions(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setSubscribingId(""); }
  };
  const daysLeft = (expiresAt: string) => renderNow === null ? 0 : Math.max(0, Math.ceil((new Date(expiresAt).getTime() - renderNow) / 86400000));
  // Finer-grained "time remaining" for order/position durations, which can
  // be as short as 15 minutes - daysLeft() above would round everything
  // under a day down to "0 days left".
  const timeLeftLabel = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return "No expiry";
    if (renderNow === null) return "—";
    const ms = new Date(expiresAt).getTime() - renderNow;
    if (ms <= 0) return "Expiring...";
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins}m left`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m left`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  };
  // Turns the custom-timer form state (on/off + amount + unit) into a raw
  // minute count to send to the server, or null for "no expiry". Clamps to
  // the 1-minute minimum so e.g. an empty/zero amount still counts as a
  // valid 1-minute timer rather than silently becoming "no expiry".
  const computeDurationMinutes = (on: boolean, amount: string, unit: DurationUnitId): number | null =>
    on ? Math.max(MIN_DURATION_MINUTES, Math.round((Number(amount) || 0) * minutesPerUnit(unit))) : null;
  const loadTradingBots = async () => { try { const res = await fetch("/api/bots", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.bots)) setTradingBots(result.bots); } catch { /* ignore */ } finally { setTradingBotsLoaded(true); } };
  const loadBotSubHistory = async () => { try { const res = await fetch("/api/bot-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setBotSubHistory(result.subscriptions); } catch { /* ignore */ } };
  useEffect(() => ready && page === "Trading Bot" ? deferEffect(() => { void loadTradingBots(); void loadBotSubHistory(); }) : undefined, [ready, page]);
  const subscribeToBot = async (bot: TradingBot) => {
    if (!requireRealAccount()) return;
    if (botSubscribingId) return;
    const enteredAmount = botPlanAmounts[bot.id] ?? "";
    const amount = Number(enteredAmount);
    const usdAmount = usdOf(enteredAmount);
    if (!amount || usdAmount < Number(bot.minAllocation) || usdAmount > Number(bot.maxAllocation)) return notify(`Choose an amount from ${money(Number(bot.minAllocation))} to ${money(Number(bot.maxAllocation))}.`, true);
    if (!(await confirm({ title: `Start ${bot.name}?`, message: `${typedMoney(enteredAmount)} will be charged from your capital. This plan does not expire.`, confirmLabel: "Start plan" }))) return;
    setBotSubscribingId(bot.id);
    try {
      const res = await fetch("/api/bot-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botProductId: bot.id, amount, currency }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `${bot.name} started`);
      await Promise.all([loadTradingBots(), loadBotSubHistory(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotSubscribingId(""); }
  };
  const loadPlans = async () => { try { const res = await fetch("/api/plans", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.plans)) setPlansCatalog(result.plans); } catch { /* ignore */ } finally { setPlansLoaded(true); } };
  const loadPlanSubHistory = async () => { try { const res = await fetch("/api/plan-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setPlanSubHistory(result.subscriptions); } catch { /* ignore */ } };
  useEffect(() => ready && page === "Plans" ? deferEffect(() => { void loadPlans(); void loadPlanSubHistory(); }) : undefined, [ready, page]);
  const subscribeToPlan = async (plan: Plan) => {
    if (!requireRealAccount()) return;
    if (planSubscribingId) return;
    if (!(await confirm({ title: `Switch to the ${plan.name} plan?`, message: `${Number(plan.priceWeekly) > 0 ? `${money(Number(plan.priceWeekly))} will be charged from your capital for a` : "This starts a"} 7-day subscription.`, confirmLabel: "Confirm" }))) return;
    setPlanSubscribingId(plan.id);
    try {
      const res = await fetch("/api/plan-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `Subscribed to the ${plan.name} plan for 7 days`);
      await Promise.all([loadPlans(), loadPlanSubHistory(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanSubscribingId(""); }
  };
  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRealAccount()) return;
    if (withdrawalSubmitting) return;
    if (data.user.profitBalance > 0) return notify("Move all profits to Capital before requesting a withdrawal.", true);
    const amount = Number(withdrawalAmount);
    if (!amount || amount <= 0) return notify("Enter a valid withdrawal amount.", true);
    // The field holds the user's own currency but cashBalance is the USD
    // ledger, so compare like with like - otherwise a NGN user was told they
    // could withdraw 1,331x their actual balance.
    if (usdOf(amount) > data.user.cashBalance) return notify("You can't request more than your available capital.", true);
    if (withdrawalDestination.trim().length < 3) return notify("Tell us where to send your payout.", true);
    if (withdrawalMethod === "other" && withdrawalMethodLabelInput.trim().length < 2) return notify("Tell us the name of the platform you'd like to be paid through.", true);
    if (!(await confirm({ title: "Submit this withdrawal request?", message: `${typedMoney(withdrawalAmount)} will be held from your available balance right away and paid out to the destination you provided once an admin reviews it.`, confirmLabel: "Submit request" }))) return;
    setWithdrawalSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: withdrawalMethod, methodLabel: withdrawalMethodLabelInput, amount, currency, destination: withdrawalDestination, note: withdrawalNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Withdrawal request submitted");
      setWithdrawalAmount(""); setWithdrawalDestination(""); setWithdrawalNote(""); setWithdrawalMethodLabelInput("");
      await Promise.all([loadMyWithdrawals(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setWithdrawalSubmitting(false); }
  };
  const transferProfitsToCapital = async () => {
    if (!requireRealAccount() || profitTransferBusy) return;
    if (data.user.profitBalance <= 0) return notify("There are no profits available to move to Capital.", true);
    if (!(await confirm({ title: "Move all profits to Capital?", message: `${money(data.user.profitBalance)} will be transferred from Profits to Capital. Profits must be moved to Capital before you can request a withdrawal.`, confirmLabel: "Move to Capital" }))) return;
    setProfitTransferBusy(true);
    try {
      const res = await fetch("/api/profits/transfer-to-capital", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to move profits to Capital.");
      notify(result.message || "Profits moved to Capital.");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to move profits to Capital.", true); } finally { setProfitTransferBusy(false); }
  };
  const tradeTable = (limit?: number) => <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Asset"}/>}</th><th>{<LocalizedText text={"Type"}/>}</th><th>{<LocalizedText text={"Amount"}/>}</th><th>{<LocalizedText text={"Price"}/>}</th><th>{<LocalizedText text={"Total"}/>}</th><th>{<LocalizedText text={"Date"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{data.trades.slice(0, limit).map(t => { const a = getAsset(t.symbol); return <tr key={t.id}><td><div className="coin-cell">{a && <AssetIcon asset={a} size={32}/>}<div><strong>{a?.name ?? t.symbol}</strong><span>{t.symbol}{supportBadge(t)}</span></div></div></td><td><span className={`type-pill ${t.side}`}>{t.side === "buy" ? <ArrowDownLeft size={13}/> : <ArrowUpRight size={13}/>} {t.side === "buy" ? translateUI("Buy") : translateUI("Sell")}</span></td><td className="table-strong">{fmtQty(Number(t.quantity))} {t.symbol}</td><td>{marketPrice(Number(t.price))}</td><td className="table-strong">{money(Number(t.total))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><span className="status-pill"><span/>{<LocalizedText text={"Completed"}/>}</span></td></tr>; })}</tbody></table>{data.trades.length === 0 && <EmptyState icon={History} title={translateUI("No trades yet")} text="Your completed trades will appear here."/>}</div>;
  const card = (icon: typeof Wallet, label: string, value: string, foot: React.ReactNode, tone = "blue", extraClass = "") => { const Icon = icon; return <div className={`stat-card ${extraClass}`}><div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={19}/></span><MoreHorizontal size={20} className="dots-icon"/></div><span className="stat-label">{label}</span><strong className="stat-value">{hideBalance ? "••••••" : value}</strong><div className="stat-foot">{foot}</div></div>; };

  // Full-screen gate: a signed-in-but-unverified user sees this instead of
  // the dashboard until they enter the 4-digit code emailed at signup.
  // Demo accounts and accounts with no email never hit this (see
  // needsEmailVerification server-side, mirrored here client-side).
  if (ready && !data.user.isDemo && data.user.email && !data.user.emailVerified) {
    return <div className="verify-shell">
      <div className="verify-card">
        <div className="modal-brand"><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div>{<LocalizedText text={"Tetra"}/>}<span>{<LocalizedText text={"Trades"}/>}</span></div>
        <div className="verify-icon"><Mail size={28}/></div>
        <h2>{<LocalizedText text={"Verify your email"}/>}</h2>
        <p>{<LocalizedText text={"We sent a 4-digit code to"}/>} <strong>{data.user.email}</strong>{<LocalizedText text={". Enter it below to unlock your account."}/>}</p>
        <form onSubmit={verifyEmailCode}>
          <input className="verify-code-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder={translateUI("0000")} value={verifyCode} onChange={e=>setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 4))} autoFocus required/>
          <button className="primary-btn full-btn" disabled={verifying || verifyCode.length !== 4}>{verifying ? translateUI("Verifying...") : translateUI("Verify email")}<ArrowRight size={17}/></button>
        </form>
        <div className="verify-resend">
          {resendCooldown > 0 ? <span>{<LocalizedText text={"Resend code in"}/>} {resendCooldown}{<LocalizedText text={"s"}/>}</span> : <button type="button" onClick={resendCode} disabled={resending}>{resending ? translateUI("Sending...") : translateUI("Resend code")}</button>}
        </div>
        <button type="button" className="modal-switch" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={logout}>{<LocalizedText text={"Wrong email? Log out"}/>}</button>
      </div>
    </div>;
  }

  return <div className="app-shell">
    {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}><div className="brand" onClick={() => go("Overview")}><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div><span>{<LocalizedText text={"Tetra"}/>}<span>{<LocalizedText text={"Trades"}/>}</span></span><button className="mobile-close" onClick={(e) => { e.stopPropagation(); setMobileMenu(false); }}><X size={19}/></button></div><div className="sidebar-body">{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{t(group.label)}</div>{group.items.map(item => { const Icon = item.icon; return <button key={item.name} className={`nav-item ${page === item.name ? "selected" : ""}`} onClick={() => go(item.name)}><Icon size={19} strokeWidth={page === item.name ? 2.25 : 1.8}/><span>{t(item.name)}</span>{item.name === "Trading Bot" && <span className="nav-new">{t("NEW")}</span>}</button>; })}</div>)}</div><div className="sidebar-bottom"><div className="help-card"><span className="help-bubble"><CircleHelp size={18}/></span><strong>{t("Need a hand?")}</strong><p>{t("Manage your account and activity securely.")}</p><button onClick={() => { go("Trading Bot"); }}>{t("Explore bots")} <ArrowRight size={14}/></button></div><div className="sidebar-footer"><ShieldCheck size={15}/> {t("Secure live trading platform")}</div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="icon-btn menu-btn" onClick={() => setMobileMenu(true)} aria-label={translateUI("Open menu")}><Menu size={22}/></button><div className="breadcrumb"><span className="breadcrumb-prefix">{t("Workspace")} <ChevronRight size={15}/></span> <strong>{t(page)}</strong></div></div><div className="topbar-right"><span className="topbar-divider"/><button className="theme-toggle" aria-label={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")} title={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")} onClick={toggleTheme}>{theme === "dark" ? <Sun size={19}/> : <Moon size={19}/>}</button><div className="notification-wrap"><button className="icon-btn notif-btn" aria-label={translateUI("Language")} title={translateUI("Language")} onClick={() => { setLanguageMenuOpen(!languageMenuOpen); setNotificationsOpen(false); setProfileOpen(false); }}><Globe size={20}/></button>{languageMenuOpen && <div className="popover language-popover"><div className="popover-title">{t("Language")}{translating && <span className="language-translating">{<LocalizedText text={"…"}/>}</span>}</div>{LANGUAGES.map(l => <button key={l.code} className={`language-option ${language === l.code ? "selected" : ""}`} onClick={() => changeLanguage(l.code)}><span className="language-flag">{l.flag}</span><span className="language-name">{l.nativeLabel}</span>{language === l.code && <Check size={15}/>}</button>)}</div>}</div><div className="notification-wrap"><button className="icon-btn notif-btn" aria-label={translateUI("Notifications")} onClick={toggleNotifications}><Bell size={20}/>{data.unreadNotifications > 0 && <i/>}</button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-title">{t("Notifications")} {data.unreadNotifications > 0 && <span>{data.unreadNotifications} {<LocalizedText text={"new"}/>}</span>}</div>{data.notifications.length === 0 ? <div className="notification-empty"><Bell size={18}/><p>{t("No notifications yet")}</p></div> : data.notifications.map(n => { const { Icon, color } = notificationVisual(n.type); return <div className={`notification-item ${n.readAt ? "" : "unread"}`} key={n.id}><span className={`notification-icon ${color}`}><Icon size={16}/></span><div><strong><LocalizedText text={n.title}/></strong><p><LocalizedText text={n.message}/></p><small>{timeAgo(n.createdAt)}</small></div></div>; })}<button className="notification-see-all" onClick={() => { setNotificationsOpen(false); go("Notifications"); }}>{t("See all notifications")} <ArrowRight size={13}/></button></div>}</div><div className="profile-wrap"><button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><span className="avatar">{data.user.profilePhoto ? <img src={data.user.profilePhoto} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/> : data.user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><span className="profile-meta"><strong>{data.user.name}</strong><small>{data.plan ? data.plan + " " + t("member") : t("Account")}</small></span><ChevronDown size={16}/></button>{profileOpen && <div className="popover profile-popover"><div className="profile-pop-head"><strong>{data.user.name}</strong><span>{data.user.email ?? t("No email address")}</span></div>{data.user.role === "admin" && <a href="/admin" className="admin-link-btn"><ShieldCheck size={17}/> {t("Admin panel")}</a>}{!data.user.isDemo && <button onClick={() => { setPage("Profile"); setProfileOpen(false); }}><UserRound size={17}/> {t("View profile")}</button>}{data.user.isDemo ? <><button onClick={() => { setAuthMode("register"); setProfileOpen(false); }}><UserRound size={17}/> {t("Create an account")}</button><button onClick={() => { setAuthMode("login"); setProfileOpen(false); }}><LockKeyhole size={17}/> {t("Sign in")}</button></> : <button onClick={logout}><LogOut size={17}/> {t("Log out")}</button>}</div>}</div></div></header>
    <main className="content">
      {ready && refreshing && <div className="account-refreshing-banner" role="status"><RefreshCw size={14} className="spin"/><span>{translateUI("Refreshing account data…")}</span></div>}
      {data.user.accountStatus !== "active" && <div className={`account-status-banner ${data.user.accountStatus}`} role="status">
        <AlertTriangle size={17}/>
        <span>
          <strong>{data.user.accountStatus === "suspended" ? translateUI("Your account is suspended.") : translateUI("Your account has limited access.")}</strong>{" "}
          {data.user.accountStatus === "suspended"
            ? translateUI("Trading, deposits, withdrawals, and subscriptions are disabled on this account.")
            : <>{data.user.maxTradeAmount !== null && `Trades are capped at ${money(data.user.maxTradeAmount)}. `}{data.user.withdrawalsBlocked && translateUI("Withdrawals are disabled. ")}</>}
          {data.user.statusReason && <> {<LocalizedText text={"Reason:"}/>} {data.user.statusReason}{<LocalizedText text={"."}/>}</>} {<LocalizedText text={"Contact support for help."}/>}
        </span>
      </div>}
      {page === "Overview" && <>
        <div className="total-balance-card">
          <div className="total-balance-decor"/>
          <div className="total-balance-top">
            <div className="total-balance-account"><span className="total-balance-avatar">{data.user.profilePhoto ? <img src={data.user.profilePhoto} alt=""/> : data.user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><div className="total-balance-welcome-copy"><strong>{data.user.name === "Account" ? t("Your account") : <>{t("Good to see you,")} {firstName} <span className="wave">{<LocalizedText text={"✌️"}/>}</span></>}</strong><small>{date.toUpperCase()} · {data.user.name === "Account" ? t("Account overview") : `${data.user.name}'s Account`}</small></div></div>
            <button aria-label={hideBalance ? t("Show balance") : t("Hide balance")} title={hideBalance ? t("Show balance") : t("Hide balance")} className="total-balance-eye" onClick={() => setHideBalance(!hideBalance)}>{hideBalance ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          <p className="total-balance-welcome-sub">{t("Here's what's happening with your portfolio today.")}</p>
          <span className="total-balance-label">{t("Total balance")}</span>
          <strong className="total-balance-value">{hideBalance ? "••••••" : money(totalBalance)}</strong>
          <span className="total-balance-sub">{t("Capital, active bot plans, profits, and asset purchase cost")}</span>
          <div className="total-balance-actions"><button onClick={() => go("Deposit")}><Plus size={16}/>{t("Top up")}</button><button onClick={() => go("Withdraw")}><ArrowUpRight size={16}/>{t("Transfer")}</button><button onClick={() => go("Trading Bot")}><Bot size={16}/>{t("Bot plans")}</button></div>
        </div>
        <div className="stats-grid">
          {card(CreditCard, "Capital", money(data.user.cashBalance), <span>{<LocalizedText text={"Available for trades"}/>}</span>, "orange")}
          {card(Bot, "Active trade", money(portfolioValue), <span>{activeBotSummary}</span>, "purple")}
          {card(Gift, "Profits", money(data.user.profitBalance), <><span>{<LocalizedText text={"Profits earned"}/>}</span><button type="button" className="profit-transfer-btn" disabled={profitTransferBusy || data.user.profitBalance <= 0} onClick={() => void transferProfitsToCapital()}>{profitTransferBusy ? "Moving…" : "Withdraw to Capital"}<ArrowRight size={12}/></button></>, "green", "profit-card-wide")}
        </div>
        <section className="panel statistics-panel" aria-label="Statistics">
          <SectionHead title={translateUI("Statistics")}/>
          <div className="dashboard-gauges">
          {[
            { label: "Signal strength", value: Math.max(0, Math.min(100, data.user.signalStrength)), display: `${Math.round(data.user.signalStrength)}%` },
            { label: "Trade progress", value: Math.max(0, Math.min(100, data.user.targetProgressPercent)), display: `${Math.round(data.user.targetProgressPercent)}%` },
            { label: "Target amount", value: data.user.targetBalance > 0 ? Math.max(0, Math.min(100, data.user.cashBalance / data.user.targetBalance * 100)) : 0, display: money(data.user.targetBalance) },
          ].map(gauge => {
            const level = Math.max(1, Math.min(7, Math.floor(gauge.value / 100 * 7) + 1));
            const levelColors = ["#ef4444", "#f97316", "#eab308", "#a3b52b", "#86efac", "#22c55e", "#166534"];
            const levelRatings = ["Weak", "Fair", "Moderate", "Average", "Good", "Strong", "Excellent"];
            const levelColor = levelColors[level - 1];
            return <article className="dashboard-gauge" key={gauge.label}>
              <div className="dashboard-gauge-top"><span className="gauge-kicker">{gauge.label}</span><MoreHorizontal size={19}/></div>
              <p className="dashboard-gauge-description">{gauge.label === "Signal strength" ? "Current signal level for your account." : gauge.label === "Trade progress" ? "Progress set for your current trading goal." : "Capital balance progress toward your admin-set target."}</p>
              {gauge.label === "Trade progress" ? <>
                <div className="dashboard-gauge-value-row"><strong>{gauge.display}</strong></div>
                <div className="dashboard-gauge-single-track" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)}>
                  <div style={{ width: `${gauge.value}%` }}/>
                </div>
              </> : gauge.label === "Target amount" ? <>
                <div className="dashboard-gauge-value-row"><strong>{hideBalance ? "••••••" : gauge.display}</strong></div>
                <div className="dashboard-gauge-single-track capital-target-track" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)}>
                  <div style={{ width: `${gauge.value}%` }}/>
                </div>
                <div className="capital-target-caption">{data.user.targetBalance > 0 ? <><span>Capital <strong>{hideBalance ? "••••••" : money(data.user.cashBalance)}</strong></span><span>Target <strong>{hideBalance ? "••••••" : gauge.display}</strong></span></> : <span>Admin has not set a target yet.</span>}</div>
              </> : <>
                <div className="dashboard-gauge-value-row"><strong>{gauge.display}</strong><span className="gauge-rating" style={{ color: levelColor, borderColor: levelColor, backgroundColor: `${levelColor}18` }}>{levelRatings[level - 1]}</span></div>
                <div className="dashboard-gauge-segments" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)} aria-valuetext={`${levelRatings[level - 1]}, level ${level}`}>
                  {Array.from({ length: 24 }, (_, index) => <span key={index} className={index < Math.round(gauge.value / 100 * 24) ? "filled" : ""} style={index < Math.round(gauge.value / 100 * 24) ? { backgroundColor: levelColor } : undefined}/>) }
                </div>
              </>}
            </article>;
          })}
          </div>
        </section>
        <section className="panel recent-panel"><SectionHead title={translateUI("Recent activity")} subtitle="Your latest trades and transactions" action={<button className="text-link" onClick={() => go("Trade History")}>{<LocalizedText text={"View history"}/>} <ArrowRight size={16}/></button>}/>{tradeTable(3)}</section>
      </>}
      {page === "Portfolio" && <>
        <PageTitle title={translateUI("My portfolio")} description={translateUI("Review your recorded asset holdings and purchase amounts.")}/>
        <div className="stats-grid">
          {card(Wallet, "Total portfolio", money(totalBalance), <span>{<LocalizedText text={"Cash + invested assets + profits"}/>}</span>)}
          {card(Bot, "Active trade", money(portfolioValue), <span>{activeBotSummary}</span>, "purple")}
          {card(CreditCard, "Capital", money(data.user.cashBalance), <span>{<LocalizedText text={"Available for trades"}/>}</span>, "green")}
          {card(Gift, "Profits", money(data.user.profitBalance), <><span>{<LocalizedText text={"Credited by admin"}/>}</span><button type="button" className="profit-transfer-btn" disabled={profitTransferBusy || data.user.profitBalance <= 0} onClick={() => void transferProfitsToCapital()}>{profitTransferBusy ? "Moving…" : "Withdraw to Capital"}<ArrowRight size={12}/></button></>, "orange", "profit-card-wide")}
        </div>
      </>}
      {page === "Trading Bot" && <>
        <PageTitle title={translateUI("Trading bot plans")} description={translateUI("Choose a capital range and enter an amount to start a plan.")}/>
        <div className="feature-banner bot-banner"><div className="feature-icon"><Bot size={26}/></div><div><span className="banner-eyebrow">{<LocalizedText text={"EIGHT TIERS · CLEAR CAPITAL RANGES"}/>}</span><h2>{<LocalizedText text={"Choose a plan that fits your allocation."}/>}</h2><p>{<LocalizedText text={"Select a strategy profile, choose an amount within its range, and pay from Capital. Bot plans do not expire and can be purchased more than once."}/>}</p></div><div className="banner-art"><Bot size={100} strokeWidth={1}/></div></div>
        <div className="section-title-row"><div><h2>{<LocalizedText text={"Choose your bot plan"}/>}</h2><p>{<LocalizedText text={"Enter an amount inside the plan range to get started."}/>}</p></div><span className="subtle-label">{tradingBots.filter(b=>b.mySubscription).length} {<LocalizedText text={"active plans"}/>}</span></div>
        {!tradingBotsLoaded ? <div className="no-results">{<LocalizedText text={"Loading bots..."}/>}</div> : tradingBots.length === 0 ? <EmptyState icon={Bot} title={translateUI("No bots available yet")} text="Check back soon — an admin hasn't added any trading bots yet."/> : <div className="trader-grid bot-plan-grid">{tradingBots.map(b=>{
          const subscribed = !!b.mySubscription;
          const minAmount = Number(b.minAllocation);
          const maxAmount = Number(b.maxAllocation);
          const amountValue = botPlanAmounts[b.id] ?? "";
          return <div className={`panel trader-card bot-plan-card ${subscribed ? "plan-active" : ""}`} key={b.id}>
            <div className="trader-body">
              <span className="bot-plan-strategy">{b.strategy} · {b.riskLevel} risk</span>
              <div className="trader-name-row"><h3>{b.name}</h3><CheckCircle2 size={15} className="verified-tick"/></div>
              <p className="bot-plan-range">{formatInCurrency(minAmount, "USD", 0)} – {formatInCurrency(maxAmount, "USD", 0)} <span>USD plan range</span></p>
              <p className="trader-bio">{b.description}</p>
              <ul className="bot-plan-features">{b.features.map(feature=><li key={feature}><Check size={15}/>{feature}</li>)}</ul>
              <div className="bot-plan-form">
                <label className="input-label">{<LocalizedText text={"Plan amount"}/>}</label>
                <div className="amount-input"><span>{inputSymbol}</span><input type="number" min={inMyCurrency(minAmount)} max={inMyCurrency(maxAmount)} step="0.01" placeholder={inMyCurrency(minAmount)} value={amountValue} onChange={e=>setBotPlanAmounts(current=>({...current,[b.id]:e.target.value}))}/><span>{currency}</span></div>
                {usdPreview(amountValue) && <p className="form-hint">{usdPreview(amountValue)}</p>}
                {amountValue && usdOf(amountValue) > data.user.cashBalance && <p className="form-hint">Not enough capital. Available: {money(data.user.cashBalance)}.</p>}
                <button className="primary-btn full-btn trader-cta" disabled={!ready || botSubscribingId === b.id || !amountValue || usdOf(amountValue) < minAmount || usdOf(amountValue) > maxAmount || usdOf(amountValue) > data.user.cashBalance} onClick={()=>subscribeToBot(b)}>{botSubscribingId === b.id ? translateUI("Starting...") : <>{<LocalizedText text={"Start plan"}/>} <ArrowRight size={16}/></>}</button>
              </div>
            </div>
          </div>;
        })}</div>}
        <div className="copy-note"><ShieldCheck size={19}/><span>{<LocalizedText text={"The amount you enter is charged from your capital when the plan starts. Bot plans do not expire."}/>}</span></div>
        <div className="section-title-row"><div><h2>{<LocalizedText text={"Plan history"}/>}</h2><p>{<LocalizedText text={"Your past and active bot plans"}/>}</p></div></div>
        {botSubHistory.length === 0 ? <EmptyState icon={History} title={translateUI("No bot plans yet")} text="Start a plan above to see it here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Bot plan"}/>}</th><th>{<LocalizedText text={"Charged"}/>}</th><th>{<LocalizedText text={"Started"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{botSubHistory.map(s=>{
          const active = !s.expiresAt || renderNow === null || new Date(s.expiresAt).getTime() > renderNow;
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.botName}</strong></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>{<LocalizedText text={"Active"}/>}</span> : <span className="status-pill expired"><span/>{<LocalizedText text={"Inactive"}/>}</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Copy Trading" && <>
        <PageTitle title={translateUI("Copy trading")} description={translateUI("Subscribe to a trader's strategy and track your subscription history.")}/>
        <div className="feature-banner copy-banner"><div className="feature-icon"><UsersRound size={25}/></div><div><span className="banner-eyebrow">{<LocalizedText text={"LEARN FROM THE BEST"}/>}</span><h2>{<LocalizedText text={"Great minds trade alike."}/>}</h2><p>{<LocalizedText text={"Browse admin-curated traders and subscribe to follow their strategy for the period shown on each card."}/>}</p></div><div className="banner-art"><UsersRound size={105} strokeWidth={1}/></div></div>
        <div className="section-title-row"><div><h2>{<LocalizedText text={"Available traders"}/>}</h2><p>{<LocalizedText text={"Each subscription runs for the duration shown on its card, starting the moment you subscribe"}/>}</p></div><span className="subtle-label">{copyTraders.filter(t=>t.mySubscription).length} {<LocalizedText text={"active"}/>}</span></div>
        {!copyTradersLoaded ? <div className="no-results">{<LocalizedText text={"Loading traders..."}/>}</div> : copyTraders.length === 0 ? <EmptyState icon={UsersRound} title={translateUI("No traders available yet")} text="Check back soon — an admin hasn't added any copy traders yet."/> : <div className="trader-grid">{copyTraders.map(t=>{
          const subscribed = !!t.mySubscription;
          const left = t.mySubscription ? daysLeft(t.mySubscription.expiresAt) : 0;
          const price = Number(t.subscriptionAmount);
          return <div className="panel trader-card" key={t.id}>
            <div className="trader-cover-wrap">
              {t.photoUrl ? <img className="trader-cover-photo" src={t.photoUrl} alt={t.name} onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/> : <div className={`trader-cover ${t.avatarColor}`}><span className="trader-cover-glyph">{t.avatarInitials}</span></div>}
              <span className="trader-cover-flag" title={countryInfo(t.country).name}>{flagEmoji(t.country)}</span>
            </div>
            <div className="trader-body">
              <div className="trader-name-row"><h3>{t.name}</h3><CheckCircle2 size={15} className="verified-tick"/></div>
              <p className="trader-sub">{t.handle} {<LocalizedText text={"· Focus:"}/>} {t.focus} {<LocalizedText text={"·"}/>} {t.riskLevel} {<LocalizedText text={"risk"}/>}</p>
              <p className="trader-bio">{t.bio}</p>
              <div className="trader-stats-row">
                <div><strong><Star size={12} color="#f5a623" fill="#f5a623"/> {Number(t.rating).toFixed(1)}</strong><span>{<LocalizedText text={"Rating"}/>}</span></div>
                <div className="stat-divider"/>
                <div><strong>{t.activeSubscribers}</strong><span>{<LocalizedText text={"Subscribers"}/>}</span></div>
                <div className="stat-divider"/>
                <div><strong>{price > 0 ? money(price) : translateUI("Free")}</strong><span>{<LocalizedText text={"/"}/>} {t.subscriptionDurationDays}{<LocalizedText text={"d"}/>}</span></div>
              </div>
              <button className={subscribed ? "outline-btn full-btn trader-cta" : "primary-btn full-btn trader-cta"} disabled={loading || !ready || subscribed || subscribingId === t.id} onClick={()=>subscribeToTrader(t)}>
                {subscribed ? <><Check size={17}/> {<LocalizedText text={"Subscribed ·"}/>} {left}{<LocalizedText text={"d left"}/>}</> : subscribingId === t.id ? translateUI("Subscribing...") : <><Copy size={17}/> {<LocalizedText text={"Subscribe"}/>}</>}
              </button>
            </div>
          </div>;
        })}</div>}
        <div className="copy-note"><ShieldCheck size={19}/><span>{<LocalizedText text={"Subscribing charges your available account balance and grants 7 days of access to that trader's strategy. There is no auto-renewal — resubscribe once your access expires."}/>}</span></div>
        <div className="section-title-row"><div><h2>{<LocalizedText text={"My subscriptions"}/>}</h2><p>{<LocalizedText text={"Your copy trading subscription history"}/>}</p></div></div>
        {mySubscriptions.length === 0 ? <EmptyState icon={History} title={translateUI("No subscriptions yet")} text="Subscribe to a trader above to see your history here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Trader"}/>}</th><th>{<LocalizedText text={"Amount"}/>}</th><th>{<LocalizedText text={"Started"}/>}</th><th>{<LocalizedText text={"Expires"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{mySubscriptions.map(s=>{
          const left = daysLeft(s.expiresAt);
          const active = renderNow === null || new Date(s.expiresAt).getTime() > renderNow;
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.traderName}</strong><span>{s.traderHandle}</span></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td className="muted-cell">{new Date(s.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>{<LocalizedText text={"Active ·"}/>} {left}{<LocalizedText text={"d left"}/>}</span> : <span className="status-pill expired"><span/>{<LocalizedText text={"Expired"}/>}</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Plans" && <>
        <PageTitle title={translateUI("Choose your plan")} description={translateUI("Subscribe weekly to unlock more of the platform. No auto-renewal — resubscribe (or switch) once your week is up.")}/>
        <div className="plans-intro"><span><Sparkles size={19}/></span> {<LocalizedText text={"Your current plan is"}/>} <strong>{data.plan ?? translateUI("No active plan")}</strong>{data.planExpiresAt && !!data.planAmount && <> {<LocalizedText text={"· renews by"}/>} {new Date(data.planExpiresAt).toLocaleDateString()}</>}{<LocalizedText text={". Plan charges are deducted from your available account balance."}/>}</div>
        {!plansLoaded ? <div className="no-results">{<LocalizedText text={"Loading plans..."}/>}</div> : plansCatalog.length === 0 ? <EmptyState icon={Sparkles} title={translateUI("No plans available yet")} text="Check back soon — an admin hasn't added any plans yet."/> : <div className="plans-grid">{plansCatalog.map(p=>{
          const isCurrent = !!p.mySubscription?.isCurrent;
          const left = p.mySubscription ? daysLeft(p.mySubscription.expiresAt) : 0;
          const price = Number(p.priceWeekly);
          return <div className={`plan-card panel ${p.isFeatured ? "featured":""}`} key={p.id}>
            {p.isFeatured && <span className="popular-label"><Zap size={13}/> {<LocalizedText text={"MOST POPULAR"}/>}</span>}
            <span className="plan-icon">{price === 0 ?<Wallet size={24}/>:p.isFeatured?<Zap size={24}/>:<WandSparkles size={24}/>}</span>
            <h2>{p.name}</h2><p>{p.description}</p>
            <div className="plan-price"><strong>{price > 0 ? money(price) : translateUI("Free")}</strong><span>{<LocalizedText text={"/ week"}/>}</span></div>
            <button className={isCurrent ? "outline-btn full-btn":"primary-btn full-btn"} disabled={isCurrent || loading || !ready || planSubscribingId === p.id} onClick={()=>subscribeToPlan(p)}>{isCurrent ? <><Check size={17}/> {<LocalizedText text={"Current plan"}/>}{price > 0 && <> {<LocalizedText text={"·"}/>} {left}{<LocalizedText text={"d left"}/>}</>}</>:planSubscribingId===p.id?translateUI("Subscribing..."):<>{<LocalizedText text={"Choose"}/>} {p.name} <ArrowRight size={17}/></>}</button>
            <div className="plan-features"><span>{<LocalizedText text={"WHAT'S INCLUDED"}/>}</span>{p.features.map(f=><div key={f}><Check size={16}/>{f}</div>)}</div>
            <p className="subtle-label" style={{marginTop:10}}>{p.activeSubscribers} {<LocalizedText text={"active subscriber"}/>}{p.activeSubscribers===1?"":translateUI("s")}</p>
          </div>;
        })}</div>}
        <p className="disclaimer">{<LocalizedText text={"Plan subscriptions are charged to your account balance and provide access to the listed platform features."}/>}</p>
        <div className="section-title-row"><div><h2>{<LocalizedText text={"My plan subscriptions"}/>}</h2><p>{<LocalizedText text={"Your plan subscription history"}/>}</p></div></div>
        {planSubHistory.length === 0 ? <EmptyState icon={History} title={translateUI("No subscriptions yet")} text="Choose a plan above to see your history here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Plan"}/>}</th><th>{<LocalizedText text={"Amount"}/>}</th><th>{<LocalizedText text={"Started"}/>}</th><th>{<LocalizedText text={"Expires"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{planSubHistory.map(s=>{
          const left = daysLeft(s.expiresAt);
          const active = renderNow === null || new Date(s.expiresAt).getTime() > renderNow;
          const isFree = Number(s.amount) === 0;
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.planName}</strong></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td className="muted-cell">{isFree ? translateUI("No expiry") : new Date(s.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>{<LocalizedText text={"Active"}/>}{!isFree && <> {<LocalizedText text={"·"}/>} {left}{<LocalizedText text={"d left"}/>}</>}</span> : <span className="status-pill expired"><span/>{<LocalizedText text={"Expired"}/>}</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Profile" && <ProfilePage notify={notify} onRequireAuth={(mode) => setAuthMode(mode)} onProfileUpdated={() => { void refresh(); }}/>}
      {page === "Deposit" && <>
        <PageTitle title={translateUI("Add funds")} description={translateUI("Send a payment from outside Tetratrades using one of the methods below, then submit your receipt for admin review.")}/>
        <div className="deposit-note-banner"><Hourglass size={17}/><span>{<LocalizedText text={"Deposits are"}/>} <strong>{<LocalizedText text={"not instant"}/>}</strong>{<LocalizedText text={". Send funds to the destination shown, upload proof of payment, and an admin will verify and credit your balance — usually within a few hours."}/>}</span></div>
        <div className="deposit-layout">
          <section className="panel deposit-panel">
            <SectionHead title={translateUI("1. Choose a payment method")} subtitle="Pick how you'll send funds"/>
            <div className="select-wrap deposit-method-select"><FundingMethodIcon method={depositMethod}/><select aria-label={translateUI("Choose a payment method")} value={depositMethod} onChange={e => setDepositMethod(e.target.value as DepositMethod)}>
              {DEPOSIT_METHODS.map(m => <option key={m.id} value={m.id}>{translateUI(m.label)}</option>)}
            </select><ChevronDown size={16}/></div>
            <p className="deposit-method-blurb">{translateUI(DEPOSIT_METHODS.find(m => m.id === depositMethod)?.blurb ?? "")}</p>
            <SectionHead title={translateUI("2. Send funds to")} subtitle="Admin-provided destination for this method"/>
            {!depositAccountsLoaded ? <div className="deposit-accounts-empty">{<LocalizedText text={"Loading destination accounts…"}/>}</div> : methodAccounts.length === 0 ? <div className="deposit-accounts-empty"><AlertTriangle size={16}/> {<LocalizedText text={"Currently Unavailable"}/>}</div> : <div className="deposit-account-list">
              {methodAccounts.map(acc => <div key={acc.id} className={`deposit-account-card ${selectedDepositAccountId === acc.id ? "chosen" : ""}`}>
                <button type="button" className="deposit-destination-choice" aria-pressed={selectedDepositAccountId === acc.id} onClick={() => setDepositAccountId(acc.id)}>
                  <FundingMethodIcon method={acc.method} size={17}/>
                  <span className="deposit-account-details"><strong>{acc.label}</strong><span>{acc.instructions}</span></span>
                </button>
                <button type="button" className="copy-destination-btn" onClick={() => void copyDestination(acc.instructions)} aria-label={translateUI("Copy destination details")} title={translateUI("Copy destination details")}><Copy size={15}/><span>{translateUI("Copy")}</span></button>
              </div>)}
            </div>}
            <form className="deposit-form" onSubmit={submitDeposit}>
              <label className="input-label">{<LocalizedText text={"3. Amount you sent ("}/>}{currency}{<LocalizedText text={")"}/>}</label>
              <div className="amount-input funding-input"><span>{inputSymbol}</span><input type="number" min={inMyCurrency(1)} step="0.01" placeholder={translateUI("0.00")} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} required/><span>{currency}</span></div>
              {amountHint(depositAmount)}
              <label className="input-label">{<LocalizedText text={"Reference (sender name, tx hash, last 4 digits — optional)"}/>}</label>
              <input className="text-input" placeholder={translateUI("e.g. Transaction ID or sender name")} value={depositReference} onChange={e => setDepositReference(e.target.value)} maxLength={200}/>
              <label className="input-label">{<LocalizedText text={"4. Upload your receipt"}/>}</label>
              <label className="receipt-dropzone">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={e => handleReceiptFile(e.target.files?.[0] ?? null)} hidden/>
                {receiptFile ? <><FileText size={22}/><strong>{receiptFile.name}</strong><span>{(receiptFile.size / 1024).toFixed(0)} {<LocalizedText text={"KB · Tap to replace"}/>}</span></> : <><UploadCloud size={22}/><strong>{<LocalizedText text={"Click to upload a screenshot, photo, or PDF"}/>}</strong><span>{<LocalizedText text={"JPG, PNG, WEBP, HEIC, or PDF · Max"}/>} {(MAX_RECEIPT_BYTES / (1024 * 1024)).toFixed(0)}{<LocalizedText text={"MB"}/>}</span></>}
              </label>
              {receiptError && <p className="receipt-error"><XCircle size={13}/> {receiptError}</p>}
              <label className="input-label">{<LocalizedText text={"Note for the admin (optional)"}/>}</label>
              <textarea className="text-input deposit-textarea" placeholder={translateUI("Anything else the reviewer should know")} value={depositNote} onChange={e => setDepositNote(e.target.value)} maxLength={1000} rows={3}/>
              <button className="primary-btn full-btn" disabled={depositSubmitting || !ready}><Paperclip size={16}/>{depositSubmitting ? translateUI("Submitting...") : translateUI("Submit deposit for review")}</button>
              <p className="simulation-note"><ShieldCheck size={13}/> {<LocalizedText text={"Your balance only updates after an admin verifies this receipt. No automatic crediting occurs."}/>}</p>
            </form>
          </section>
          <section className="panel deposit-history-panel">
            <SectionHead title={translateUI("Your deposit requests")} subtitle={`${myDeposits.length} submitted`}/>
            {myDeposits.length ? <div className="deposit-request-list">{myDeposits.map(r => <div className="deposit-request-item" key={r.id}>
              <div className="deposit-request-top"><strong>{money(Number(r.amount))}</strong><span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? translateUI("Pending review") : r.status === "approved" ? translateUI("Approved") : translateUI("Rejected")}</span></div>
              <p>{translateUI(DEPOSIT_METHODS.find(m => m.id === r.method)?.label ?? r.method)}{r.destinationLabel ? ` · ${r.destinationLabel}` : ""}</p>
              {r.adminNote && r.status === "rejected" && <p className="deposit-admin-note"><AlertTriangle size={13}/> {r.adminNote}</p>}
              <div className="deposit-request-bottom"><span>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><a href={`/api/deposits/${r.id}/receipt`} target="_blank" rel="noreferrer">{<LocalizedText text={"View receipt"}/>}</a></div>
            </div>)}</div> : <EmptyState icon={ArrowDownLeft} title={translateUI("No deposit requests yet")} text="Submit your first deposit above and it will show up here while it's reviewed."/>}
          </section>
        </div>
      </>}
      {page === "Withdraw" && <>
        <PageTitle title={translateUI("Withdraw funds")} description={translateUI("Request a payout to any platform you choose. An admin reviews and sends it before it's final.")}/>
        {data.user.profitBalance > 0 && <div className="profit-withdrawal-notice" role="status"><AlertTriangle size={16}/><span>You need to move all profits ({money(data.user.profitBalance)}) to Capital before you can request a withdrawal. Use <strong>Move to Capital</strong> on the Profits card, then return here.</span></div>}
        <div className="deposit-note-banner"><Hourglass size={17}/><span>{<LocalizedText text={"The requested amount is"}/>} <strong>{<LocalizedText text={"reserved from your available balance"}/>}</strong> {<LocalizedText text={"right away. An admin manually sends your payout, then approves the request here — or rejects it and the amount is returned to your balance."}/>}</span></div>
        <div className="deposit-layout">
          <section className="panel deposit-panel">
            <SectionHead title={translateUI("1. Choose a payout method")} subtitle="Pick how you'd like to receive funds"/>
            <div className="select-wrap deposit-method-select"><FundingMethodIcon method={withdrawalMethod}/><select aria-label={translateUI("Choose a payout method")} value={withdrawalMethod} onChange={e => setWithdrawalMethod(e.target.value as WithdrawalMethod)}>
              {WITHDRAWAL_METHODS.map(m => <option key={m.id} value={m.id}>{translateUI(m.label)}</option>)}
            </select><ChevronDown size={16}/></div>
            <p className="deposit-method-blurb">{translateUI(WITHDRAWAL_METHODS.find(m => m.id === withdrawalMethod)?.blurb ?? "")}</p>
            <form className="deposit-form" onSubmit={submitWithdrawal}>
              {withdrawalMethod === "other" && <><label className="input-label">{<LocalizedText text={"Platform name"}/>}</label><input className="text-input" placeholder={translateUI("e.g. Skrill, Payoneer, Zelle...")} value={withdrawalMethodLabelInput} onChange={e => setWithdrawalMethodLabelInput(e.target.value)} maxLength={60}/></>}
              <label className="input-label">{<LocalizedText text={"2. Where should we send it?"}/>}</label>
              <textarea className="text-input deposit-textarea" placeholder={translateUI(WITHDRAWAL_METHODS.find(m => m.id === withdrawalMethod)?.placeholder ?? "")} value={withdrawalDestination} onChange={e => setWithdrawalDestination(e.target.value)} rows={3} maxLength={500} required/>
              <label className="input-label">{<LocalizedText text={"3. Amount to withdraw ("}/>}{currency}{<LocalizedText text={")"}/>}</label>
              <div className="amount-input funding-input"><span>{inputSymbol}</span><input type="number" min={inMyCurrency(1)} step="0.01" placeholder={translateUI("0.00")} value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} required/><span>{currency}</span></div>
              {amountHint(withdrawalAmount)}
              <div className="quick-amounts">{[100, 500, 1000, 5000].map(n => <button type="button" key={n} onClick={() => setWithdrawalAmount(inMyCurrency(n))}>{money(n, 0)}</button>)}</div>
              <div className="funding-balance"><span>{<LocalizedText text={"Capital available"}/>}</span><strong>{money(data.user.cashBalance)}</strong></div>
              <label className="input-label">{<LocalizedText text={"Note for the admin (optional)"}/>}</label>
              <textarea className="text-input deposit-textarea" placeholder={translateUI("Anything else the reviewer should know")} value={withdrawalNote} onChange={e => setWithdrawalNote(e.target.value)} maxLength={1000} rows={2}/>
              <button className="primary-btn full-btn" disabled={withdrawalSubmitting || !ready || data.user.profitBalance > 0}>{withdrawalSubmitting ? translateUI("Submitting...") : data.user.profitBalance > 0 ? translateUI("Move profits to Capital first") : translateUI("Submit withdrawal for review")}<ArrowRight size={17}/></button>
              <p className="simulation-note"><ShieldCheck size={13}/> {<LocalizedText text={"No automatic payout is sent. Funds leave only after an admin verifies and approves this request."}/>}</p>
            </form>
          </section>
          <section className="panel deposit-history-panel">
            <SectionHead title={translateUI("Your withdrawal requests")} subtitle={`${myWithdrawals.length} submitted`}/>
            {myWithdrawals.length ? <div className="deposit-request-list">{myWithdrawals.map(r => <div className="deposit-request-item" key={r.id}>
              <div className="deposit-request-top"><strong>{money(Number(r.amount))}</strong><span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? translateUI("Pending review") : r.status === "approved" ? translateUI("Approved") : translateUI("Rejected")}</span></div>
              <p>{WITHDRAWAL_METHODS.find(m => m.id === r.method)?.id === "other" ? (r.methodLabel || translateUI("Other")) : translateUI(WITHDRAWAL_METHODS.find(m => m.id === r.method)?.label ?? r.method)}{" · "}{r.destination}</p>
              {r.adminNote && r.status === "rejected" && <p className="deposit-admin-note"><AlertTriangle size={13}/> {r.adminNote}</p>}
              <div className="deposit-request-bottom"><span>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
            </div>)}</div> : <EmptyState icon={ArrowUpRight} title={translateUI("No withdrawal requests yet")} text="Submit your first withdrawal above and it will show up here while it's reviewed."/>}
          </section>
        </div>
      </>}
      {page === "Transactions" && (() => {
        const txTypes = Array.from(new Set(data.transactions.map(t => t.type)));
        const filteredTransactions = data.transactions.filter(t =>
          (txTypeFilter === "all" || t.type === txTypeFilter) &&
          (txSearch.trim() === "" || t.description.toLowerCase().includes(txSearch.toLowerCase()) || t.type.toLowerCase().includes(txSearch.toLowerCase()))
        );
        const isCreditType = (type: string) => type === "deposit" || type === "admin_credit" || type === "profit_credit" || type === "profit_to_capital" || type === "referral_bonus";
        const exportTransactions = () => downloadCsv("transactions", filteredTransactions.map(t => ({ Date: new Date(t.createdAt).toISOString(), Type: t.type, Description: t.description, Amount: (isCreditType(t.type) ? "+" : "-") + Number(t.amount).toFixed(2) })));
        return <>
          <PageTitle title={translateUI("Transactions")} description={translateUI("Keep track of every deposit, withdrawal, and plan charge.")}><button className="outline-btn" onClick={()=>go("Deposit")}><Plus size={17}/> {<LocalizedText text={"Add funds"}/>}</button></PageTitle>
          <div className="stats-grid three">{card(ArrowDownLeft,"Total deposited",money(data.transactions.filter(t=>t.type==="deposit").reduce((s,t)=>s+Number(t.amount),0)),<span>{<LocalizedText text={"All time"}/>}</span>, "green")}{card(ArrowUpRight,"Total withdrawn",money(data.transactions.filter(t=>t.type==="withdrawal").reduce((s,t)=>s+Number(t.amount),0)),<span>{<LocalizedText text={"All time"}/>}</span>, "orange")}{card(Wallet,"Capital",money(data.user.cashBalance),<span>{<LocalizedText text={"Available to trade"}/>}</span>)}</div>
          <section className="panel">
            <SectionHead title={translateUI("Transaction history")} subtitle="A record of your wallet activity" action={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="market-search" style={{ height: 37 }}><Search size={15}/><input placeholder={translateUI("Search")} value={txSearch} onChange={e => setTxSearch(e.target.value)}/></div>
                <div className="select-wrap" style={{ height: 37 }}><select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)}><option value="all">{<LocalizedText text={"All types"}/>}</option>{txTypes.map(ty => <option key={ty} value={ty}>{ty.replace(/_/g, " ")}</option>)}</select></div>
                <button className="outline-btn" disabled={filteredTransactions.length === 0} onClick={exportTransactions}><Download size={15}/> {<LocalizedText text={"Export CSV"}/>}</button>
              </div>
            }/>
            {filteredTransactions.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Transaction"}/>}</th><th>{<LocalizedText text={"Type"}/>}</th><th>{<LocalizedText text={"Date"}/>}</th><th>{<LocalizedText text={"Amount"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{filteredTransactions.map(t=>{const isCredit=isCreditType(t.type);return <tr key={t.id}><td><div className="transaction-cell"><span className={`transaction-icon ${t.type}`}>{t.type==="deposit"?<ArrowDownLeft size={19}/>:t.type==="withdrawal"?<ArrowUpRight size={19}/>:t.type==="admin_credit"?<Plus size={19}/>:t.type==="admin_debit"?<MoreHorizontal size={19}/>:t.type==="profit_to_capital"?<ArrowLeftRight size={19}/>:t.type==="profit_credit"||t.type==="profit_debit"?<TrendingUp size={19}/>:t.type==="referral_bonus"?<Gift size={19}/>:<Sparkles size={19}/>}</span><strong>{t.description}</strong></div></td><td className="capitalize">{t.type.replace(/_/g," ")}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</td><td className={`table-strong ${isCredit?"positive-text":""}`}>{isCredit?"+":"-"}{money(Number(t.amount))}</td><td><span className="status-pill"><span/>{<LocalizedText text={"Completed"}/>}</span></td></tr>;})}</tbody></table></div> : (data.transactions.length ? <div className="no-results">{<LocalizedText text={"No transactions match your search."}/>}</div> : <EmptyState icon={CreditCard} title={translateUI("No transactions yet")} text="Deposits and withdrawals will show up here."/>)}
          </section>
        </>;
      })()}
      {page === "Notifications" && (() => {
        const notifFilterOptions: { label: string; value: string }[] = [
          { label: "All", value: "" },
          { label: "Trading", value: "trade_placed" },
          { label: "Orders", value: "order_filled" },
          { label: "Positions", value: "position_auto_closed" },
          { label: "Deposits", value: "deposit_approved" },
          { label: "Withdrawals", value: "withdrawal_approved" },
          { label: "Price alerts", value: "price_alert_triggered" },
          { label: "Referrals", value: "referral_bonus" },
          { label: "Account", value: "login" },
          { label: "Announcements", value: "admin_message" },
        ];
        const page1 = notifOffset + 1;
        const pageCount = Math.max(Math.ceil(notifTotal / NOTIF_PAGE_SIZE), 1);
        const currentPageNum = Math.floor(notifOffset / NOTIF_PAGE_SIZE) + 1;
        return <>
          <PageTitle title={translateUI("Notifications")} description={translateUI("Everything Tetratrades has told you, in one place.")}>
            {data.unreadNotifications > 0 && <button className="outline-btn" onClick={() => void markAllNotificationsRead()}><Check size={16}/> {<LocalizedText text={"Mark all read"}/>}</button>}
          </PageTitle>
          <section className="panel">
            <SectionHead title={translateUI("All notifications")} subtitle={`${notifTotal} total`} action={
              <div className="notifications-page-filters">
                <div className="select-wrap" style={{ height: 37 }}><select value={notifTypeFilter} onChange={(e) => { setNotifTypeFilter(e.target.value); void loadAllNotifications(0, e.target.value); }}>{notifFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              </div>
            }/>
            {notifLoading ? <div className="no-results">{<LocalizedText text={"Loading notifications..."}/>}</div> : allNotifications.length === 0 ? <EmptyState icon={Bell} title={translateUI("No notifications")} text="Nothing here yet — activity on your account will show up in this list."/> : <>
              <div className="notifications-page-list">{allNotifications.map(n => { const { Icon, color } = notificationVisual(n.type); return <div className={`notification-item ${n.readAt ? "" : "unread"}`} key={n.id} onClick={() => !n.readAt && markOneNotificationRead(n.id)} style={{ cursor: n.readAt ? "default" : "pointer" }}>
                <span className={`notification-icon ${color}`}><Icon size={16}/></span>
                <div><strong><LocalizedText text={n.title}/></strong><p><LocalizedText text={n.message}/></p><small>{new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>
              </div>; })}</div>
              <div className="notifications-pagination">
                <button className="outline-btn small" disabled={page1 <= 1} onClick={() => loadAllNotifications(Math.max(notifOffset - NOTIF_PAGE_SIZE, 0), notifTypeFilter)}><ChevronLeft size={14}/> {<LocalizedText text={"Previous"}/>}</button>
                <span>{<LocalizedText text={"Page"}/>} {currentPageNum} {<LocalizedText text={"of"}/>} {pageCount}</span>
                <button className="outline-btn small" disabled={notifOffset + NOTIF_PAGE_SIZE >= notifTotal} onClick={() => loadAllNotifications(notifOffset + NOTIF_PAGE_SIZE, notifTypeFilter)}>{<LocalizedText text={"Next"}/>} <ChevronRight size={14}/></button>
              </div>
            </>}
          </section>
        </>;
      })()}
      {page === "Trade History" && (() => {
        const matchesSearch = (symbol: string) => historySearch.trim() === "" || symbol.toLowerCase().includes(historySearch.trim().toLowerCase());
        const searchBox = <div className="market-search" style={{ height: 37 }}><Search size={15}/><input placeholder={translateUI("Search by symbol")} value={historySearch} onChange={e => setHistorySearch(e.target.value)}/></div>;
        const visibleTrades = data.trades.filter(t => (historyTab === "All" || t.side === historyTab.toLowerCase()) && matchesSearch(t.symbol));
        const visibleOrders = [...myOrders.open, ...myOrders.history].filter(o => matchesSearch(o.symbol));
        const visiblePositions = [...myPositions.open, ...myPositions.history].filter(p => matchesSearch(p.symbol));
        return <>
        <PageTitle title={translateUI("Trade history")} description={translateUI("Review your recorded purchases and sales.")}/>
        {historySection === "Trades" && <>
          <div className="stats-grid three">{card(ArrowLeftRight,"Total trades",String(data.trades.length),<span>{<LocalizedText text={"Completed orders"}/>}</span>)}{card(ArrowDownLeft,"Buy orders",String(data.trades.filter(t=>t.side==="buy").length),<span>{<LocalizedText text={"Assets purchased"}/>}</span>,"green")}{card(ArrowUpRight,"Sell orders",String(data.trades.filter(t=>t.side==="sell").length),<span>{<LocalizedText text={"Assets sold"}/>}</span>,"orange")}</div>
          <section className="panel"><div className="section-head"><div><h2>{<LocalizedText text={"All trades"}/>}</h2><p>{<LocalizedText text={"Your complete order history"}/>}</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{searchBox}<div className="segmented">{["All","Buy","Sell"].map(t=><button key={t} className={historyTab===t?"active":""} onClick={()=>setHistoryTab(t)}>{t}</button>)}</div><button className="outline-btn" disabled={visibleTrades.length === 0} onClick={() => downloadCsv("trades", visibleTrades.map(t => ({ Date: new Date(t.createdAt).toISOString(), Symbol: t.symbol, Side: t.side, Quantity: t.quantity, Price: t.price, Total: t.total })))}><Download size={15}/> {<LocalizedText text={"Export CSV"}/>}</button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Asset"}/>}</th><th>{<LocalizedText text={"Type"}/>}</th><th>{<LocalizedText text={"Quantity"}/>}</th><th>{<LocalizedText text={"Price"}/>}</th><th>{<LocalizedText text={"Total"}/>}</th><th>{<LocalizedText text={"Date"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th></tr></thead><tbody>{visibleTrades.map(t=>{const a=getAsset(t.symbol);return <tr key={t.id}><td><div className="coin-cell">{a&&<AssetIcon asset={a} size={34}/>}<div><strong>{a?.name}</strong><span>{t.symbol}{supportBadge(t)}</span></div></div></td><td><span className={`type-pill ${t.side}`}>{t.side==="buy"?<ArrowDownLeft size={13}/>:<ArrowUpRight size={13}/>} {t.side}</span></td><td className="table-strong">{fmtQty(Number(t.quantity))} {t.symbol}</td><td>{marketPrice(Number(t.price))}</td><td className="table-strong">{money(Number(t.total))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td><span className="status-pill"><span/>{<LocalizedText text={"Completed"}/>}</span></td></tr>})}</tbody></table>{visibleTrades.length===0&&<EmptyState icon={History} title={translateUI("No trades found")} text="Your completed orders will appear here."/>}</div></section>
        </>}
        {historySection === "Orders" && <>
          <div className="stats-grid three">{card(Clock3,"Open orders",String(myOrders.open.length),<span>{<LocalizedText text={"Awaiting trigger price"}/>}</span>)}{card(CheckCircle2,"Filled orders",String(myOrders.history.filter(o=>o.status==="filled").length),<span>{<LocalizedText text={"Executed limit/stop/TP orders"}/>}</span>,"green")}{card(X,"Cancelled / expired",String(myOrders.history.filter(o=>o.status==="cancelled"||o.status==="expired").length),<span>{<LocalizedText text={"Withdrawn or passed their duration"}/>}</span>,"orange")}</div>
          <section className="panel"><SectionHead title={translateUI("All orders")} subtitle="Limit, stop-loss, and take-profit orders — market orders fill instantly and appear under Trades" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{searchBox}<button className="outline-btn" disabled={visibleOrders.length === 0} onClick={() => downloadCsv("orders", visibleOrders.map(o => ({ Placed: new Date(o.createdAt).toISOString(), Symbol: o.symbol, Type: o.type, Side: o.side, Quantity: o.quantity, TriggerPrice: o.triggerPrice, Status: o.status, Expires: o.expiresAt ? new Date(o.expiresAt).toISOString() : "" })))}><Download size={15}/> {<LocalizedText text={"Export CSV"}/>}</button></div>}/>
            {!ordersLoaded ? <div className="no-results">{<LocalizedText text={"Loading orders..."}/>}</div> : visibleOrders.length === 0 ? <EmptyState icon={Clock3} title={translateUI("No orders found")} text="Place a limit, stop-loss, or take-profit order from the Trade page to see it here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Asset"}/>}</th><th>{<LocalizedText text={"Type"}/>}</th><th>{<LocalizedText text={"Side"}/>}</th><th>{<LocalizedText text={"Quantity"}/>}</th><th>{<LocalizedText text={"Trigger price"}/>}</th><th>{<LocalizedText text={"Placed"}/>}</th><th>{<LocalizedText text={"Expires"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th><th></th></tr></thead><tbody>{visibleOrders.map(o => { const a = getAsset(o.symbol); return <tr key={o.id}>
              <td><div className="coin-cell">{a && <AssetIcon asset={a} size={32}/>}<div><strong>{a?.name ?? o.symbol}</strong><span>{o.symbol}</span></div></div></td>
              <td>{orderTypeLabel(o.type)}</td>
              <td><span className={`type-pill ${o.side}`}>{o.side === "buy" ? <ArrowDownLeft size={13}/> : <ArrowUpRight size={13}/>} {o.side}</span></td>
              <td className="table-strong">{fmtQty(Number(o.quantity))} {o.symbol}</td>
              <td>{marketPrice(Number(o.triggerPrice))}</td>
              <td className="muted-cell">{new Date(o.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td>
              <td className="muted-cell">{o.status === "open" ? timeLeftLabel(o.expiresAt) : (o.expiresAt ? "Had expiry" : "No expiry")}</td>
              <td><span className={`status-pill ${o.status}`}><span/>{o.status[0].toUpperCase()+o.status.slice(1)}</span></td>
              <td>{o.status === "open" && <button className="icon-btn" title={translateUI("Cancel order")} disabled={cancellingOrderId === o.id} onClick={() => cancelOrder(o.id)}>{cancellingOrderId === o.id ? <RefreshCw size={16} className="spin"/> : <Trash2 size={16}/>}</button>}</td>
            </tr>; })}</tbody></table></div>}
          </section>
        </>}
        {historySection === "Positions" && <>
          <div className="stats-grid three">{card(Zap,"Open positions",String(myPositions.open.length),<span>{<LocalizedText text={"Live leveraged exposure"}/>}</span>)}{card(TrendingUp,"Closed in profit",String(myPositions.history.filter(p=>Number(p.realizedPnl)>0).length),<span>{<LocalizedText text={"Manually closed or take-profit"}/>}</span>,"green")}{card(TrendingDown,"Liquidated",String(myPositions.history.filter(p=>p.status==="liquidated").length),<span>{<LocalizedText text={"Lost full margin"}/>}</span>,"orange")}</div>
          <section className="panel"><SectionHead title={translateUI("All positions")} subtitle="Leveraged long/short positions, open and closed" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{searchBox}<button className="outline-btn" disabled={visiblePositions.length === 0} onClick={() => downloadCsv("positions", visiblePositions.map(p => ({ Symbol: p.symbol, Side: p.side, Leverage: p.leverage, Margin: p.margin, Entry: p.entryPrice, Liquidation: p.liquidationPrice, ClosedAt: p.closedAt ? new Date(p.closedAt).toISOString() : "", Status: p.status, CloseReason: p.closeReason ?? "", Expires: p.expiresAt ? new Date(p.expiresAt).toISOString() : "" })))}><Download size={15}/> {<LocalizedText text={"Export CSV"}/>}</button></div>}/>
            {!positionsLoaded ? <div className="no-results">{<LocalizedText text={"Loading positions..."}/>}</div> : visiblePositions.length === 0 ? <EmptyState icon={Zap} title={translateUI("No positions found")} text="Open a leveraged long or short position from the Trade page to see it here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{<LocalizedText text={"Asset"}/>}</th><th>{<LocalizedText text={"Side"}/>}</th><th>{<LocalizedText text={"Leverage"}/>}</th><th>{<LocalizedText text={"Margin"}/>}</th><th>{<LocalizedText text={"Entry"}/>}</th><th>{<LocalizedText text={"Liquidation"}/>}</th><th>{<LocalizedText text={"Closed at"}/>}</th><th>{<LocalizedText text={"Reason"}/>}</th><th>{<LocalizedText text={"Expires"}/>}</th><th>{<LocalizedText text={"P&L"}/>}</th><th>{<LocalizedText text={"Status"}/>}</th><th></th></tr></thead><tbody>{visiblePositions.map(p => { const a = getAsset(p.symbol); const pnl = p.status === "open" ? (p.unrealizedPnl ?? positionPnl(p.side, Number(p.entryPrice), p.currentPrice ?? Number(p.entryPrice), Number(p.quantity))) : Number(p.realizedPnl ?? 0); return <tr key={p.id}>
              <td><div className="coin-cell">{a && <AssetIcon asset={a} size={32}/>}<div><strong>{a?.name ?? p.symbol}</strong><span>{p.symbol}</span></div></div></td>
              <td><span className={`type-pill ${p.side === "long" ? "buy" : "sell"}`}>{p.side === "long" ? <ArrowUpRight size={13}/> : <ArrowDownLeft size={13}/>} {p.side}</span></td>
              <td className="table-strong">{Number(p.leverage)}{<LocalizedText text={"x"}/>}</td>
              <td>{money(Number(p.margin))}</td>
              <td>{marketPrice(Number(p.entryPrice))}</td>
              <td className="liquidation-cell">{marketPrice(Number(p.liquidationPrice))}</td>
              <td className="muted-cell">{p.closedAt ? new Date(p.closedAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}</td>
              <td className="muted-cell">{p.status === "open" ? "—" : closeReasonLabel(p.closeReason)}</td>
              <td className="muted-cell">{p.status === "open" ? timeLeftLabel(p.expiresAt) : (p.expiresAt ? "Had expiry" : "No expiry")}</td>
              <td className={`table-strong position-pnl ${pnl >= 0 ? "positive-text" : "negative-text"}`}>{pnl >= 0 ? "+" : ""}{money(pnl)}</td>
              <td><span className={`status-pill ${p.status}`}><span/>{p.status[0].toUpperCase()+p.status.slice(1)}</span></td>
              <td>{p.status === "open" && <button className="icon-btn" title={translateUI("Close position")} disabled={closingPositionId === p.id} onClick={() => closePosition(p.id)}>{closingPositionId === p.id ? <RefreshCw size={16} className="spin"/> : <XCircle size={16}/>}</button>}</td>
            </tr>; })}</tbody></table></div>}
          </section>
        </>}
        </>;
      })()}
      <footer className="main-footer"><span>{<LocalizedText text={"© 2026 Tetratrades. Built for curious traders."}/>}</span><span><ShieldCheck size={14}/> {<LocalizedText text={"Live trading · Not financial advice"}/>}</span></footer>
    </main></div>
    {toast && <div className={`toast ${toast.error ? "error":""}`}><span>{toast.error ? <X size={17}/>:<Check size={17}/>}</span><LocalizedText text={toast.text}/><button onClick={()=>setToast(null)}><X size={15}/></button></div>}
    {authMode==="login" && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthMode(null);}}><div className="auth-modal"><button className="modal-close" onClick={()=>setAuthMode(null)} aria-label={translateUI("Close")}><X size={20}/></button><div className="modal-brand"><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div>{<LocalizedText text={"Tetra"}/>}<span>{<LocalizedText text={"Trades"}/>}</span></div><h2>{t("Welcome back")}</h2><p>{t("Sign in to pick up right where you left off.")}</p><form onSubmit={authenticate}><label className="input-label">{t("Email or username")}</label><input className="text-input" placeholder={translateUI("you@example.com or username")} value={authIdentifier} onChange={e=>setAuthIdentifier(e.target.value)} required/><label className="input-label">{t("Password")}</label><input className="text-input" type="password" placeholder={translateUI("At least 8 characters")} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required/><div className="modal-forgot"><button type="button" onClick={()=>{setAuthMode(null);setForgotPasswordOpen(true);}}>{t("Forgot password?")}</button></div><button className="primary-btn full-btn" disabled={loading}>{loading?t("Please wait..."):t("Sign in")}<ArrowRight size={17}/></button></form><div className="modal-switch">{t("New to Tetratrades?")} <button onClick={()=>setAuthMode("register")}>{t("Create account")}</button></div><div className="modal-security"><LockKeyhole size={14}/> {t("Your account is secured with encrypted credentials")}</div></div></div>}
    {authMode==="register" && <RegisterModal onClose={()=>setAuthMode(null)} onSwitchToLogin={()=>setAuthMode("login")} onRegistered={handleRegistered}/>}
    {forgotPasswordOpen && <ForgotPasswordModal onClose={()=>setForgotPasswordOpen(false)} onSwitchToLogin={()=>{setForgotPasswordOpen(false);setAuthMode("login");}}/>}
    {demoGateOpen && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDemoGateOpen(false);}}><div className="demo-gate-modal"><button className="modal-close" onClick={()=>setDemoGateOpen(false)} aria-label={translateUI("Close")}><X size={20}/></button><div className="demo-gate-icon"><UserRound size={24}/></div><h2>{t("Create a free account to continue")}</h2><p>{t("Your demo trades, deposits, and subscriptions won't be saved until you create a free account.")}</p><div className="demo-gate-actions"><button className="primary-btn" onClick={() => { setDemoGateOpen(false); setAuthMode("register"); }}>{t("Sign up free")} <ArrowRight size={16}/></button><button className="outline-btn" onClick={() => { setDemoGateOpen(false); setAuthMode("login"); }}>{t("Sign in")}</button><button className="outline-btn" onClick={() => setDemoGateOpen(false)}>{t("Keep exploring")}</button></div></div></div>}
  </div>;
}
