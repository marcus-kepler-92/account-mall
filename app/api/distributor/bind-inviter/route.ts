import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { unauthorized } from "@/lib/api-response"

const bindInviterSchema = z.object({
    inviteCode: z
        .string()
        .min(1, "邀请码不能为空")
        .max(256, "邀请码过长"),
})

/**
 * POST /api/distributor/bind-inviter
 * Bind the current user (distributor) to an inviter by invite code.
 * Called after signup when user registered via invite link. Idempotent: can overwrite inviter.
 */
export async function POST(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) return unauthorized()

    const user = session.user as { id: string }
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "请求体无效" },
            { status: 400 }
        )
    }
    const parsed = bindInviterSchema.safeParse(body)
    if (!parsed.success) {
        const msg = parsed.error.flatten().formErrors?.[0] ?? "参数错误"
        return NextResponse.json({ error: msg }, { status: 400 })
    }

    const inviteCode = parsed.data.inviteCode.trim()
    const inviter = await prisma.user.findFirst({
        where: {
            distributorCode: inviteCode,
            role: "DISTRIBUTOR",
            disabledAt: null,
        },
        select: { id: true },
    })
    if (!inviter) {
        return NextResponse.json(
            { error: "邀请码无效或邀请人已停用" },
            { status: 400 }
        )
    }
    if (inviter.id === user.id) {
        return NextResponse.json(
            { error: "不能绑定自己为邀请人" },
            { status: 400 }
        )
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { inviterId: inviter.id },
    })

    return NextResponse.json({ ok: true })
}
