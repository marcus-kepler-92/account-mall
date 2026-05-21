import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/admin/agent/leads/count
 *
 * Powers the sidebar badge for "人工跟进". "Pending" mirrors the 主待办
 * default filter on /admin/agent/leads — NEW + CONTACTED — so the
 * badge number is exactly what the operator sees when they land on
 * the page. PENDING_CONTACT (user left wechat but hasn't reached out)
 * is intentionally excluded: per ops policy ops doesn't proactively
 * contact those, so a "you have N todos" badge would be misleading.
 */
export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const pending = await prisma.agentLead.count({
    where: { status: { in: ["NEW", "CONTACTED"] } },
  })
  return NextResponse.json({ pending })
}

export const runtime = "nodejs"
