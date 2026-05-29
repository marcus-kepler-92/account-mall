import { Wallet } from "lucide-react"
import type { NotificationSource } from "@/lib/admin-notifications"
import { SOURCE_ITEM_TAKE } from "@/lib/admin-notifications/constants"

export const withdrawalsSource: NotificationSource<"withdrawals"> = {
  key: "withdrawals",
  label: "提现待审核",
  icon: Wallet,
  menuHref: "/admin/withdrawals",
  viewAllHref: "/admin/withdrawals?status=PENDING",
  async fetch(prisma) {
    const where = { status: "PENDING" as const }
    const [count, rows] = await Promise.all([
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.findMany({
        where,
        take: SOURCE_ITEM_TAKE,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          distributor: { select: { name: true, email: true } },
        },
      }),
    ])

    return {
      count,
      items: rows.map((row) => ({
        id: row.id,
        fingerprint: "v1",
        distributorName: row.distributor.name || row.distributor.email || "未知",
        amount: Number(row.amount),
        createdAt: row.createdAt.toISOString(),
      })),
    }
  },
}
