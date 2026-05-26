/** Poll interval for token-based status (awaiting-payment + success page).
 * 30s is the right cadence — admin ship action is minutes-level, polling
 * faster wastes server cycles without helping UX. */
export const MANUAL_STATUS_POLL_INTERVAL_MS = 30_000

/** Poll interval for password-based detail polling (lookup Sheet). Lower
 * frequency because each call runs scrypt (~500ms). 60s strikes the right
 * balance between freshness and DB cost. */
export const MANUAL_DETAIL_POLL_INTERVAL_MS = 60_000

/** Maximum total polling duration. Buyer won't park here forever; after
 * 30 minutes we stop and require manual refresh. Prevents zombie tabs
 * accumulating server load. */
export const MANUAL_FULFILLMENT_POLL_MAX_DURATION_MS = 30 * 60_000
