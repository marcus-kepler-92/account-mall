import { prisma } from "@/lib/prisma"
import type { CustomerFilter, DistributorFilter } from "@/lib/validations/email-marketing"

export type ResolveInput =
  | { type: "CUSTOMERS"; filter: CustomerFilter }
  | { type: "DISTRIBUTORS"; filter: DistributorFilter }

export async function resolveRecipients(input: ResolveInput): Promise<string[]> {
  if (input.type === "CUSTOMERS") {
    const { productIds, dateFrom, dateTo } = input.filter
    const rows = await prisma.order.findMany({
      where: {
        status: "COMPLETED",
        ...(productIds?.length ? { productId: { in: productIds } } : {}),
        ...((dateFrom || dateTo)
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      select: { email: true },
      distinct: ["email"],
    })
    return rows.map((r) => r.email)
  }

  const { level } = input.filter
  const rows = await prisma.user.findMany({
    where: {
      role: "DISTRIBUTOR",
      disabledAt: null,
      ...(level === "level1" ? { inviterId: null } : {}),
      ...(level === "level2" ? { inviterId: { not: null } } : {}),
    },
    select: { email: true },
    distinct: ["email"],
  })
  return rows.map((r) => r.email)
}
