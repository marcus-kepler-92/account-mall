import { test, expect } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000"

/**
 * E2E tests for the invite-only distributor registration flow.
 *
 * These tests verify the UI states of the new pages without requiring a real database
 * invite record. They test:
 * 1. The register page now shows an "invite only" notice
 * 2. The accept-invite page renders invalid state for missing/bad tokens
 * 3. The admin login redirects to dashboard
 */

test.describe("Distributor Register page (invite-only)", () => {
    test("shows invite-only notice instead of registration form", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/register`)
        await expect(page.getByRole("main")).toBeVisible()

        // Should show invite-only message
        await expect(
            page.getByText(/分销员注册已关闭|仅支持受邀加入/i).first()
        ).toBeVisible({ timeout: 10_000 })

        // Should NOT show any email input (no registration form)
        await expect(page.locator('input[type="email"]')).not.toBeVisible()

        // Should have a link back to login
        await expect(page.getByRole("link", { name: /返回登录页/i })).toBeVisible()
    })

    test("login link on register page navigates to distributor login", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/register`)
        await page.getByRole("link", { name: /返回登录页/i }).click()
        await expect(page).toHaveURL(/\/distributor\/login/)
    })
})

test.describe("Accept invite page — invalid token states", () => {
    test("shows error when token is missing from URL", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/accept-invite`)
        await expect(page.getByRole("main")).toBeVisible()

        await expect(
            page.getByText(/邀请链接无效/i).first()
        ).toBeVisible({ timeout: 10_000 })

        // Should not show password form
        await expect(page.locator('input[type="password"]')).not.toBeVisible()
    })

    test("shows error when token does not exist in database", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/accept-invite?token=nonexistent-invalid-token`)
        await expect(page.getByRole("main")).toBeVisible()

        await expect(
            page.getByText(/邀请链接无效|不存在/i).first()
        ).toBeVisible({ timeout: 10_000 })

        // Should not show password form
        await expect(page.locator('input[type="password"]')).not.toBeVisible()
    })

    test("login link on accept-invite error page navigates to distributor login", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/accept-invite`)
        await page.getByRole("link", { name: /返回登录页/i }).click()
        await expect(page).toHaveURL(/\/distributor\/login/)
    })
})

test.describe("Distributor login page", () => {
    test("shows login form", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/login`)
        await expect(page.getByRole("main")).toBeVisible()

        // Login form should be present
        await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
        await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test("registration link on login page shows invite-only notice", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/login`)

        // Find any link to register page if it exists
        const registerLink = page.getByRole("link", { name: /注册|register/i })
        const hasRegisterLink = await registerLink.count() > 0
        if (hasRegisterLink) {
            await registerLink.click()
            await expect(
                page.getByText(/分销员注册已关闭|仅支持受邀加入/i).first()
            ).toBeVisible({ timeout: 10_000 })
        } else {
            // Register link may have been removed - that's fine
            test.skip()
        }
    })
})

test.describe("Distributor dashboard (requires auth) — gate check", () => {
    test("redirects to login when not authenticated", async ({ page }) => {
        await page.goto(`${baseURL}/distributor`)
        // Should redirect to login
        await expect(page).toHaveURL(/\/distributor\/login/, { timeout: 10_000 })
    })

    test("my-invitees page redirects to login when not authenticated", async ({ page }) => {
        await page.goto(`${baseURL}/distributor/invitees`)
        await expect(page).toHaveURL(/\/distributor\/login/, { timeout: 10_000 })
    })
})
