import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badRequest, conflict, notFound, validationError } from "@/lib/api-response"
import {
    acceptInviteSchema,
    acceptNoEmailInviteSchema,
} from "@/lib/validations/distributor-invite"
import { hashPassword } from "better-auth/crypto"
import { checkAcceptInviteRateLimit } from "@/lib/rate-limit"
import { config } from "@/lib/config"

export async function POST(request: NextRequest) {
    const rateLimitRes = await checkAcceptInviteRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON body")
    }

    const parsed = acceptInviteSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    const { token, name, password } = parsed.data

    // Find and validate invitation
    const invitation = await prisma.distributorInvitation.findUnique({
        where: { token },
        include: {
            inviter: { select: { role: true } },
        },
    })

    if (!invitation) {
        return notFound("邀请链接无效")
    }
    if (invitation.acceptedAt) {
        return badRequest("此邀请链接已被使用", { code: "INVITE_USED" })
    }
    if (invitation.expiresAt < new Date()) {
        return badRequest("邀请链接已过期", { code: "INVITE_EXPIRED" })
    }

    const isNoEmail = invitation.email === null
    let username: string | undefined

    if (isNoEmail) {
        // Require and validate username
        const usernameResult = acceptNoEmailInviteSchema.safeParse(body)
        if (!usernameResult.success) {
            return validationError(usernameResult.error.flatten().fieldErrors)
        }
        username = usernameResult.data.username

        // Pre-check username uniqueness for better UX
        const existingByUsername = await prisma.user.findUnique({ where: { username } })
        if (existingByUsername) {
            return conflict("用户名已被使用，请换一个")
        }
    } else {
        // Email invite: check if email is already registered
        const existingUser = await prisma.user.findUnique({
            where: { email: invitation.email! },
            select: { id: true },
        })
        if (existingUser) {
            return badRequest("该邮箱已注册")
        }
    }

    const hashedPassword = await hashPassword(password)
    const now = new Date()

    // Determine inviterId for the new user
    // Admin invites → inviterId = null (admin not in commission chain)
    // Distributor invites → inviterId = inviter's ID
    const newUserInviterId =
        invitation.inviter.role === "DISTRIBUTOR" ? invitation.inviterId : null

    // Generate distributorCode
    const tempId = crypto.randomUUID()
    const distributorCode = `D${tempId.replace(/-/g, "").slice(-8).toUpperCase()}`

    try {
        await prisma.$transaction(async (tx) => {
            // Re-check acceptedAt inside transaction to prevent concurrent accepts
            const inv = await tx.distributorInvitation.findUnique({
                where: { token },
                select: { acceptedAt: true },
            })
            if (inv?.acceptedAt) {
                throw new Error("ALREADY_ACCEPTED")
            }

            const user = await tx.user.create({
                data: {
                    email: isNoEmail ? null : invitation.email,
                    username: isNoEmail ? username! : null,
                    name,
                    emailVerified: true,
                    role: "DISTRIBUTOR",
                    distributorCode,
                    discountPercent: config.basePromoDiscountPercent,
                    inviterId: newUserInviterId,
                    createdAt: now,
                    updatedAt: now,
                },
            })

            await tx.account.create({
                data: {
                    userId: user.id,
                    accountId: user.id,
                    providerId: "credential",
                    password: hashedPassword,
                    createdAt: now,
                    updatedAt: now,
                },
            })

            await tx.distributorInvitation.update({
                where: { token },
                data: { acceptedAt: now },
            })
        })
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_ACCEPTED") {
            return conflict("此邀请链接已被使用")
        }
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
        ) {
            return conflict("注册冲突，请重试")
        }
        throw err
    }

    return NextResponse.json({ success: true })
}
