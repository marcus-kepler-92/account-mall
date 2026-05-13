import * as z from "zod";

function sanitizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.username) parsed.username = encodeURIComponent(decodeURIComponent(parsed.username))
    if (parsed.password) parsed.password = encodeURIComponent(decodeURIComponent(parsed.password))
    return parsed.toString()
  } catch {
    return url
  }
}

const envSchema = z
  .object({
    databaseUrl: z.string().min(1, "DATABASE_URL is required"),
    betterAuthSecret: z.string().optional(),
    betterAuthUrl: z.string().optional(),
    vercelUrl: z.string().optional(),
    nodeEnv: z
      .enum(["development", "production", "test"])
      .default("development"),
    siteName: z.string().min(1).default("Account Mall"),
    siteDescription: z
      .string()
      .default(
        "提供苹果ID购买服务，支持美区/港区/台区/韩区独享及共享空白账号。已购小火箭Shadowrocket账号登录App Store即可直接下载，24小时自动发货，安全稳定，即买即用。",
      ),
    siteTagline: z.string().default("苹果ID购买，小火箭空白号即买即发"),
    siteSubtitle: z
      .string()
      .default(
        "美区/港区/台区/韩区独享及共享空白账号，已购小火箭Shadowrocket，24小时自动发货。",
      ),
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
    pendingOrderTimeoutMs: z.coerce.number().int().positive().default(1800000),
    orderRateLimitPoints: z.coerce.number().int().positive().default(10),
    orderQueryRateLimitPoints: z.coerce.number().int().positive().default(30),
    maxPendingOrdersPerIp: z.coerce.number().int().positive().default(6),
    /** 订单成功页 token 签名，至少 16 位；未配置时开发环境用默认值 */
    orderSuccessTokenSecret: z.string().optional(),
    /** Cross-sell 折扣 token 签名密钥，至少 16 位 */
    crossSellTokenSecret: z.string().optional(),
    turnstileSiteKey: z.string().optional(),
    turnstileSecretKey: z.string().optional(),
    /** AUTO_FETCH：爬取结果缓存时间（毫秒），同一 sourceUrl 在此时间内复用 */
    autoFetchScrapeCacheTtlMs: z.coerce.number().int().min(0).default(60_000),
    /** AUTO_FETCH：爬取请求超时（毫秒） */
    autoFetchScrapeTimeoutMs: z.coerce
      .number()
      .int()
      .positive()
      .default(15_000),
    /** AUTO_FETCH：爬取请求 User-Agent（可选，默认常见 Chrome） */
    autoFetchScrapeUserAgent: z.string().optional(),
    /** AUTO_FETCH：同一 IP/邮箱 同一商品 领取冷却时间（小时），仅生产/测试环境生效 */
    autoFetchCooldownHours: z.coerce.number().positive().default(1),
    /** AUTO_FETCH：自动拉黑过期时间（小时），管理员手动拉黑不受影响 */
    blacklistExpiryHours: z.coerce.number().int().positive().default(12),
    /** AUTO_FETCH：全局爬取来源 URL 列表（逗号分隔；商品 sourceUrl 为空时取第一个；未配置时使用默认地址） */
    autoFetchSourceUrls: z
      .string()
      .optional()
      .or(z.literal(""))
      .default("https://id.ali-door.top/share/yedamai,https://ccbaohe.com/appleID/")
      .transform((s) => {
        if (!s || s === "") return ["https://id.ali-door.top/share/yedamai", "https://ccbaohe.com/appleID/"]
        return s
          .split(",")
          .map((u) => u.trim())
          .filter((u) => {
            try {
              new URL(u)
              return true
            } catch {
              return false
            }
          })
      }),
    /** AUTO_FETCH：单笔领取数量（固定为 1，可配置） */
    autoFetchMaxQuantityPerOrder: z.coerce.number().int().min(1).default(1),
    /** 推荐码/优惠码：最大长度（字符），用于校验与防抖校验 API */
    promoCodeMaxLength: z.coerce.number().int().min(1).max(256).default(64),
    /** 推荐码/优惠码：所有使用推荐码的客户默认享受的基础折扣比例（%），折扣成本从分销员佣金中扣除 */
    basePromoDiscountPercent: z.coerce.number().min(0).max(50).default(5),
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
    schemaReturnFees: z
      .enum(["FreeReturn", "ReturnShippingFees"])
      .default("FreeReturn"),
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
    /** 邀请链接：UI 默认注册人数，默认 1 */
    inviteLinkDefaultCount: z.coerce.number().int().min(1).default(1),
    /** 邀请链接：单条链接最大注册人数上限，默认 50 */
    inviteLinkMaxCount: z.coerce.number().int().min(1).default(50),
    /** Exit Intent 折扣：HMAC 签名密钥，生产环境必填 */
    exitDiscountSecret: z.string().optional(),
    /** Exit Intent 折扣：折扣比例（百分比），默认 5 表示 95 折 */
    exitDiscountPercent: z.coerce.number().min(1).max(50).default(5),
    /** Exit Intent 折扣：Token 有效期（毫秒），默认 15 分钟 */
    exitDiscountTtlMs: z.coerce.number().int().positive().default(900_000),
    /** 订单完成后是否发送发货邮件给买家，默认 false（不发送） */
    orderCompletionEmailEnabled: z
      .string()
      .optional()
            .transform((v) => v === "true" || v === "1")
            .default(false),
    /** 阿里云千问 API Key，AI 客服功能必填 */
    qwenApiKey: z.string().optional(),
    /** AUTO_FETCH：苹果账号管理平台基础 URL（voidlogins 类型商品使用） */
    appleHostingUrl: z.string().default("https://apple.voidlogins.com"),
    /** 支付订单描述（传给支付接口的 subject/name 字段），合规用途，不暴露具体商品名 */
    paymentSubjectLabel: z.string().default("信息技术服务费"),
    /** 合规页脚：经营者名称，留空则不展示 */
    businessName: z.string().default(""),
    /** 合规页脚：统一社会信用代码，留空则不展示 */
    businessLicenseNo: z.string().default(""),
    /** 合规页脚：对外联系邮箱，留空则不展示 */
    contactEmail: z.string().default(""),
  })
  .transform((data) => {
    const databaseUrl = sanitizeDatabaseUrl(data.databaseUrl.trim());

    const secret = data.betterAuthSecret?.trim();
    const minLen = 32;
    if (data.nodeEnv === "production") {
      if (!secret || secret.length < minLen) {
        throw new Error(
          "BETTER_AUTH_SECRET must be at least 32 characters in production",
        );
      }
    }
    const betterAuthSecret =
      secret && secret.length >= minLen
        ? secret
        : "dev-secret-at-least-32-characters-long";
    if (data.nodeEnv === "development" && (!secret || secret.length < minLen)) {
      warnOnce(
        "BETTER_AUTH_SECRET",
        "[config] BETTER_AUTH_SECRET missing or too short; using dev default. Set a 32+ character secret in .env for production.",
      )
    }
    const orderSuccessTokenRaw = data.orderSuccessTokenSecret?.trim();
    const orderSuccessTokenSecret =
      orderSuccessTokenRaw && orderSuccessTokenRaw.length >= 16
        ? orderSuccessTokenRaw
        : data.nodeEnv === "development"
          ? "dev-order-success-token-secret-32chars"
          : undefined;
    if (
      data.nodeEnv === "development" &&
      (!orderSuccessTokenRaw || orderSuccessTokenRaw.length < 16)
    ) {
      warnOnce(
        "ORDER_SUCCESS_TOKEN_SECRET",
        "[config] ORDER_SUCCESS_TOKEN_SECRET missing or too short; using dev default. Set 16+ chars in production.",
      )
    }
    const crossSellTokenRaw = data.crossSellTokenSecret?.trim();
    const crossSellTokenSecret =
      crossSellTokenRaw && crossSellTokenRaw.length >= 16
        ? crossSellTokenRaw
        : data.nodeEnv === "development"
          ? "dev-cross-sell-token-secret-32chars"
          : undefined;
    if (
      data.nodeEnv === "development" &&
      (!crossSellTokenRaw || crossSellTokenRaw.length < 16)
    ) {
      warnOnce(
        "CROSS_SELL_TOKEN_SECRET",
        "[config] CROSS_SELL_TOKEN_SECRET missing or too short; using dev default. Set 16+ chars in production.",
      )
    }
    const siteUrl =
      data.betterAuthUrl?.trim() ||
      (data.vercelUrl ? `https://${data.vercelUrl}` : "http://localhost:3000");
    return {
      ...data,
      databaseUrl,
      betterAuthSecret,
      siteUrl,
      orderSuccessTokenSecret,
      crossSellTokenSecret,
    };
  });

function getEnvInput() {
  const e = process.env;
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
    crossSellTokenSecret: e.CROSS_SELL_TOKEN_SECRET,
    turnstileSiteKey: e.TURNSTILE_SITE_KEY,
    turnstileSecretKey: e.TURNSTILE_SECRET_KEY,
    autoFetchScrapeCacheTtlMs:
      e.AUTO_FETCH_SCRAPE_CACHE_TTL_MS ?? e.FREE_SHARED_SCRAPE_CACHE_TTL_MS,
    autoFetchScrapeTimeoutMs:
      e.AUTO_FETCH_SCRAPE_TIMEOUT_MS ?? e.FREE_SHARED_SCRAPE_TIMEOUT_MS,
    autoFetchScrapeUserAgent:
      e.AUTO_FETCH_SCRAPE_USER_AGENT ?? e.FREE_SHARED_SCRAPE_USER_AGENT,
    autoFetchCooldownHours:
      e.AUTO_FETCH_COOLDOWN_HOURS ?? e.FREE_SHARED_COOLDOWN_HOURS,
    blacklistExpiryHours: e.BLACKLIST_EXPIRY_HOURS,
    autoFetchSourceUrls:
      e.AUTO_FETCH_SOURCE_URLS ?? e.AUTO_FETCH_SOURCE_URL ?? e.FREE_SHARED_SOURCE_URL,
    autoFetchMaxQuantityPerOrder:
      e.AUTO_FETCH_MAX_QUANTITY_PER_ORDER ??
      e.FREE_SHARED_MAX_QUANTITY_PER_ORDER,
    promoCodeMaxLength: e.PROMO_CODE_MAX_LENGTH,
    basePromoDiscountPercent: e.BASE_PROMO_DISCOUNT_PERCENT,
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
    inviteLinkDefaultCount: e.INVITE_LINK_DEFAULT_COUNT,
    inviteLinkMaxCount: e.INVITE_LINK_MAX_COUNT,
    exitDiscountSecret: e.EXIT_DISCOUNT_SECRET,
    exitDiscountPercent: e.EXIT_DISCOUNT_PERCENT,
    exitDiscountTtlMs: e.EXIT_DISCOUNT_TTL_MS,
    orderCompletionEmailEnabled: e.ORDER_COMPLETION_EMAIL_ENABLED,
    qwenApiKey: e.QWEN_API_KEY,
    appleHostingUrl: e.APPLE_HOSTING_URL,
    paymentSubjectLabel: e.PAYMENT_SUBJECT_LABEL,
    businessName: e.BUSINESS_NAME,
    businessLicenseNo: e.BUSINESS_LICENSE_NO,
    contactEmail: e.CONTACT_EMAIL,
  };
}

const _warnedFlags = new Set<string>()
function warnOnce(key: string, msg: string) {
  if (!_warnedFlags.has(key)) {
    _warnedFlags.add(key)
    console.warn(msg)
  }
}

function parseConfig(): z.infer<typeof envSchema> {
  return envSchema.parse(getEnvInput());
}

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config === null) {
    _config = parseConfig();
  }
  return _config;
}

export const config = getConfig();
