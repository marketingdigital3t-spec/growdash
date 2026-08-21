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
};

const SUCCESSFUL_STATUSES = new Set([
  "paid", "success", "successful", "completed", "com_fundos", "with_funds",
]);

function isPaid(status?: string | null) {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return SUCCESSFUL_STATUSES.has(normalized) || normalized.includes("paid") || normalized.includes("fund");
}

function isPix(paymentMethod?: string | null) {
  return paymentMethod?.trim().toLowerCase().includes("pix") ?? false;
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
 * Consolidates the balance-delta history with explicit paid PIX top-ups.
 * A matching Meta balance event is ignored so funding is never counted twice.
 */
export function calculateTrafficFundsAdded(
  balanceEvents: BalanceFundingEvent[],
  transactions: AccountFundingTransaction[],
) {
  const paidPixTransactions = transactions.filter((transaction) => {
    const amount = Number(transaction.amount ?? 0);
    return Number.isFinite(amount) && amount > 0 && isPix(transaction.payment_method) && isPaid(transaction.status);
  });

  const unmatchedBalanceEvents = balanceEvents.filter((event) => {
    const amount = Number(event.delta ?? 0);
    return Number.isFinite(amount) && amount > 0
      && !paidPixTransactions.some((transaction) => isSameFundingEvent(event, transaction));
  });

  return [...unmatchedBalanceEvents, ...paidPixTransactions]
    .reduce((sum, item) => sum + Number("delta" in item ? item.delta : item.amount), 0);
}
