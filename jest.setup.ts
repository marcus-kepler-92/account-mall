// Global test setup
// Note: @testing-library/jest-dom will be imported in component test files
// that use jsdom environment (via docblock: @jest-environment jsdom)

// Suppress expected console output during tests (notify routes, orders-id, restock-notify, etc.)
const noop = () => {}
jest.spyOn(console, "log").mockImplementation(noop)
jest.spyOn(console, "warn").mockImplementation(noop)
jest.spyOn(console, "error").mockImplementation(noop)

// Minimal config mock so modules that call getConfig() at load time don't throw ZodError
jest.mock("@/lib/config", () => {
    const mock = {
        databaseUrl: "postgresql://localhost:5432/test",
        betterAuthSecret: "x".repeat(32),
        siteUrl: "http://localhost:3000",
        nodeEnv: "test" as const,
        pendingOrderTimeoutMs: 900_000,
        basePromoDiscountPercent: 5,
        inviteLinkDefaultCount: 1,
        inviteLinkMaxCount: 50,
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
        agentChatTimeoutMs: 15000,
        agentSessionTtlDays: 90,
        agentTokenBudget: 2000,
        dailyInputCap: 3000000,
        dailyOutputCap: 800000,
        wechatQrUrl: "https://example.com/qr.png",
        wechatId: "test_wechat_id",
        escalateWebhookUrl: undefined,
        wecomWebhookUrl: undefined,
        dunCooldownMinutes: 30,
        dunMinAgeMinutes: 5,
        businessHoursWeekdays: undefined,
        upstashRedisRestUrl: "https://test.upstash.io",
        upstashRedisRestToken: "test-token",
        deepseekApiKey: "sk-test-deepseek-key",
        cronSecret: "test-cron-secret-min-16-chars-required",
    }
    return { config: mock, getConfig: () => mock }
})

// Default site-settings mock — mirrors the env-fallback values above so tools
// (collectWechat, escalateToHuman) and RSC pages (footer, terms, privacy) can
// resolve runtime settings without hitting the DB. Individual tests can
// override via jest.doMock("@/lib/site-settings", ...).
jest.mock("@/lib/site-settings", () => {
    const settings = {
        wechatQrUrl: "https://example.com/qr.png",
        wechatId: "test_wechat_id",
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
        businessName: "",
        businessLicenseNo: "",
        contactEmail: "",
        escalateWebhookUrl: undefined,
        wecomWebhookUrl: undefined,
        dunCooldownMinutes: 30,
        dunMinAgeMinutes: 5,
        businessHoursWeekdays: [0, 1, 2, 3, 4, 5, 6],
    }
    return {
        getSiteSettings: jest.fn().mockResolvedValue(settings),
        getSiteSettingRow: jest.fn().mockResolvedValue(null),
    }
})

// Mock better-auth/crypto to avoid ESM import issues in tests
jest.mock("better-auth/crypto", () => ({
    hashPassword: jest.fn().mockResolvedValue("hashed"),
}))

// next/cache is unusable in Jest: revalidateTag/revalidatePath throw "static
// generation store missing" outside a Next.js request context, and unstable_cache
// needs the same store. Stub them globally so route handlers that invalidate the
// storefront cache (lib/revalidate-storefront) run cleanly. Tests that inspect
// real cache keys (agent-persistence) override this with a file-level jest.mock.
jest.mock("next/cache", () => ({
    revalidateTag: jest.fn(),
    revalidatePath: jest.fn(),
    unstable_cache: (fn: unknown) => fn,
}))
