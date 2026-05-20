import { checkBotId } from "botid/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { fingerprint } from "@/lib/agent-anti-abuse"
import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"

const schema = z.object({ sessionId: z.string().min(20).max(40) })

export async function POST(req: Request) {
  // BotID is only mounted (client-side) on production deployments — see
  // app/layout.tsx where <BotIdClient> is gated on VERCEL_ENV === "production".
  // On preview / local dev the client script doesn't run, so checkBotId()
  // sees no token and judges the request as bot → 403. Mirror the same gate
  // here: only enforce BotID on production. NODE_ENV-based bypass alone is
  // insufficient because preview also has NODE_ENV=production.
  if (process.env.VERCEL_ENV === "production") {
    const botCheck = await checkBotId({ developmentOptions: { bypass: "HUMAN" } })
    if (botCheck.isBot) {
      return Response.json({ error: "bot-detected" }, { status: 403 })
    }
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "bad-request" }, { status: 400 })
  }
  const { sessionId } = parsed.data
  const fp = fingerprint(req)

  // Return the runtime-resolved customer-service QR + wechat id alongside
  // the session row. This lets the client widget render the fallback /
  // handoff cards with the admin-configured QR (SiteSetting DB row), not
  // the hard-coded /contact-qr.png static file. Each request hits the
  // settings cache (React `cache()`), so the DB cost is amortized.
  const settings = await getSiteSettings()
  const handoff = {
    qrUrl: settings.wechatQrUrl, // may be "" if neither DB row nor env set
    wechatId: settings.wechatId,
  }

  const existing = await prisma.agentSession.findUnique({ where: { id: sessionId } })
  if (existing) {
    return Response.json({
      sessionId: existing.id,
      tokenBudget: existing.tokenBudget,
      tokensUsed: existing.tokensUsed,
      handoff,
    })
  }

  const expiresAt = new Date(Date.now() + config.agentSessionTtlDays * 86_400_000)
  const created = await prisma.agentSession.create({
    data: {
      id: sessionId,
      fingerprintHash: fp,
      tokenBudget: config.agentTokenBudget,
      expiresAt,
    },
  })

  return Response.json({
    sessionId: created.id,
    tokenBudget: created.tokenBudget,
    tokensUsed: created.tokensUsed,
    handoff,
  })
}
