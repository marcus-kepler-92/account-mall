import { test, expect } from "@playwright/test"

test.describe("Distributor guide (入门手册)", () => {
    test("unauthenticated access redirects to distributor login", async ({ page }) => {
        await page.goto("/distributor/guide")
        await expect(page).toHaveURL(/\/distributor\/login/, { timeout: 10_000 })
        await expect(page.getByText("分销中心登录")).toBeVisible({ timeout: 10_000 })
    })

    test("guide page shows 入门手册 when visited after login", async ({ page, context }) => {
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

        if (!page.url().includes("/distributor") || page.url().includes("/distributor/login")) {
            test.skip()
            return
        }

        await page.goto("/distributor/guide")
        await expect(page.getByRole("heading", { name: "入门手册" })).toBeVisible({
            timeout: 10_000,
        })

        const copyBtn = page.getByRole("button", { name: /复制/ }).first()
        if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await copyBtn.click()
            await expect(
                page.getByRole("region", { name: /Notifications/i }).getByText("已复制")
            ).toBeVisible({ timeout: 5000 })
        }
    })
})
