import { createHash } from "crypto"
import { config } from "@/lib/config"
import { prisma } from "@/lib/prisma"

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

/**
 * Lazy backfill: write `passwordFingerprint` on an order that currently lacks
 * one, after the caller has already successfully scrypt-verified the password.
 * The `where: { passwordFingerprint: null }` guard makes this idempotent — calls
 * against orders that already have a fingerprint are a no-op (count=0).
 *
 * Fire-and-forget: never blocks the caller's response. Errors are logged but
 * not propagated; the worst case is "fingerprint stays null this round" — the
 * legacy fallback will continue to handle the order.
 */
export async function backfillFingerprintIfMissing(
    orderId: string,
    email: string,
    password: string,
): Promise<void> {
    try {
        await prisma.order.updateMany({
            where: { id: orderId, passwordFingerprint: null },
            data: { passwordFingerprint: computePasswordFingerprint(email, password) },
        })
    } catch (err) {
        console.error("[fingerprint-backfill]", err)
    }
}
