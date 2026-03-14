import * as z from "zod"

const envSchema = z
    .object({
        databaseUrl: z.string().optional(),
        postgresUser: z.string().optional(),
        postgresPassword: z.string().optional(),
        postgresDb: z.string().optional(),
        postgresHost: z.string().optional(),
        postgresPort: z.string().optional(),
        betterAuthSecret: z.string().optional(),
        betterAuthUrl: z.string().optional(),
        vercelUrl: z.string().optional(),
        nodeEnv: z.enum(["development", "production", "test"]).default("development"),
        siteName: z.string().min(1).default("Account Mall"),
        siteDescription: z.string().default("提供苹果ID购买、美区Apple ID及苹果账号购买服务，独享账号可绑定邮箱，即买即用、自动发货。支持未开通/已激活 iCloud、App Store 账号与苹果礼品卡，安全可靠。"),
        siteTagline: z.string().default("苹果ID购买与数字商品，即买即发"),
        siteSubtitle: z.string().default("美区苹果ID、苹果账号购买，独享即买即用，自动发货。"),
        siteKeywords: z.string().optional(),
        adminPanelLabel: z.string().default("管理后台"),
        resendApiKey: z.string().optional(),
        emailFrom: z.string().default("Account Mall <onboarding@resend.dev>"),
        adminEmail: z.string().default("admin@example.com"),
        adminPassword: z.string().default("admin123456"),
        adminName: z.string().default("Admin"),
        alipayAppId: z.string().optional(),
        alipayPrivateKey: z.string().optional(),
        alipayPublicKey: z.string().optional(),
        yipayPid: z.string().optional(),
        yipayKey: z.string().optional(),
        yipaySubmitUrl: z.string().optional(),
        yipaySiteName: z.string().optional(),
        cronSecret: z.string().optional(),
        pendingOrderTimeoutMs: z.coerce.number().int().positive().default(900000),
        orderRateLimitPoints: z.coerce.number().int().positive().default(10),
        orderQueryRateLimitPoints: z.coerce.number().int().positive().default(30),
        maxPendingOrdersPerIp: z.coerce.number().int().positive().default(6),
        /** 订单成功页 token 签名，至少 16 位；未配置时开发环境用默认值 */
        orderSuccessTokenSecret: z.string().optional(),
        turnstileSiteKey: z.string().optional(),
        turnstileSecretKey: z.string().optional(),
        /** AUTO_FETCH：爬取结果缓存时间（毫秒），同一 sourceUrl 在此时间内复用 */
        autoFetchScrapeCacheTtlMs: z.coerce.number().int().min(0).default(60_000),
        /** AUTO_FETCH：爬取请求超时（毫秒） */
        autoFetchScrapeTimeoutMs: z.coerce.number().int().positive().default(15_000),
        /** AUTO_FETCH：爬取请求 User-Agent（可选，默认常见 Chrome） */
        autoFetchScrapeUserAgent: z.string().optional(),
        /** AUTO_FETCH：同一 IP/邮箱 同一商品 领取冷却时间（小时），仅生产/测试环境生效 */
        autoFetchCooldownHours: z.coerce.number().positive().default(1),
        /** AUTO_FETCH：全局默认爬取来源 URL（商品 sourceUrl 为空时回退用；未配置时使用默认地址） */
        autoFetchSourceUrl: z
            .string()
            .optional()
            .or(z.literal(""))
            .refine((s) => !s || s === "" || (() => { try { new URL(s); return true } catch { return false } })(), { message: "Invalid URL" })
            .default("https://id.ali-door.top/share/yedamai"),
        /** AUTO_FETCH：单笔领取数量（固定为 1，可配置） */
        autoFetchMaxQuantityPerOrder: z.coerce.number().int().min(1).default(1),
        /** 推荐码/优惠码：最大长度（字符），用于校验与防抖校验 API */
        promoCodeMaxLength: z.coerce.number().int().min(1).max(256).default(64),
        /** 推荐码/优惠码：前端防抖校验延迟（毫秒），输入停止后多久发起校验 */
        promoValidateDebounceMs: z.coerce.number().int().min(0).default(400),
        /** Product JSON-LD：品牌名，用于 schema.org Brand */
        schemaBrandName: z.string().min(1).default("Apple"),
        /** Product JSON-LD：配送与退货政策适用国家 ISO 代码。面向中国用户填 CN；若主要客户在美国（如海外华人）填 US。与访问者 IP 无关。 */
        schemaShippingCountry: z.string().min(1).default("CN"),
        /** Product JSON-LD：运费金额，0 表示包邮 */
        schemaShippingValue: z.coerce.number().min(0).default(0),
        /** Product JSON-LD：退货天数 */
        schemaReturnDays: z.coerce.number().int().min(0).default(7),
        /** Product JSON-LD：退货是否免费，FreeReturn 或 ReturnShippingFees */
        schemaReturnFees: z.enum(["FreeReturn", "ReturnShippingFees"]).default("FreeReturn"),
        /** Product JSON-LD：价格有效天数（相对当前日期），用于 Offer.priceValidUntil */
        schemaPriceValidUntilDays: z.coerce.number().int().min(1).default(365),
        /** Product JSON-LD：发货处理天数上限（handlingTime.maxValue），单位天 */
        schemaDeliveryHandlingDays: z.coerce.number().int().min(0).default(1),
        /** Product JSON-LD：在途天数上限（transitTime.maxValue），单位天 */
        schemaDeliveryTransitDays: z.coerce.number().int().min(0).default(0),
        /** Product JSON-LD：退货方式，空则不输出 returnMethod；可选 ReturnByMail、ReturnInStore 等 */
        schemaReturnMethod: z.string().default(""),
        /** 分销员提现：单笔最低提现金额（元），默认 50 */
        withdrawalMinAmount: z.coerce.number().min(0.01).default(50),
        /** 分销员提现：平台服务手续费比例（百分比），默认 2 表示 2%；0 表示不收手续费 */
        withdrawalFeePercent: z.coerce.number().min(0).max(50).default(2),
        /** 二级佣金比例（百分比），从一级佣金总额中按比例分出给上线，不增加平台总支出。如 20 表示上线拿佣金的 20%，下线实得 80%；默认 20 */
        level2CommissionRatePercent: z.coerce.number().min(0).max(50).default(20),
        /** 分销员邀请链接有效期（天），默认 7 天 */
        distributorInviteTtlDays: z.coerce.number().int().min(1).max(30).default(7),
        /** Exit Intent 折扣：HMAC 签名密钥，生产环境必填 */
        exitDiscountSecret: z.string().optional(),
        /** Exit Intent 折扣：折扣比例（百分比），默认 5 表示 95 折 */
        exitDiscountPercent: z.coerce.number().min(1).max(50).default(5),
        /** Exit Intent 折扣：Token 有效期（毫秒），默认 15 分钟 */
        exitDiscountTtlMs: z.coerce.number().int().positive().default(900_000),
    })
    .transform((data) => {
        const urlFromEnv = data.databaseUrl?.trim()
        const user = data.postgresUser?.trim()
        const password = data.postgresPassword
        const db = data.postgresDb?.trim()
        const host = data.postgresHost?.trim() || "localhost"
        const port = data.postgresPort?.trim() || "5432"
        const databaseUrl =
            urlFromEnv ||
            (user && db
                ? `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password ?? "")}@${host}:${port}/${encodeURIComponent(db)}`
                : "")
        if (!databaseUrl) {
            throw new Error(
                "Set DATABASE_URL or (POSTGRES_USER + POSTGRES_DB and optionally POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT)",
            )
        }

        const secret = data.betterAuthSecret?.trim()
        const minLen = 32
        if (data.nodeEnv === "production") {
            if (!secret || secret.length < minLen) {
                throw new Error("BETTER_AUTH_SECRET must be at least 32 characters in production")
            }
        }
        const betterAuthSecret =
            secret && secret.length >= minLen
                ? secret
                : "dev-secret-at-least-32-characters-long"
        if (data.nodeEnv === "development" && (!secret || secret.length < minLen)) {
            console.warn(
                "[config] BETTER_AUTH_SECRET missing or too short; using dev default. Set a 32+ character secret in .env for production.",
            )
        }
        const orderSuccessTokenRaw = data.orderSuccessTokenSecret?.trim()
        const orderSuccessTokenSecret =
            orderSuccessTokenRaw && orderSuccessTokenRaw.length >= 16
                ? orderSuccessTokenRaw
                : data.nodeEnv === "development"
                  ? "dev-order-success-token-secret-32chars"
                  : undefined
        if (
            data.nodeEnv === "development" &&
            (!orderSuccessTokenRaw || orderSuccessTokenRaw.length < 16)
        ) {
            console.warn(
                "[config] ORDER_SUCCESS_TOKEN_SECRET missing or too short; using dev default. Set 16+ chars in production.",
            )
        }
        const siteUrl =
            data.betterAuthUrl?.trim() ||
            (data.vercelUrl ? `https://${data.vercelUrl}` : "http://localhost:3000")
        return { ...data, databaseUrl, betterAuthSecret, siteUrl, orderSuccessTokenSecret }
    })

function getEnvInput() {
    const e = process.env
    return {
        databaseUrl: e.DATABASE_URL,
        postgresUser: e.POSTGRES_USER,
        postgresPassword: e.POSTGRES_PASSWORD,
        postgresDb: e.POSTGRES_DB,
        postgresHost: e.POSTGRES_HOST,
        postgresPort: e.POSTGRES_PORT,
        betterAuthSecret: e.BETTER_AUTH_SECRET,
        betterAuthUrl: e.BETTER_AUTH_URL,
        vercelUrl: e.VERCEL_URL,
        nodeEnv: e.NODE_ENV,
        siteName: e.SITE_NAME,
        siteDescription: e.SITE_DESCRIPTION,
        siteTagline: e.SITE_TAGLINE,
        siteSubtitle: e.SITE_SUBTITLE,
        siteKeywords: e.SITE_KEYWORDS,
        adminPanelLabel: e.ADMIN_PANEL_LABEL,
        resendApiKey: e.RESEND_API_KEY,
        emailFrom: e.EMAIL_FROM,
        adminEmail: e.ADMIN_EMAIL,
        adminPassword: e.ADMIN_PASSWORD,
        adminName: e.ADMIN_NAME,
        alipayAppId: e.ALIPAY_APP_ID,
        alipayPrivateKey: e.ALIPAY_PRIVATE_KEY,
        alipayPublicKey: e.ALIPAY_PUBLIC_KEY,
        yipayPid: e.YIPAY_PID,
        yipayKey: e.YIPAY_KEY,
        yipaySubmitUrl: e.YIPAY_SUBMIT_URL,
        yipaySiteName: e.YIPAY_SITE_NAME,
        cronSecret: e.CRON_SECRET,
        pendingOrderTimeoutMs: e.PENDING_ORDER_TIMEOUT_MS,
        orderRateLimitPoints: e.ORDER_RATE_LIMIT_POINTS,
        orderQueryRateLimitPoints: e.ORDER_QUERY_RATE_LIMIT_POINTS,
        maxPendingOrdersPerIp: e.MAX_PENDING_ORDERS_PER_IP,
        orderSuccessTokenSecret: e.ORDER_SUCCESS_TOKEN_SECRET,
        turnstileSiteKey: e.TURNSTILE_SITE_KEY,
        turnstileSecretKey: e.TURNSTILE_SECRET_KEY,
        autoFetchScrapeCacheTtlMs: e.AUTO_FETCH_SCRAPE_CACHE_TTL_MS ?? e.FREE_SHARED_SCRAPE_CACHE_TTL_MS,
        autoFetchScrapeTimeoutMs: e.AUTO_FETCH_SCRAPE_TIMEOUT_MS ?? e.FREE_SHARED_SCRAPE_TIMEOUT_MS,
        autoFetchScrapeUserAgent: e.AUTO_FETCH_SCRAPE_USER_AGENT ?? e.FREE_SHARED_SCRAPE_USER_AGENT,
        autoFetchCooldownHours: e.AUTO_FETCH_COOLDOWN_HOURS ?? e.FREE_SHARED_COOLDOWN_HOURS,
        autoFetchSourceUrl: e.AUTO_FETCH_SOURCE_URL ?? e.FREE_SHARED_SOURCE_URL,
        autoFetchMaxQuantityPerOrder: e.AUTO_FETCH_MAX_QUANTITY_PER_ORDER ?? e.FREE_SHARED_MAX_QUANTITY_PER_ORDER,
        promoCodeMaxLength: e.PROMO_CODE_MAX_LENGTH,
        promoValidateDebounceMs: e.PROMO_VALIDATE_DEBOUNCE_MS,
        schemaBrandName: e.SCHEMA_BRAND_NAME,
        schemaShippingCountry: e.SCHEMA_SHIPPING_COUNTRY,
        schemaShippingValue: e.SCHEMA_SHIPPING_VALUE,
        schemaReturnDays: e.SCHEMA_RETURN_DAYS,
        schemaReturnFees: e.SCHEMA_RETURN_FEES,
        schemaPriceValidUntilDays: e.SCHEMA_PRICE_VALID_UNTIL_DAYS,
        schemaDeliveryHandlingDays: e.SCHEMA_DELIVERY_HANDLING_DAYS,
        schemaDeliveryTransitDays: e.SCHEMA_DELIVERY_TRANSIT_DAYS,
        schemaReturnMethod: e.SCHEMA_RETURN_METHOD,
        withdrawalMinAmount: e.WITHDRAWAL_MIN_AMOUNT,
        withdrawalFeePercent: e.WITHDRAWAL_FEE_PERCENT,
        level2CommissionRatePercent: e.LEVEL2_COMMISSION_RATE_PERCENT,
        distributorInviteTtlDays: e.DISTRIBUTOR_INVITE_TTL_DAYS,
        exitDiscountSecret: e.EXIT_DISCOUNT_SECRET,
        exitDiscountPercent: e.EXIT_DISCOUNT_PERCENT,
        exitDiscountTtlMs: e.EXIT_DISCOUNT_TTL_MS,
    }
}

function parseConfig(): z.infer<typeof envSchema> {
    return envSchema.parse(getEnvInput())
}

export type Config = z.infer<typeof envSchema>

let _config: Config | null = null

export function getConfig(): Config {
    if (_config === null) {
        _config = parseConfig()
    }
    return _config
}

export const config = getConfig()
