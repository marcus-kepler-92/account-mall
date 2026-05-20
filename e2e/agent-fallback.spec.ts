import { test, expect } from "@playwright/test"
import { Redis } from "@upstash/redis"

test.skip(!process.env.E2E_AGENT_ENABLED, "agent e2e disabled")

const redis = new Redis({
    url:
        process.env.UPSTASH_REDIS_REST_URL ??
        process.env.KV_REST_API_URL ??
        "",
    token:
        process.env.UPSTASH_REDIS_REST_TOKEN ??
        process.env.KV_REST_API_TOKEN ??
        "",
})

test("日额度打满 → fallback QR", async ({ page }) => {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    await redis.set(`quota:day:in:${day}`, 10_000_000)
    try {
        await page.goto("/")
        await page.getByRole("button", { name: /联系客服|客服/ }).click()
        const composer = page.getByPlaceholder(/输入您的问题/)
        await composer.fill("hello")
        await composer.press("Enter")
        await expect(
            page.getByText(/客服暂时下班|今日免费咨询次数已达上限/),
        ).toBeVisible({ timeout: 15_000 })
    } finally {
        await redis.del(`quota:day:in:${day}`)
    }
})
