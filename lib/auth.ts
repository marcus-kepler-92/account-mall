import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        disableSignUp: true, // Only admin login allowed, no public registration
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
});
