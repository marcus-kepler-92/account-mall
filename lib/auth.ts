import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    user: {
        additionalFields: {
            role: { type: "string", required: false },
            distributorCode: { type: "string", required: false },
            inviterId: { type: "string", required: false },
        },
    },
    emailAndPassword: {
        enabled: true,
        // Sign-up is disabled: distributors join via invite-only flow (/distributor/accept-invite)
        // and admin accounts are created via seed script.
        disableSignUp: true,
    },
    trustedOrigins: [config.siteUrl],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
    },
    advanced: {
        useSecureCookies: config.nodeEnv === "production",
    },
    plugins: [nextCookies()],
});
