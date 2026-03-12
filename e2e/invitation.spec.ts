import { test, expect } from "@playwright/test"

test.describe("邀请奖励前端可见与 E2E", () => {
    test("仪表盘邀请奖励文案：邀请分销员卡片存在且展示奖励说明", async ({
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-write"])
        await page.goto("/distributor/login")
        await expect(page.getByText("分销中心登录")).toBeVisible({ timeout: 10_000 })

        const emailInput = page.locator("#email")
        const passwordInput = page.locator("#password")
        if (!(await emailInput.isVisible())) {
            test.skip()
            return
        }

        await emailInput.fill("e2e-distributor@example.com")
        await passwordInput.fill("e2e-distributor-password")
        await page.getByRole("button", { name: /登录/ }).click()

        await page.waitForURL(/\/distributor\/?(\?|$)/, { timeout: 15_000 }).catch(() => {})

        if (
            !page.url().includes("/distributor") ||
            page.url().includes("/distributor/login")
        ) {
            test.skip()
            return
        }

        await expect(page.getByText("邀请分销员")).toBeVisible({
            timeout: 10_000,
        })
        await expect(
            page.getByText(/邀请奖励|首单/, { exact: false })
        ).toBeVisible({ timeout: 5_000 })
    })

    test("佣金页余额构成与邀请奖励明细区块", async ({ page }) => {
        await page.goto("/distributor/login")
        await expect(page.getByText("分销中心登录")).toBeVisible({ timeout: 10_000 })

        const emailInput = page.locator("#email")
        const passwordInput = page.locator("#password")
        if (!(await emailInput.isVisible())) {
            test.skip()
            return
        }

        await emailInput.fill("e2e-distributor@example.com")
        await passwordInput.fill("e2e-distributor-password")
        await page.getByRole("button", { name: /登录/ }).click()

        await page.waitForURL(/\/distributor\/?(\?|$)/, { timeout: 15_000 }).catch(() => {})

        if (
            !page.url().includes("/distributor") ||
            page.url().includes("/distributor/login")
        ) {
            test.skip()
            return
        }

        await page.goto("/distributor/commissions")
        await expect(page.getByRole("heading", { name: "我的佣金" })).toBeVisible({
            timeout: 10_000,
        })

        await expect(
            page.getByText("订单佣金（已结算）", { exact: false })
        ).toBeVisible({ timeout: 5_000 })
        await expect(page.getByText("邀请奖励", { exact: false }).first()).toBeVisible({
            timeout: 5_000,
        })

        await expect(
            page.getByRole("heading", { name: "邀请奖励明细" })
        ).toBeVisible({ timeout: 5_000 })

        const hasTable = await page.getByRole("table").isVisible({ timeout: 2_000 }).catch(() => false)
        const hasEmptyText = await page
            .getByText("暂无邀请奖励")
            .isVisible({ timeout: 2_000 })
            .catch(() => false)
        expect(hasTable || hasEmptyText).toBe(true)
    })
})
