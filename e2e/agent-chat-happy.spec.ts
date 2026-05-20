import { test, expect } from "@playwright/test"

test.skip(!process.env.E2E_AGENT_ENABLED, "agent e2e disabled")

test("访客打开 widget → 发消息 → 收到流式回复", async ({ page }) => {
    await page.goto("/")
    // 触发 fab popover
    await page.getByRole("button", { name: /联系客服|客服/ }).click()
    // welcome chips should be visible
    await expect(page.getByText(/我是 AI 客服/)).toBeVisible({ timeout: 10_000 })
    // click a suggested question
    await page.getByText("这个商品永久使用吗？").click()
    // wait for a streaming assistant message; AI SDK may have a small delay
    await expect(page.getByRole("article").nth(1)).toBeVisible({ timeout: 20_000 })
})
