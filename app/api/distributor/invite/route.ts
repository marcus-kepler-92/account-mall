import { NextRequest, NextResponse } from "next/server";
import { getDistributorSession } from "@/lib/auth-guard";
import { badRequest, unauthorized, validationError } from "@/lib/api-response";
import { distributorInviteSchema } from "@/lib/validations/distributor-invite";
import { sendDistributorInvitation } from "@/lib/send-distributor-invitation";
import { checkDistributorInviteRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
    const session = await getDistributorSession();
    if (!session) return unauthorized();

    const user = session.user as { id: string; name?: string; disabledAt?: string | null };
    if (user.disabledAt) {
        return unauthorized("账号已停用，无法发送邀请");
    }

    const rateLimitRes = await checkDistributorInviteRateLimit(user.id);
    if (rateLimitRes) return rateLimitRes;

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

    const result = await sendDistributorInvitation({
        email,
        inviterId: user.id,
        inviterName: user.name ?? "分销员",
    });

    if (!result.success) {
        if (result.reason === "already_registered") {
            return badRequest("该邮箱已注册，无需重复邀请");
        }
        return badRequest("邮件发送失败，请稍后重试");
    }

    return NextResponse.json({ success: true, email });
}
