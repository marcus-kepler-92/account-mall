import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { resolve } from "path"
import { config as loadEnv } from "dotenv"

loadEnv({ path: resolve(process.cwd(), ".env"), override: false })

function buildConnectionString(): string {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL
    const user = process.env.POSTGRES_USER ?? ""
    const password = process.env.POSTGRES_PASSWORD ?? ""
    const host = process.env.POSTGRES_HOST ?? "localhost"
    const port = process.env.POSTGRES_PORT ?? "5432"
    const db = process.env.POSTGRES_DB ?? ""
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}`
}

const adapter = new PrismaPg({ connectionString: buildConnectionString() })
const prisma = new PrismaClient({ adapter })

test.skip(!process.env.E2E_AGENT_ENABLED, "agent e2e disabled")

test("触发 escalate → 看到 QR + admin 后台出现 status=NEW Lead", async ({ page }) => {
    // (1) anonymous chat
    await page.goto("/")
    await page.getByRole("button", { name: /联系客服|客服/ }).click()
    // type a strong refund signal
    const composer = page.getByPlaceholder(/输入您的问题/)
    await composer.fill("我要退款，订单 KM2026-NOTEXIST")
    await composer.press("Enter")

    // (2) handoff card appears after escalate tool fires
    await expect(page.getByText(/已为你转接人工客服|已转接人工客服/)).toBeVisible({
        timeout: 30_000,
    })

    // (3) DB has new Lead w/ status NEW
    const lead = await prisma.agentLead.findFirst({
        where: { reason: { contains: "退款" } },
        orderBy: { createdAt: "desc" },
    })
    expect(lead?.status).toBe("NEW")

    // cleanup
    if (lead) await prisma.agentSession.delete({ where: { id: lead.sessionId } })
    await prisma.$disconnect()
})
