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
const lowStockThreshold =
    typeof process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD !== "undefined"
        ? Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD) || 5
        : 5

const VALID_PAYMENT_TYPES = ["alipay", "wxpay", "qqpay"] as const
const rawPaymentTypes = process.env.NEXT_PUBLIC_YIPAY_PAYMENT_TYPES ?? "alipay"
const yipayPaymentTypes = rawPaymentTypes
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is typeof VALID_PAYMENT_TYPES[number] => (VALID_PAYMENT_TYPES as readonly string[]).includes(s))
    .filter(Boolean)

const rawDisabledTypes = process.env.NEXT_PUBLIC_YIPAY_DISABLED_PAYMENT_TYPES ?? ""
const yipayDisabledPaymentTypes = rawDisabledTypes
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is typeof VALID_PAYMENT_TYPES[number] => (VALID_PAYMENT_TYPES as readonly string[]).includes(s))

export const configClient = {
    promoCodeMaxLength: Number.isInteger(promoCodeMaxLength) && promoCodeMaxLength >= 1 && promoCodeMaxLength <= 256
        ? promoCodeMaxLength
        : 64,
    promoValidateDebounceMs: Number.isInteger(promoValidateDebounceMs) && promoValidateDebounceMs >= 0
        ? promoValidateDebounceMs
        : 400,
    /** 低库存提示阈值：库存 <= 该值时显示"仅剩 X 件"警告 */
    lowStockThreshold: Number.isInteger(lowStockThreshold) && lowStockThreshold >= 0
        ? lowStockThreshold
        : 5,
    /**
     * 易支付开通的支付渠道列表，由 NEXT_PUBLIC_YIPAY_PAYMENT_TYPES 配置（逗号分隔）。
     * 默认只有 alipay。示例：NEXT_PUBLIC_YIPAY_PAYMENT_TYPES=alipay,wxpay
     */
    yipayPaymentTypes: yipayPaymentTypes.length > 0 ? yipayPaymentTypes : (["alipay"] as const),
    /** 禁用的支付渠道（界面上显示但置灰不可选） */
    yipayDisabledPaymentTypes: yipayDisabledPaymentTypes,
}
