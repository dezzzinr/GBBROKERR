import { DEPOSIT_METHODS, depositMethodLabel } from "@/lib/deposits";

// Users can request a payout to any platform they choose - the same five
// methods deposits support, plus a free-form "other" option for anything
// not listed. Unlike deposits, the user supplies the destination (their own
// wallet/account/email/tag) since the funds are going out to them.
export type WithdrawalMethod = (typeof DEPOSIT_METHODS)[number]["id"] | "other";

export const WITHDRAWAL_METHODS: { id: WithdrawalMethod; label: string; blurb: string; placeholder: string }[] = [
  { id: "crypto", label: "Cryptocurrency", blurb: "Receive funds at a crypto wallet address you control.", placeholder: "e.g. Wallet address and network (BTC, ETH, USDT-TRC20, ...)" },
  { id: "bank_transfer", label: "Bank transfer", blurb: "Receive a wire or ACH transfer to your bank account.", placeholder: "e.g. Bank name, account name, account number, routing number" },
  { id: "paypal", label: "PayPal", blurb: "Receive a PayPal payment at your email address.", placeholder: "e.g. Your PayPal email address" },
  { id: "cashapp", label: "Cash App", blurb: "Receive a payment at your $Cashtag.", placeholder: "e.g. $YourCashtag" },
  { id: "giftcard", label: "Gift card", blurb: "Receive your payout as a gift card.", placeholder: "e.g. Preferred gift card brand and delivery email" },
  { id: "other", label: "Other", blurb: "Choose this if your preferred payout platform isn't listed above.", placeholder: "Describe where and how we should send your payout" },
];

export const WITHDRAWAL_METHOD_IDS = WITHDRAWAL_METHODS.map((m) => m.id);

export function withdrawalMethodLabel(method: string, methodLabel?: string | null) {
  if (method === "other") return methodLabel?.trim() || "Other";
  return depositMethodLabel(method);
}

export type WithdrawalField = { key: string; label: string; placeholder: string; type?: "email"; required: boolean; maxLength: number };
export const WITHDRAWAL_FIELDS: Record<WithdrawalMethod, WithdrawalField[]> = {
  crypto: [
    { key: "asset", label: "Cryptocurrency", placeholder: "e.g. USDT", required: true, maxLength: 40 },
    { key: "network", label: "Network", placeholder: "e.g. TRC20", required: true, maxLength: 60 },
    { key: "address", label: "Wallet address", placeholder: "Enter the receiving wallet address", required: true, maxLength: 200 },
    { key: "memo", label: "Memo or destination tag (if required)", placeholder: "Optional", required: false, maxLength: 100 },
  ],
  bank_transfer: [
    { key: "bank", label: "Bank name", placeholder: "Bank name", required: true, maxLength: 100 },
    { key: "holder", label: "Account holder name", placeholder: "Name on the account", required: true, maxLength: 100 },
    { key: "account", label: "Account number or IBAN", placeholder: "Account number or IBAN", required: true, maxLength: 100 },
    { key: "routing", label: "Routing, SWIFT or sort code (if applicable)", placeholder: "Optional", required: false, maxLength: 100 },
  ],
  paypal: [{ key: "email", label: "PayPal email", placeholder: "name@example.com", type: "email", required: true, maxLength: 150 }],
  cashapp: [{ key: "cashtag", label: "Cash App $Cashtag", placeholder: "$YourCashtag", required: true, maxLength: 50 }],
  giftcard: [
    { key: "brand", label: "Gift card brand", placeholder: "Preferred brand", required: true, maxLength: 100 },
    { key: "email", label: "Delivery email", placeholder: "name@example.com", type: "email", required: true, maxLength: 150 },
  ],
  other: [{ key: "destination", label: "Payout details", placeholder: "Where and how should the payout be sent?", required: true, maxLength: 300 }],
};

export function formatWithdrawalDestination(method: WithdrawalMethod, input: unknown): { destination: string; error?: never } | { error: string; destination?: never } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Fill in the payout details for the selected method." };
  const fields = input as Record<string, unknown>;
  const lines: string[] = [];
  for (const field of WITHDRAWAL_FIELDS[method]) {
    if (fields[field.key] != null && typeof fields[field.key] !== "string") return { error: `Enter a valid ${field.label}.` };
    const value = String(fields[field.key] ?? "").trim().replace(/[\r\n]+/g, " ");
    if (field.required && !value) return { error: `Enter ${field.label}.` };
    if (value.length > field.maxLength) return { error: `${field.label} is too long.` };
    if (value && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: `Enter a valid ${field.label}.` };
    if (value && field.key === "cashtag" && !/^\$[a-zA-Z][a-zA-Z0-9]{0,19}$/.test(value)) return { error: "Enter a valid $Cashtag." };
    if (value) lines.push(`${field.label}: ${value}`);
  }
  const destination = lines.join("\n");
  if (destination.length > 500) return { error: "Payout details are too long." };
  return { destination };
}
