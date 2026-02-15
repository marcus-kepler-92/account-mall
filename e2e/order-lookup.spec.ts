import { test, expect } from "@playwright/test"

test.describe("Order lookup", () => {
    test("lookup page loads and shows error for invalid credentials", async ({
        page,
    }) => {
        await page.goto("/orders/lookup")
        await expect(page.getByRole("main")).toBeVisible()

        await page.getByPlaceholder(/例如：FAK|订单号/).fill("test-order-no-12345")
        await page.getByPlaceholder("下单时设置的查询密码").fill("wrongpassword")
        await page.getByRole("button", { name: "查询订单" }).click()

        await expect(
            page.getByText(/订单不存在或密码错误|Order not found|密码错误/i),
        ).toBeVisible({ timeout: 10_000 })
    })
})
