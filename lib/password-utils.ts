import { randomBytes } from "crypto"

/**
 * Generates a cryptographically secure random password.
 * Uses rejection sampling to eliminate modulo bias.
 */
export function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const limit = 256 - (256 % chars.length) // reject values above this to eliminate bias
  const result: string[] = []
  while (result.length < length) {
    const bytes = randomBytes(length * 2)
    for (const b of bytes) {
      if (b < limit) {
        result.push(chars[b % chars.length])
        if (result.length === length) break
      }
    }
  }
  return result.join("")
}
