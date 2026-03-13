import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { getClientIp } from "@/lib/rate-limit"
import { generateExitDiscountToken } from "@/lib/exit-discount"
import { badRequest, invalidJsonBody } from "@/lib/api-response"
import * as z from "zod"

const requestSchema = z.object({
    productId: z.string().min(1),
    fingerprintHash: z.string().min(1),
})

const VISITOR_COOKIE = "__ed_vid"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * POST /api/exit-discount
 * 检查 exit intent 折扣资格并生成签名 token。
 * 三信号复合识别：浏览器指纹（独立阻断）、持久 cookie（独立阻断）、IP（辅助）。
 */
export async function POST(request: NextRequest) {
    if (!config.exitDiscountSecret) {
        return NextResponse.json({ eligible: false })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
        return badRequest("无效的请求参数")
    }

    const { productId, fingerprintHash } = parsed.data
    const ip = getClientIp(request)

    // 读取或生成持久 visitorId cookie
    const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value?.trim()
    const visitorId = existingVisitorId || randomUUID()

    // 三信号资格校验
    const [byVisitorId, byFingerprint, byIpWithOtherSignal] = await Promise.all([
        // 信号 1：持久 cookie 独立阻断
        prisma.exitDiscountUsage.findFirst({
            where: { productId, visitorId },
            select: { id: true },
        }),
        // 信号 2：浏览器指纹独立阻断
        prisma.exitDiscountUsage.findFirst({
            where: { productId, fingerprintHash },
            select: { id: true },
        }),
        // 信号 3：IP 辅助阻断（IP + 另一信号同时命中）
        ip !== "unknown"
            ? prisma.exitDiscountUsage.findFirst({
                where: {
                    productId,
                    ip,
                    OR: [{ visitorId }, { fingerprintHash }],
                },
                select: { id: true },
            })
            : Promise.resolve(null),
    ])

    if (byVisitorId || byFingerprint || byIpWithOtherSignal) {
        return NextResponse.json({ eligible: false })
    }

    // 有资格，生成签名 token
    const token = generateExitDiscountToken(
        {
            productId,
            visitorId,
            fingerprintHash,
            ip,
            discountPercent: config.exitDiscountPercent,
        },
        config.exitDiscountSecret,
        config.exitDiscountTtlMs
    )

    const expiresAt = Date.now() + config.exitDiscountTtlMs

    const response = NextResponse.json({
        eligible: true,
        token,
        expiresAt,
        discountPercent: config.exitDiscountPercent,
    })

    // 若是新生成的 visitorId，写入持久 cookie
    if (!existingVisitorId) {
        response.cookies.set(VISITOR_COOKIE, visitorId, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: COOKIE_MAX_AGE,
            path: "/",
        })
    }

    return response
}

export const runtime = "nodejs"
