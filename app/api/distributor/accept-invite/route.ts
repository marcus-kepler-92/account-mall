import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound, validationError } from "@/lib/api-response";
import { acceptInviteSchema } from "@/lib/validations/distributor-invite";
import { hashPassword } from "better-auth/crypto";
import { checkAcceptInviteRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
    const rateLimitRes = await checkAcceptInviteRateLimit(request);
    if (rateLimitRes) return rateLimitRes;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return badRequest("Invalid JSON body");
    }

    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors);
    }

    const { token, password } = parsed.data;

    // Find and validate invitation
    const invitation = await prisma.distributorInvitation.findUnique({
        where: { token },
        include: {
            inviter: { select: { role: true } },
        },
    });

    if (!invitation) {
        return notFound("邀请链接无效");
    }
    if (invitation.acceptedAt) {
        return badRequest("此邀请链接已被使用", { code: "INVITE_USED" });
    }
    if (invitation.expiresAt < new Date()) {
        return badRequest("邀请链接已过期", { code: "INVITE_EXPIRED" });
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
    });
    if (existingUser) {
        return badRequest("该邮箱已注册");
    }

    const hashedPassword = await hashPassword(password);
    const now = new Date();

    // Determine inviterId for the new user
    // Admin invites → inviterId = null (admin not in commission chain)
    // Distributor invites → inviterId = inviter's ID
    const newUserInviterId =
        invitation.inviter.role === "DISTRIBUTOR" ? invitation.inviterId : null;

    // Generate distributorCode
    const tempId = crypto.randomUUID();
    const distributorCode = `D${tempId.replace(/-/g, "").slice(-8).toUpperCase()}`;

    try {
        await prisma.$transaction(async (tx) => {
            // Re-check acceptedAt inside transaction to prevent concurrent accepts
            const inv = await tx.distributorInvitation.findUnique({
                where: { token },
                select: { acceptedAt: true },
            });
            if (inv?.acceptedAt) {
                throw new Error("ALREADY_ACCEPTED");
            }

            const user = await tx.user.create({
                data: {
                    email: invitation.email,
                    name: invitation.email.split("@")[0],
                    emailVerified: true,
                    role: "DISTRIBUTOR",
                    distributorCode,
                    inviterId: newUserInviterId,
                    createdAt: now,
                    updatedAt: now,
                },
            });

            await tx.account.create({
                data: {
                    userId: user.id,
                    accountId: user.id,
                    providerId: "credential",
                    password: hashedPassword,
                    createdAt: now,
                    updatedAt: now,
                },
            });

            await tx.distributorInvitation.update({
                where: { token },
                data: { acceptedAt: now },
            });
        });
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_ACCEPTED") {
            return conflict("此邀请链接已被使用");
        }
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
        ) {
            return conflict("注册冲突，请重试");
        }
        throw err;
    }

    return NextResponse.json({ success: true });
}
