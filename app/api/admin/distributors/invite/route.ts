import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema } from "@/lib/validations/distributor-invite"
import { sendDistributorInvitation } from "@/lib/send-distributor-invitation"
import { createNoEmailInviteLink } from "@/lib/create-no-email-invite-link"

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON body")
    }

    const admin = session.user as { id: string; name?: string }

    // No-email invite: body has no email field
    const hasEmail =
        typeof body === "object" &&
        body !== null &&
        "email" in body &&
        typeof (body as { email: unknown }).email === "string" &&
        (body as { email: string }).email.length > 0

    if (!hasEmail) {
        const result = await createNoEmailInviteLink({ inviterId: admin.id })
        return NextResponse.json({ success: true, link: result.link })
    }

    const parsed = distributorInviteSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    const { email } = parsed.data

    const result = await sendDistributorInvitation({
        email,
        inviterId: admin.id,
        inviterName: admin.name ?? "管理员",
    })

    if (!result.success) {
        if (result.reason === "already_registered") {
            return badRequest("该邮箱已注册，无需重复邀请")
        }
        return badRequest("邮件发送失败，请稍后重试")
    }

    return NextResponse.json({ success: true, email })
}
