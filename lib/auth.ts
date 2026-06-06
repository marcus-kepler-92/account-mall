import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { render } from "@react-email/render";
import React from "react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { sendMail } from "@/lib/email";
import { PasswordResetEmail } from "@/app/emails/password-reset";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    user: {
        additionalFields: {
            role: { type: "string", required: false },
            distributorCode: { type: "string", required: false },
            inviterId: { type: "string", required: false },
            // Exposed in the session so the proxy can stop bouncing disabled
            // distributors from /distributor/login back to /distributor (loop).
            disabledAt: { type: "date", required: false, input: false },
        },
    },
    emailAndPassword: {
        enabled: true,
        // Sign-up is disabled: distributors join via invite-only flow (/distributor/accept-invite)
        // and admin accounts are created via seed script.
        disableSignUp: true,
        // Self-service reset is a common response to credential leaks: kill old sessions.
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
            // Email reset is distributor-only: admins are reset by the super admin
            // (/admin/admins), disabled distributors cannot log in anyway.
            // Note: better-auth has already persisted the reset token at this point;
            // this filter only suppresses email delivery, the token stays unreachable.
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { role: true, disabledAt: true },
            });
            if (!dbUser || dbUser.role !== "DISTRIBUTOR" || dbUser.disabledAt != null) return;

            if (config.nodeEnv === "development") {
                console.log(`\n[password-reset] → ${user.email}\n[password-reset] ${url}\n`);
            }
            const html = await render(
                React.createElement(PasswordResetEmail, {
                    resetUrl: url,
                    brandName: config.siteName,
                }),
            );
            // Awaited on purpose: fire-and-forget gets dropped when the serverless
            // function freezes after the response is sent.
            await sendMail({
                to: user.email,
                subject: `[${config.siteName}] 重置密码`,
                html,
            });
        },
        onPasswordReset: async ({ user }) => {
            // An admin-issued temporary password may have set this flag; a successful
            // self-service reset already proves control of a fresh password.
            await prisma.user.updateMany({
                where: { id: user.id, mustChangePassword: true },
                data: { mustChangePassword: false },
            });
        },
    },
    trustedOrigins: [
        config.siteUrl,
        // Allow Vercel preview deployments (wildcard supported by better-auth)
        "https://account-mall-*.vercel.app",
    ],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        // Memory storage is per-instance on Vercel; database makes limits global.
        storage: "database",
        customRules: {
            // Throttle reset-email requests hard to prevent mailbox flooding.
            "/request-password-reset": { window: 60, max: 3 },
        },
    },
    advanced: {
        useSecureCookies: config.nodeEnv === "production",
    },
    plugins: [
        username({
            usernameValidator: (username) => {
                return /^[a-z0-9_]+$/.test(username)
            },
        }),
        nextCookies(),
    ],
});
