/** Automatic provider reconciliation interval. Realtime writes keep the UI
 * current between cycles, so RD must not be polled more often than this. */
export const RD_AUTO_SYNC_INTERVAL_MS = 15 * 60_000;
