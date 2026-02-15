import { z } from "zod"

const envSchema = z
    .object({
        databaseUrl: z.string().min(1, "DATABASE_URL is required"),
        betterAuthSecret: z
            .string()
            .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
        betterAuthUrl: z.string().optional(),
        vercelUrl: z.string().optional(),
        nodeEnv: z.enum(["development", "production", "test"]).default("development"),
        siteName: z.string().min(1).default("Account Mall"),
        siteDescription: z.string().default("卡密自动发卡平台 - 即买即发，安全可靠"),
        siteTagline: z.string().default("数字商品，即买即发"),
        siteSubtitle: z.string().default("安全可靠的卡密自动发卡平台，支持多种数字商品类型"),
        adminPanelLabel: z.string().default("管理后台"),
        resendApiKey: z.string().optional(),
        emailFrom: z.string().default("Account Mall <onboarding@resend.dev>"),
        adminEmail: z.string().default("admin@example.com"),
        adminPassword: z.string().default("admin123456"),
        adminName: z.string().default("Admin"),
        alipayAppId: z.string().optional(),
        alipayPrivateKey: z.string().optional(),
        alipayPublicKey: z.string().optional(),
        cronSecret: z.string().optional(),
        pendingOrderTimeoutMs: z.coerce.number().int().positive().default(900000),
        orderRateLimitPoints: z.coerce.number().int().positive().default(10),
        orderQueryRateLimitPoints: z.coerce.number().int().positive().default(30),
        maxPendingOrdersPerIp: z.coerce.number().int().positive().default(6),
        orderSuccessTokenSecret: z.string().optional(),
    })
    .transform((data) => {
        const siteUrl =
            data.betterAuthUrl?.trim() ||
            (data.vercelUrl ? `https://${data.vercelUrl}` : "http://localhost:3000")
        return { ...data, siteUrl }
    })

function getEnvInput() {
    const e = process.env
    return {
        databaseUrl: e.DATABASE_URL,
        betterAuthSecret: e.BETTER_AUTH_SECRET,
        betterAuthUrl: e.BETTER_AUTH_URL,
        vercelUrl: e.VERCEL_URL,
        nodeEnv: e.NODE_ENV,
        siteName: e.SITE_NAME,
        siteDescription: e.SITE_DESCRIPTION,
        siteTagline: e.SITE_TAGLINE,
        siteSubtitle: e.SITE_SUBTITLE,
        adminPanelLabel: e.ADMIN_PANEL_LABEL,
        resendApiKey: e.RESEND_API_KEY,
        emailFrom: e.EMAIL_FROM,
        adminEmail: e.ADMIN_EMAIL,
        adminPassword: e.ADMIN_PASSWORD,
        adminName: e.ADMIN_NAME,
        alipayAppId: e.ALIPAY_APP_ID,
        alipayPrivateKey: e.ALIPAY_PRIVATE_KEY,
        alipayPublicKey: e.ALIPAY_PUBLIC_KEY,
        cronSecret: e.CRON_SECRET,
        pendingOrderTimeoutMs: e.PENDING_ORDER_TIMEOUT_MS,
        orderRateLimitPoints: e.ORDER_RATE_LIMIT_POINTS,
        orderQueryRateLimitPoints: e.ORDER_QUERY_RATE_LIMIT_POINTS,
        maxPendingOrdersPerIp: e.MAX_PENDING_ORDERS_PER_IP,
        orderSuccessTokenSecret: e.ORDER_SUCCESS_TOKEN_SECRET,
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
