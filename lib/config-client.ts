/**
 * Client-safe config: only values that are needed in the browser.
 * Do not import lib/config in "use client" code — it runs server-only validation (e.g. DATABASE_URL).
 * Use NEXT_PUBLIC_* to override at build time if needed.
 */
const promoCodeMaxLength =
    typeof process.env.NEXT_PUBLIC_PROMO_CODE_MAX_LENGTH !== "undefined"
        ? Number(process.env.NEXT_PUBLIC_PROMO_CODE_MAX_LENGTH) || 64
        : 64
const promoValidateDebounceMs =
    typeof process.env.NEXT_PUBLIC_PROMO_VALIDATE_DEBOUNCE_MS !== "undefined"
        ? Number(process.env.NEXT_PUBLIC_PROMO_VALIDATE_DEBOUNCE_MS) || 400
        : 400

export const configClient = {
    promoCodeMaxLength: Number.isInteger(promoCodeMaxLength) && promoCodeMaxLength >= 1 && promoCodeMaxLength <= 256
        ? promoCodeMaxLength
        : 64,
    promoValidateDebounceMs: Number.isInteger(promoValidateDebounceMs) && promoValidateDebounceMs >= 0
        ? promoValidateDebounceMs
        : 400,
}
