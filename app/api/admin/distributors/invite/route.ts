import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-guard";
import { badRequest, unauthorized, validationError } from "@/lib/api-response";
import { distributorInviteSchema } from "@/lib/validations/distributor-invite";
import { sendDistributorInvitation } from "@/lib/send-distributor-invitation";

export async function POST(request: NextRequest) {
    const session = await getAdminSession();
    if (!session) return unauthorized();

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return badRequest("Invalid JSON body");
    }

    const parsed = distributorInviteSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors);
    }

    const { email } = parsed.data;
    const admin = session.user as { id: string; name?: string };

    const result = await sendDistributorInvitation({
        email,
        inviterId: admin.id,
        inviterName: admin.name ?? "管理员",
    });

    if (!result.success) {
        if (result.reason === "already_registered") {
            return badRequest("该邮箱已注册，无需重复邀请");
        }
        return badRequest("邮件发送失败，请稍后重试");
    }

    return NextResponse.json({ success: true, email });
}
