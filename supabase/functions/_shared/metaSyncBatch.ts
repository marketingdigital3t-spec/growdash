type AccountSyncAge = {
  id: string;
  last_sync_attempt_at?: string | null;
  last_sync_success_at?: string | null;
};

function syncAge(account: AccountSyncAge) {
  const value = account.last_sync_attempt_at || account.last_sync_success_at;
  const timestamp = value ? Date.parse(value) : Number.NEGATIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/**
 * Rotates connected accounts through the five-minute worker. Previously one
 * invocation fanned out to every account and exhausted Edge/API rate limits,
 * leaving later accounts without a fresh action snapshot. Oldest/never-tried
 * accounts always go first, so accounts added later join the same rotation.
 */
export function selectMetaAccountSyncBatch<T extends AccountSyncAge>(accounts: T[], batchSize: number) {
  const ordered = [...accounts].sort((left, right) =>
    syncAge(left) - syncAge(right) || left.id.localeCompare(right.id));
  return {
    selected: ordered.slice(0, Math.max(0, batchSize)),
    deferred: ordered.slice(Math.max(0, batchSize)),
  };
}

export function markDeferredMetaAccountCoverage<T extends {
  ok: boolean;
  status: number;
  body?: Record<string, unknown>;
}>(result: T, totalAccounts: number, processedAccounts: number, deferredAccounts: number): T {
  if (deferredAccounts <= 0) {
    return {
      ...result,
      body: {
        ...(result.body || {}),
        connected_accounts_total: totalAccounts,
        accounts_processed: processedAccounts,
        accounts_deferred: 0,
      },
    };
  }

  return {
    ...result,
    ok: false,
    status: 207,
    body: {
      ...(result.body || {}),
      success: false,
      status: "partial",
      connected_accounts_total: totalAccounts,
      accounts_processed: processedAccounts,
      accounts_deferred: deferredAccounts,
    },
  };
}
