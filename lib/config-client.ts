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
const rawPaymentTypes = process.env.NEXT_PUBLIC_ZPAY_PAYMENT_TYPES ?? "alipay"
const zpayPaymentTypes = rawPaymentTypes
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is typeof VALID_PAYMENT_TYPES[number] => (VALID_PAYMENT_TYPES as readonly string[]).includes(s))
    .filter(Boolean)

const rawDisabledTypes = process.env.NEXT_PUBLIC_ZPAY_DISABLED_PAYMENT_TYPES ?? ""
const zpayDisabledPaymentTypes = rawDisabledTypes
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is typeof VALID_PAYMENT_TYPES[number] => (VALID_PAYMENT_TYPES as readonly string[]).includes(s))

const rawInviteLinkDefaultCount = Number(process.env.NEXT_PUBLIC_INVITE_LINK_DEFAULT_COUNT)
const rawInviteLinkMaxCount = Number(process.env.NEXT_PUBLIC_INVITE_LINK_MAX_COUNT)

const supportTelegram = (process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM ?? "@Marcus_Kepler").trim()
const supportWechat = (process.env.NEXT_PUBLIC_SUPPORT_WECHAT ?? "Mashangbang0").trim()
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

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
     * z-pay开通的支付渠道列表，由 NEXT_PUBLIC_ZPAY_PAYMENT_TYPES 配置（逗号分隔）。
     * 默认只有 alipay。示例：NEXT_PUBLIC_ZPAY_PAYMENT_TYPES=alipay,wxpay
     */
    zpayPaymentTypes: zpayPaymentTypes.length > 0 ? zpayPaymentTypes : (["alipay"] as const),
    /** 禁用的支付渠道（界面上显示但置灰不可选） */
    zpayDisabledPaymentTypes: zpayDisabledPaymentTypes,
    /** 客服 Telegram 联系方式（@username 或完整 URL）；空字符串时隐藏 */
    supportTelegram,
    /** 客服微信号；空字符串时隐藏 */
    supportWechat,
    /** Cloudflare Turnstile 站点密钥（客户端），空字符串表示未启用 */
    turnstileSiteKey,
    /** 邀请链接：UI 默认注册人数，默认 1 */
    inviteLinkDefaultCount: Number.isInteger(rawInviteLinkDefaultCount) && rawInviteLinkDefaultCount >= 1 ? rawInviteLinkDefaultCount : 1,
    /** 邀请链接：单条链接最大注册人数上限，默认 50 */
    inviteLinkMaxCount: Number.isInteger(rawInviteLinkMaxCount) && rawInviteLinkMaxCount >= 1 ? rawInviteLinkMaxCount : 50,
}
