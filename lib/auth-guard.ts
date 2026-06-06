import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

type SessionUser = { id: string; email: string; name: string; image?: string | null; role?: string; distributorCode?: string | null }
type UserWithDisabledAt = { id: string; disabledAt?: Date | null }

export async function getSessionForAdminArea() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user) return null

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, adminRole: true, mustChangePassword: true },
    })
    if (!dbUser) return null

    return {
        session,
        role: dbUser.role as string,
        adminRole: dbUser.adminRole as string | null,
        mustChangePassword: dbUser.mustChangePassword,
    }
}

/**
 * Returns the session only if authenticated, role === 'ADMIN', and mustChangePassword is false.
 * Returns null when mustChangePassword is true to force the admin to change their password first.
 */
export async function getAdminSession() {
    const result = await getSessionForAdminArea()
    if (!result || result.role !== "ADMIN") return null
    if (result.mustChangePassword) return null
    return result.session
}

/**
 * Returns the session only if authenticated, role === 'ADMIN', and adminRole === null (super admin).
 * Use this for super-admin-only operations (admin management, etc.).
 */
export async function getSuperAdminSession() {
    const result = await getSessionForAdminArea()
    if (!result || result.role !== "ADMIN") return null
    if (result.adminRole !== null) return null
    return result.session
}

/**
 * Session lookup for the distributor area (layout, change-password page/API).
 * Unlike getDistributorSession it does NOT null out disabled / mustChangePassword
 * users — callers decide how to route them (notice page, forced password change).
 */
export async function getSessionForDistributorArea() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user) return null

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, disabledAt: true, mustChangePassword: true },
    })
    if (!dbUser || dbUser.role !== "DISTRIBUTOR") return null

    return {
        session,
        disabled: dbUser.disabledAt != null,
        mustChangePassword: dbUser.mustChangePassword,
    }
}

/**
 * Returns the session only if authenticated, role is DISTRIBUTOR, and the user is not disabled.
 */
export async function getDistributorSession() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user || user.role !== "DISTRIBUTOR") {
        return null
    }
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
    }) as UserWithDisabledAt | null
    if (!dbUser || dbUser.disabledAt != null) {
        return null
    }
    return session
}
