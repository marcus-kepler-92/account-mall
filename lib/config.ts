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
        /** 免费共享：爬取结果缓存时间（毫秒），同一 sourceUrl 在此时间内复用 */
        freeSharedScrapeCacheTtlMs: z.coerce.number().int().min(0).default(60_000),
        /** 免费共享：爬取请求超时（毫秒） */
        freeSharedScrapeTimeoutMs: z.coerce.number().int().positive().default(15_000),
        /** 免费共享：爬取请求 User-Agent（可选，默认常见 Chrome） */
        freeSharedScrapeUserAgent: z.string().optional(),
        /** 免费共享：同一 IP/邮箱 同一商品 领取冷却时间（小时），仅生产/测试环境生效 */
        freeSharedCooldownHours: z.coerce.number().positive().default(1),
        /** 免费共享：爬取来源 URL（环境变量配置，商品表不存；未配置时使用默认地址） */
        freeSharedSourceUrl: z
            .string()
            .optional()
            .or(z.literal(""))
            .refine((s) => !s || s === "" || (() => { try { new URL(s); return true } catch { return false } })(), { message: "Invalid URL" })
            .default("https://id.ali-door.top/share/yedamai"),
        /** 免费共享：单笔领取数量（固定为 1，可配置） */
        freeSharedMaxQuantityPerOrder: z.coerce.number().int().min(1).default(1),
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
        freeSharedScrapeCacheTtlMs: e.FREE_SHARED_SCRAPE_CACHE_TTL_MS,
        freeSharedScrapeTimeoutMs: e.FREE_SHARED_SCRAPE_TIMEOUT_MS,
        freeSharedScrapeUserAgent: e.FREE_SHARED_SCRAPE_USER_AGENT,
        freeSharedCooldownHours: e.FREE_SHARED_COOLDOWN_HOURS,
        freeSharedSourceUrl: e.FREE_SHARED_SOURCE_URL,
        freeSharedMaxQuantityPerOrder: e.FREE_SHARED_MAX_QUANTITY_PER_ORDER,
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
