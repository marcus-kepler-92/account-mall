import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cs/announcements
 * Public read-only endpoint for Hermes customer service agent.
 * Returns all published announcements, ordered by priority.
 */
export async function GET() {
  const announcements = await prisma.announcement.findMany({
    where: { status: "PUBLISHED", audience: { in: ["CUSTOMER", "ALL"] } },
    select: {
      title: true,
      content: true,
      publishedAt: true,
    },
    orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }],
  })

  return NextResponse.json({ data: announcements })
}

export const runtime = "nodejs"
