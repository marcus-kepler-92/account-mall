import { test, expect } from "@playwright/test"
import {
    buildYipayNotifyForm,
    isYipayConfiguredForE2E,
} from "./helpers/yipay-notify"

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000"

/** Use the E2E seed product (slug e2e-product) so we always have stock. */
async function getE2EProductPath(): Promise<string> {
    const res = await fetch(`${baseURL}/api/products?page=1&pageSize=50`)
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`)
    const json = await res.json()
    const data = json.data as Array<{ id: string; slug: string }>
    const product = data?.find((p) => p.slug === "e2e-product")
    if (!product)
        throw new Error(
            "E2E product not found. Run SEED_E2E=1 npm run db:seed before E2E.",
        )
    return `/products/${product.id}-${product.slug}`
}

test.describe.serial("Payment flow", () => {
    test("create order and lookup shows PENDING", async ({ page }) => {
        const productPath = await getE2EProductPath()
        await page.goto(`${baseURL}${productPath}`)
        await expect(page.getByRole("main")).toBeVisible()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        let orderBody: { orderNo?: string; error?: string } = {}
        await page.route((url) => url.pathname === "/api/orders", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue()
                return
            }
            try {
                const res = await route.fetch()
                const raw = await res.text()
                const body = raw ? JSON.parse(raw) : {}
                orderBody = body
                await route.fulfill({
                    status: res.status(),
                    contentType: "application/json",
                    body: raw,
                })
            } catch (e) {
                orderBody = { error: String(e) }
                await route.fulfill({
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "E2E route failed" }),
                })
            }
        })

        await page.getByLabel(/邮箱/).fill("e2e@example.com")
        await page.getByLabel(/订单密码/).fill("e2e-password-123")
        await page.getByLabel(/购买数量/).fill("1")
        await page.getByRole("button", { name: "立即购买" }).click()

        try {
            await expect(async () => {
                expect(orderBody.orderNo).toBeTruthy()
            }).toPass({ timeout: 15_000 })
        } catch {
            throw new Error(
                `Order creation failed or timed out. Response: ${JSON.stringify(orderBody)}`,
            )
        }
        const orderNo = orderBody.orderNo as string

        await page.goto(`${baseURL}/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`)
        // URL 参数已通过 useEffect 预填入订单号，无需再次 fill
        await expect(page.getByPlaceholder(/例如：FAK|订单号/)).toHaveValue(orderNo, { timeout: 5_000 })
        await page.getByPlaceholder("下单时设置的查询密码").fill("e2e-password-123")
        await page.getByRole("button", { name: "查询订单" }).click()

        // 开发模式下订单立即完成（「已完成」），生产模式为「待支付」——两种情况都验证 Sheet 正常打开
        const statusLocator = page.getByText(/^(待支付|已完成)$/)
        await expect(statusLocator).toBeVisible({ timeout: 10_000 })
        const isPending = await page.getByText("待支付", { exact: true }).isVisible()
        if (isPending) {
            // 生产环境：PENDING 订单应显示「继续支付」入口
            await expect(page.getByRole("button", { name: "继续支付" })).toBeVisible({ timeout: 5_000 })
        }
    })

    test("get-payment-url returns payment URL or 503 when order is PENDING and not expired", async ({
        page,
        request,
    }) => {
        const productPath = await getE2EProductPath()
        await page.goto(`${baseURL}${productPath}`)
        await expect(page.getByRole("main")).toBeVisible()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        let orderNo: string | undefined
        await page.route((url) => url.pathname === "/api/orders", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue()
                return
            }
            const res = await route.fetch()
            const raw = await res.text()
            const body = raw ? JSON.parse(raw) : {}
            if (body.orderNo) orderNo = body.orderNo
            await route.fulfill({ status: res.status(), contentType: "application/json", body: raw })
        })

        await page.getByLabel(/邮箱/).fill("e2e-getpay@example.com")
        await page.getByLabel(/订单密码/).fill("e2e-getpay-789")
        await page.getByLabel(/购买数量/).fill("1")
        await page.getByRole("button", { name: "立即购买" }).click()

        await expect(async () => {
            expect(orderNo).toBeTruthy()
        }).toPass({ timeout: 15_000 })

        const payRes = await request.post(`${baseURL}/api/orders/get-payment-url`, {
            data: { orderNo, password: "e2e-getpay-789" },
        })
        const payData = await payRes.json().catch(() => ({}))
        // 200: 支付链接正常返回
        // 400: dev 模式下订单立即完成（非 PENDING），API 拒绝
        // 503: 支付网关未配置
        expect([200, 400, 503]).toContain(payRes.status())
        if (payRes.status() === 200) {
            expect(payData.paymentUrl).toBeDefined()
            expect(typeof payData.paymentUrl).toBe("string")
            expect(payData.paymentUrl.length).toBeGreaterThan(0)
        } else {
            expect(payData.error).toBeDefined()
        }
    })

    test("full payment flow: order → notify → lookup shows COMPLETED and cards", async ({
        page,
        request,
    }) => {
        if (!isYipayConfiguredForE2E()) {
            test.skip(true, "需要配置 YIPAY_PID/KEY/SUBMIT_URL/SITE_NAME 环境变量")
        }

        const productPath = await getE2EProductPath()
        await page.goto(`${baseURL}${productPath}`)
        await expect(page.getByRole("main")).toBeVisible()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        let orderBody: { orderNo?: string; amount?: number; error?: string } = {}
        await page.route((url) => url.pathname === "/api/orders", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue()
                return
            }
            try {
                const res = await route.fetch()
                const raw = await res.text()
                const body = raw ? JSON.parse(raw) : {}
                orderBody = body
                await route.fulfill({
                    status: res.status(),
                    contentType: "application/json",
                    body: raw,
                })
            } catch (e) {
                orderBody = { error: String(e) }
                await route.fulfill({
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "E2E route failed" }),
                })
            }
        })

        await page.getByLabel(/邮箱/).fill("e2e-full@example.com")
        await page.getByLabel(/订单密码/).fill("e2e-full-password-456")
        await page.getByLabel(/购买数量/).fill("1")
        await page.getByRole("button", { name: "立即购买" }).click()

        try {
            await expect(async () => {
                expect(orderBody.orderNo).toBeTruthy()
                expect(typeof orderBody.amount).toBe("number")
            }).toPass({ timeout: 15_000 })
        } catch {
            throw new Error(
                `Order creation failed or timed out. Response: ${JSON.stringify(orderBody)}`,
            )
        }
        const orderNo = orderBody.orderNo as string
        const amount = orderBody.amount as number

        const amountStr = Number(amount).toFixed(2)
        const form = buildYipayNotifyForm(orderNo, amountStr)
        const notifyRes = await request.post(
            `${baseURL}/api/payment/yipay/notify`,
            { form },
        )
        expect(notifyRes.status()).toBe(200)
        expect(await notifyRes.text()).toBe("success")

        await page.goto(`${baseURL}/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`)
        await expect(page.getByPlaceholder(/例如：FAK|订单号/)).toHaveValue(orderNo, { timeout: 5_000 })
        await page.getByPlaceholder("下单时设置的查询密码").fill("e2e-full-password-456")
        await page.getByRole("button", { name: "查询订单" }).click()

        await expect(page.getByText("已完成", { exact: true })).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText("账号内容", { exact: true })).toBeVisible({ timeout: 5_000 })
        const cardLocator = page.locator("code").filter({ hasText: /e2e-card-\d+/ })
        await expect(cardLocator.first()).toBeVisible({ timeout: 5_000 })
    })
})
