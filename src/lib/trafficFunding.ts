export type BalanceFundingEvent = {
  ad_account_id: string;
  delta: number | string | null;
  event_at: string;
};

export type AccountFundingTransaction = {
  ad_account_id: string;
  amount: number | string | null;
  time: string;
  payment_method?: string | null;
  status?: string | null;
  billing_reason?: string | null;
};

export type TrafficFundingSummary = {
  confirmedTotal: number;
  pendingTotal: number;
  spendTotal: number;
  availableBalance: number | null;
  byPaymentMethod: Record<string, number>;
};

const SUCCESSFUL_STATUSES = new Set([
  "paid", "success", "successful", "completed", "com_fundos", "with_funds",
]);

function isPaid(status?: string | null) {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return SUCCESSFUL_STATUSES.has(normalized) || normalized.includes("paid") || normalized.includes("fund");
}

function isPending(status?: string | null) {
  return /pending|pendente|processing|open|await/i.test(status?.trim().toLowerCase() ?? "");
}

export function isMetaFundingTransaction(transaction: { payment_method?: string | null; billing_reason?: string | null }) {
  const reason = transaction.billing_reason?.trim().toLowerCase() ?? "";
  if (!reason) return true;
  if (/(fund|top.?up|pre.?paid|payment|manual|pix|boleto|card|credit)/i.test(reason)) return true;
  return !/(ad|spend|charge|invoice|advertis)/i.test(reason);
}

/** Converts Meta's payment_option values to the stable Finance labels. */
export function normalizeMetaPaymentMethod(paymentMethod?: string | null) {
  const normalized = paymentMethod?.trim().toLowerCase() ?? "";
  if (!normalized) return "nao_informado";
  if (normalized.includes("pix")) return "pix";
  if (normalized.includes("boleto")) return "boleto";
  if (normalized.includes("prepay") || normalized.includes("pre_pay") || normalized.includes("pre-paid") || normalized.includes("prepaid") || normalized.includes("funding")) return "saldo_pre_pago";
  if (normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) return "cartao";
  return "nao_informado";
}

export function buildTrafficFundingSummary(
  transactions: Array<{ amount: number | string | null; payment_method?: string | null; status?: string | null }>,
  spendTotal: number,
  availableBalance: number | null,
): TrafficFundingSummary {
  const summary: TrafficFundingSummary = {
    confirmedTotal: 0,
    pendingTotal: 0,
    spendTotal: Number(spendTotal || 0),
    availableBalance: availableBalance == null ? null : Number(availableBalance),
    byPaymentMethod: {},
  };
  for (const transaction of transactions) {
    const amount = Number(transaction.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!isMetaFundingTransaction(transaction)) continue;
    if (isPending(transaction.status)) {
      summary.pendingTotal += amount;
      continue;
    }
    if (!isPaid(transaction.status)) continue;
    summary.confirmedTotal += amount;
    const method = normalizeMetaPaymentMethod(transaction.payment_method);
    summary.byPaymentMethod[method] = (summary.byPaymentMethod[method] ?? 0) + amount;
  }
  return summary;
}

function isSameFundingEvent(
  event: BalanceFundingEvent,
  transaction: AccountFundingTransaction,
) {
  if (event.ad_account_id !== transaction.ad_account_id) return false;
  const eventAmount = Number(event.delta ?? 0);
  const transactionAmount = Number(transaction.amount ?? 0);
  if (Math.abs(eventAmount - transactionAmount) > 0.01) return false;
  const eventTime = new Date(event.event_at).getTime();
  const transactionTime = new Date(transaction.time).getTime();
  // Meta can acknowledge a paid PIX after it was registered manually. Treat
  // same-account, same-value records within three days as one funding event.
  return Number.isFinite(eventTime) && Number.isFinite(transactionTime)
    && Math.abs(eventTime - transactionTime) <= 3 * 24 * 60 * 60 * 1000;
}

/**
 * Consolidates the balance-delta history with explicit paid Meta top-ups.
 * A matching Meta balance event is ignored so funding is never counted twice.
 */
export function calculateTrafficFundsAdded(
  balanceEvents: BalanceFundingEvent[],
  transactions: AccountFundingTransaction[],
) {
  const paidTransactions = transactions.filter((transaction) => {
    const amount = Number(transaction.amount ?? 0);
    return Number.isFinite(amount) && amount > 0 && isPaid(transaction.status) && isMetaFundingTransaction(transaction);
  });

  const unmatchedBalanceEvents = balanceEvents.filter((event) => {
    const amount = Number(event.delta ?? 0);
    return Number.isFinite(amount) && amount > 0
      && !paidTransactions.some((transaction) => isSameFundingEvent(event, transaction));
  });

  return [...unmatchedBalanceEvents, ...paidTransactions]
    .reduce((sum, item) => sum + Number("delta" in item ? item.delta : item.amount), 0);
}
