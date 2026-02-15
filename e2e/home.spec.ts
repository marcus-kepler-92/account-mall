import { test, expect } from "@playwright/test"

test.describe("Homepage", () => {
    test("loads and shows storefront content", async ({ page }) => {
        await page.goto("/")
        await expect(page).toHaveTitle(/Account Mall|卡密|商城/i)
        const main = page.getByRole("main")
        await expect(main).toBeVisible()
        await expect(main).toContainText(/数字商品|即买即发|商品|Account Mall/i)
    })
})
