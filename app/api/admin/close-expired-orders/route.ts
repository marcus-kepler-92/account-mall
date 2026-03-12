import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { closeExpiredOrders } from "@/lib/close-expired-orders"
import { unauthorized } from "@/lib/api-response"

/**
 * POST /api/admin/close-expired-orders
 * Admin-triggered endpoint to close expired PENDING orders and release reserved cards.
 * Secured by admin session cookie.
 */
export async function POST() {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const result = await closeExpiredOrders()
    return NextResponse.json(result)
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
