import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { unauthorized } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SOURCES, type SourceResult } from "@/lib/admin-notifications"

// Returns the full filtered candidate set (capped by the source's take=50) so the sidebar
// drag-to-dismiss-all can submit every item id. The popover slices for display.

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const adminId = session.user.id
    const perms = await getAdminPermissions()
    const allowed = perms?.allowedMenus ?? null

    const enabled = SOURCES.filter((s) => !allowed || allowed.includes(s.menuHref))
    const enabledKeys = enabled.map((s) => s.key)

    const [rawSources, dismissals] = await Promise.all([
        Promise.all(
            enabled.map(async (s) => {
                try {
                    const result = await s.fetch(prisma)
                    return { key: s.key, ...result } as SourceResult
                } catch (err) {
                    console.error(`[admin-notifications] source ${s.key} failed`, err)
                    return null
                }
            }),
        ),
        prisma.adminNotificationDismissal.findMany({
            where: { adminId, sourceKey: { in: enabledKeys } },
            select: { sourceKey: true, itemId: true, fingerprint: true },
        }),
    ])

    // Lookup: "sourceKey::itemId" -> dismissed fingerprint.
    const dismissedFingerprint = new Map<string, string>()
    for (const d of dismissals) {
        dismissedFingerprint.set(`${d.sourceKey}::${d.itemId}`, d.fingerprint)
    }

    const sources = rawSources
        .filter((s): s is SourceResult => s !== null)
        .map((src) => {
            // All item variants share the `{id, fingerprint}` shape, so one filter handles every key.
            const filtered = (src.items as { id: string; fingerprint: string }[]).filter(
                (it) => dismissedFingerprint.get(`${src.key}::${it.id}`) !== it.fingerprint,
            )
            return { ...src, count: filtered.length, items: filtered } as SourceResult
        })

    return NextResponse.json({ sources })
}

export const runtime = "nodejs"
