import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const orders = await prisma.order.findMany({
    where: { unitPriceSnapshot: null },
    select: {
      id: true,
      amount: true,
      quantity: true,
      discountPercentApplied: true,
    },
  })

  console.log(`Found ${orders.length} orders to backfill`)

  let updated = 0
  const BATCH = 500

  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH)

    await prisma.$transaction(
      batch.map((o) => {
        const amount = Number(o.amount)
        const qty = o.quantity
        const discountPct =
          o.discountPercentApplied != null ? Number(o.discountPercentApplied) : null

        let unitPrice: number
        if (amount === 0) {
          unitPrice = 0
        } else if (discountPct != null && discountPct > 0 && discountPct < 100) {
          unitPrice = amount / qty / (1 - discountPct / 100)
        } else {
          unitPrice = amount / qty
        }

        const unitPriceSnapshot = Math.round(unitPrice * 100) / 100

        return prisma.order.update({
          where: { id: o.id },
          data: { unitPriceSnapshot },
        })
      }),
    )

    updated += batch.length
    console.log(`Backfilled ${updated}/${orders.length}`)
  }

  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
