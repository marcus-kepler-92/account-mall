import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { sendMail } from "@/lib/email";
import { render } from "@react-email/render";
import React from "react";
import { DistributorInvitation } from "@/app/emails/distributor-invitation";

export type SendDistributorInvitationResult =
    | { success: true }
    | { success: false; reason: "already_registered" | "send_failed" };

/**
 * Create a DistributorInvitation record and send the invitation email.
 * Called by both the admin API and the distributor API.
 *
 * @param email - The invitee's email address (already normalized)
 * @param inviterId - The ID of the person sending the invite (admin or distributor)
 * @param inviterName - Display name of the inviter for the email
 */
export async function sendDistributorInvitation({
    email,
    inviterId,
    inviterName,
}: {
    email: string;
    inviterId: string;
    inviterName: string;
}): Promise<SendDistributorInvitationResult> {
    // Check if email is already registered
    const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    if (existing) {
        return { success: false, reason: "already_registered" };
    }

    const ttlDays = config.distributorInviteTtlDays;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const token = crypto.randomUUID();

    await prisma.distributorInvitation.create({
        data: { email, token, inviterId, expiresAt },
    });

    const acceptUrl = `${config.siteUrl}/distributor/accept-invite?token=${token}`;

    if (config.nodeEnv === "development") {
        console.log(
            `\n[invite] 📨 → ${email}\n[invite] 🔗 ${acceptUrl}\n`,
        );
    }

    const html = await render(
        React.createElement(DistributorInvitation, {
            inviterName,
            acceptUrl,
            brandName: config.siteName,
            expiresInDays: ttlDays,
        }),
    );

    const result = await sendMail({
        to: email,
        subject: `[${config.siteName}] 您收到一份分销员邀请`,
        html,
    });

    if (!result.success) {
        console.error("[send-distributor-invitation] Email send failed", {
            email,
            error: result.error,
        });
        return { success: false, reason: "send_failed" };
    }

    return { success: true };
}
