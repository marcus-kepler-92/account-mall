import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { unauthorized } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SOURCES } from "@/lib/admin-notifications"

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const perms = await getAdminPermissions()
    const allowed = perms?.allowedMenus ?? null

    const enabled = SOURCES.filter((s) => !allowed || allowed.includes(s.menuHref))

    const results = await Promise.all(
        enabled.map(async (s) => {
            try {
                const result = await s.fetch(prisma)
                return { key: s.key, ...result }
            } catch (err) {
                console.error(`[admin-notifications] source ${s.key} failed`, err)
                return null
            }
        }),
    )

    return NextResponse.json({ sources: results.filter((r) => r !== null) })
}

export const runtime = "nodejs"
