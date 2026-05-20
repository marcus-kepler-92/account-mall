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

test("访客主动留微信号 → admin 后台出现 PENDING_CONTACT", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /联系客服|客服/ }).click()
    const composer = page.getByPlaceholder(/输入您的问题/)
    await composer.fill("方便联系的话我微信 testuser2026")
    await composer.press("Enter")
    await page.waitForTimeout(8_000) // let tool call finish

    const lead = await prisma.agentLead.findFirst({
        where: { wechatId: "testuser2026" },
        orderBy: { createdAt: "desc" },
    })
    expect(lead?.status).toBe("PENDING_CONTACT")

    if (lead) await prisma.agentSession.delete({ where: { id: lead.sessionId } })
    await prisma.$disconnect()
})
