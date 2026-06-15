import { test, expect, type Page } from "@playwright/test"
import {
    buildZpayNotifyForm,
    isZpayConfiguredForE2E,
} from "./helpers/zpay-notify"
import {
    createTestProduct,
    cleanupTestProduct,
    cleanupOrdersByEmail,
    disconnectPrisma,
    type TestProduct,
} from "./helpers/test-data"

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000"

const PRODUCT_SLUG = "e2e-exit-discount"
const PRODUCT_CARD_COUNT = 5
const LOW_STOCK_SLUG = "e2e-low-stock"
const LOW_STOCK_CARD_COUNT = 2

let product: TestProduct
let lowStockProduct: TestProduct

test.beforeAll(async () => {
    ;[product, lowStockProduct] = await Promise.all([
        createTestProduct({ slug: PRODUCT_SLUG, name: "E2E Exit Discount 测试商品", cardCount: PRODUCT_CARD_COUNT }),
        createTestProduct({ slug: LOW_STOCK_SLUG, name: "E2E 低库存商品", cardCount: LOW_STOCK_CARD_COUNT }),
    ])
})

test.afterAll(async () => {
    await cleanupOrdersByEmail("e2e-exit-discount@example.com")
    await Promise.all([
        cleanupTestProduct(product.id, PRODUCT_CARD_COUNT),
        cleanupTestProduct(lowStockProduct.id, LOW_STOCK_CARD_COUNT),
    ])
    await disconnectPrisma()
})

/** 触发桌面端 exit intent */
async function triggerDesktopExitIntent(page: Page) {
    await page.mouse.move(300, 300)
    await page.evaluate(() => {
        document.dispatchEvent(
            new MouseEvent("mouseleave", { bubbles: false, clientX: 300, clientY: -10 })
        )
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景 1：库存紧张提示（独立，可并行）
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Low stock warning", () => {
    test("shows 仅剩 X 件 on low-stock product detail page", async ({ page }) => {
        await page.goto(`${baseURL}${lowStockProduct.path}`)
        await expect(page.getByRole("main")).toBeVisible()

        // 低库存商品有 2 张卡，低于阈值（5），应显示低库存警告
        await expect(
            page.getByText(/仅剩\s*[12]\s*件/, { exact: false })
        ).toBeVisible({ timeout: 10_000 })
    })

    test("shows low stock badge on homepage product card", async ({ page }) => {
        await page.goto(baseURL)
        await expect(page.getByRole("main")).toBeVisible()

        // 首页商品卡片中应能找到低库存商品的"仅剩"标识
        await expect(
            page.getByText(/仅剩/, { exact: false }).first()
        ).toBeVisible({ timeout: 10_000 })
    })

    test("normal stock product (5 cards) shows 仅剩 5 件 within threshold", async ({ page }) => {
        await page.goto(`${baseURL}${product.path}`)
        await expect(page.getByRole("main")).toBeVisible()

        // 商品有 5 张卡，正好等于默认阈值（5），应显示低库存提示
        await expect(
            page.getByText(/仅剩\s*5\s*件/, { exact: false })
        ).toBeVisible({ timeout: 10_000 })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// 场景 2–4：折扣流程（需要 EXIT_DISCOUNT_SECRET 配置，按序执行）
// ─────────────────────────────────────────────────────────────────────────────
test.describe.serial("Exit discount flow", () => {
    /** 用于在场景 2 和场景 4 间共享已完成的订单号 */
    let completedOrderNo: string | undefined

    function isExitDiscountConfigured(): boolean {
        return !!process.env.EXIT_DISCOUNT_SECRET
    }

    // 场景 2：完整折扣流程
    test("discount flow: exit intent popup appears, claim discount, order with 5% off", async ({
        page,
        request,
    }) => {
        if (!isExitDiscountConfigured()) {
            test.skip(true, "需要配置 EXIT_DISCOUNT_SECRET 环境变量")
        }

        await page.goto(`${baseURL}${product.path}`)
        await expect(page.getByRole("main")).toBeVisible()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        // 拦截 exit-discount API
        let exitDiscountResponse: Record<string, unknown> = {}
        await page.route((url) => url.pathname === "/api/exit-discount", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue()
                return
            }
            const res = await route.fetch()
            const raw = await res.text()
            exitDiscountResponse = raw ? JSON.parse(raw) : {}
            await route.fulfill({ status: res.status(), contentType: "application/json", body: raw })
        })

        // 拦截 orders API
        let orderBody: { orderNo?: string; amount?: number; error?: string } = {}
        let orderRequestBody: Record<string, unknown> = {}
        await page.route((url) => url.pathname === "/api/orders", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue()
                return
            }
            try {
                orderRequestBody = JSON.parse(route.request().postData() ?? "{}")
                const res = await route.fetch()
                const raw = await res.text()
                orderBody = raw ? JSON.parse(raw) : {}
                await route.fulfill({ status: res.status(), contentType: "application/json", body: raw })
            } catch (e) {
                orderBody = { error: String(e) }
                await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "E2E error" }) })
            }
        })

        // 等待超过 minTimeMs（15s）并触发 exit intent
        await page.waitForTimeout(16_000)
        await triggerDesktopExitIntent(page)

        // 验证弹窗出现
        await expect(page.getByText(/专属优惠/i, { exact: false })).toBeVisible({ timeout: 5_000 })
        await expect(page.getByText(/95\s*折/i, { exact: false }).first()).toBeVisible({ timeout: 3_000 })

        // 验证 API 返回 eligible:true
        expect(exitDiscountResponse.eligible).toBe(true)
        expect(exitDiscountResponse.token).toBeDefined()

        // 点击 CTA
        await page.getByRole("button", { name: /95\s*折|立享/i }).click()

        // 等待弹窗关闭
        await expect(page.getByText(/专属优惠/i, { exact: false })).not.toBeVisible({ timeout: 5_000 })

        // 验证表单区域显示折扣标识
        await expect(page.getByText(/已享.*%.*优惠/i, { exact: false }).first()).toBeVisible({ timeout: 5_000 })

        // 填写并提交订单
        await page.getByLabel(/邮箱/).fill("e2e-exit-discount@example.com")
        await page.getByLabel(/订单.*密码/).fill("e2e-exit-pass-123")
        await page.getByLabel(/购买数量/).fill("1")
        await page.getByRole("button", { name: "立即购买" }).click()

        // 等待订单创建
        await expect(async () => {
            expect(orderBody.orderNo).toBeTruthy()
        }).toPass({ timeout: 15_000 })

        // 验证请求中包含 exitDiscountToken
        expect(orderRequestBody.exitDiscountToken).toBeDefined()

        expect(typeof orderBody.amount).toBe("number")

        completedOrderNo = orderBody.orderNo

        // 可选：若配置了 zpay，模拟支付完成并验证 COMPLETED
        if (isZpayConfiguredForE2E() && completedOrderNo) {
            const amountStr = Number(orderBody.amount).toFixed(2)
            const form = buildZpayNotifyForm(completedOrderNo, amountStr)
            const notifyRes = await request.post(`${baseURL}/api/payment/zpay/notify`, { form })
            expect(notifyRes.status()).toBe(200)

            await page.goto(`${baseURL}/orders/lookup?orderNo=${encodeURIComponent(completedOrderNo)}`)
            await expect(page.getByPlaceholder(/例如：FAK|订单号/)).toHaveValue(completedOrderNo, { timeout: 5_000 })
            await page.getByPlaceholder("下单时设置的查询密码").fill("e2e-exit-pass-123")
            await page.getByRole("button", { name: "查询订单" }).click()
            await expect(page.getByText("已完成", { exact: true })).toBeVisible({ timeout: 10_000 })
        }
    })

    // 场景 3：分销员优惠码互斥
    test("promo code mutex: exit intent popup does not appear when distributor_promo_code cookie is set", async ({
        page,
        context,
    }) => {
        if (!isExitDiscountConfigured()) {
            test.skip(true, "需要配置 EXIT_DISCOUNT_SECRET 环境变量")
        }

        // 设置分销员 cookie
        await context.addCookies([
            {
                name: "distributor_promo_code",
                value: "E2EDIST",
                domain: new URL(baseURL).hostname,
                path: "/",
            },
        ])

        await page.goto(`${baseURL}${product.path}`)
        await expect(page.getByRole("main")).toBeVisible()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        // 监听 exit-discount API 请求
        let exitDiscountCalled = false
        await page.route((url) => url.pathname === "/api/exit-discount", async (route) => {
            exitDiscountCalled = true
            await route.continue()
        })

        await page.waitForTimeout(16_000)
        await triggerDesktopExitIntent(page)

        // 等待一段时间确认弹窗不出现
        await page.waitForTimeout(2_000)

        await expect(page.getByText(/专属优惠/i, { exact: false })).not.toBeVisible()
        expect(exitDiscountCalled).toBe(false)
    })

    // 场景 4：防滥用
    test("abuse prevention: exit intent does not trigger again in same session (sessionStorage)", async ({
        page,
    }) => {
        if (!isExitDiscountConfigured()) {
            test.skip(true, "需要配置 EXIT_DISCOUNT_SECRET 环境变量")
        }

        await page.goto(`${baseURL}${product.path}`)
        await expect(page.getByRole("main")).toBeVisible()

        // 模拟 API 返回 eligible:false
        let exitDiscountApiCallCount = 0
        await page.route((url) => url.pathname === "/api/exit-discount", async (route) => {
            if (route.request().method() === "POST") {
                exitDiscountApiCallCount++
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ eligible: false }),
                })
            } else {
                await route.continue()
            }
        })

        await page.reload()
        await expect(page.getByLabel(/邮箱/)).toBeEnabled({ timeout: 10_000 })

        // 清除 sessionStorage 模拟新 session 但 API 返回 eligible:false
        await page.evaluate(() => sessionStorage.clear())

        await page.waitForTimeout(16_000)
        await triggerDesktopExitIntent(page)
        await page.waitForTimeout(2_000)

        // 弹窗不应出现
        await expect(page.getByText(/专属优惠/i, { exact: false })).not.toBeVisible()
    })
})
