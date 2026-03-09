import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

type SessionUser = { id: string; email: string; name: string; image?: string | null; role?: string; distributorCode?: string | null }

type UserWithRole = { id: string; role?: string }
type UserWithDisabledAt = { id: string; disabledAt?: Date | null }

/**
 * Get the current session (any role) for admin area.
 * Returns { session, role } or null when not authenticated.
 * Role is always read from DB so that role changes (e.g. set-admin-role script) take effect without re-login.
 */
export async function getSessionForAdminArea() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user) return null
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
    }) as UserWithRole | null
    const role = dbUser?.role ?? ""
    return { session, role }
}

/**
 * Get the current admin session from the request.
 * Returns the session object only if authenticated and user.role === 'ADMIN', otherwise null.
 */
export async function getAdminSession() {
    const result = await getSessionForAdminArea()
    if (!result || result.role !== "ADMIN") return null
    return result.session
}

/**
 * Get the current distributor session from the request.
 * Returns the session only if authenticated, role is DISTRIBUTOR, and the user is not disabled (disabledAt === null).
 * Disabled distributors cannot perform write operations (e.g. create withdrawal) and are treated as unauthorized.
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
