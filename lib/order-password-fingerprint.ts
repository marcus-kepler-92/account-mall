import { createHash } from "crypto"
import { config } from "@/lib/config"

/**
 * SHA-256 pre-filter hash used to narrow lookup-by-email candidates before the
 * expensive scrypt verifyPassword. Format:
 *
 *   sha256( lower(trim(email)) + ":" + password + ":" + LOOKUP_FINGERPRINT_PEPPER )
 *
 * Properties:
 * - Deterministic: same inputs always produce the same hash, so an indexed
 *   `(email, passwordFingerprint)` lookup returns the buyer's own orders.
 * - Not authoritative: passwordHash + verifyPassword remain the source of truth;
 *   the fingerprint only narrows the candidate set.
 * - Peppered with a stable env value to prevent rainbow-table style lookups
 *   against the index column. Rotating the pepper invalidates all existing
 *   fingerprints; rotation should be paired with a backfill plan.
 *
 * Backfill: cleartext passwords are never stored, so legacy orders cannot be
 * back-filled. Those rows remain `passwordFingerprint = null` and are reached
 * via the legacy fallback in lookup-by-email/route.ts (capped at 10 candidates).
 */
const PEPPER = config.lookupFingerprintPepper

export function computePasswordFingerprint(email: string, password: string): string {
    return createHash("sha256")
        .update(`${email.trim().toLowerCase()}:${password}:${PEPPER}`)
        .digest("hex")
}
