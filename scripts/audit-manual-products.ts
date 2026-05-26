/**
 * Audit / repair MANUAL products that are ACTIVE without any active variant.
 * Pre-Task 16 / pre-d4b7655 may have created these. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx scripts/audit-manual-products.ts            # dry-run, list only
 *   npx tsx scripts/audit-manual-products.ts --apply    # repair: set INACTIVE
 *
 * A MANUAL product without active variants cannot be sold — the buyer detail
 * page renders a "配置中" placeholder and the order API rejects new orders.
 * Downgrading them to INACTIVE keeps the catalog honest and prevents stale
 * rows from cluttering the storefront.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type BrokenProduct = {
    id: string
    slug: string
    name: string
    createdAt: Date
    updatedAt: Date
}

async function findBrokenProducts(): Promise<BrokenProduct[]> {
    const candidates = await prisma.product.findMany({
        where: { productType: "MANUAL", status: "ACTIVE" },
        select: {
            id: true,
            slug: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    variants: { where: { isActive: true } },
                },
            },
        },
        orderBy: { createdAt: "asc" },
    })

    return candidates
        .filter((p) => p._count.variants === 0)
        .map(({ id, slug, name, createdAt, updatedAt }) => ({
            id,
            slug,
            name,
            createdAt,
            updatedAt,
        }))
}

function formatTable(rows: BrokenProduct[]): string {
    if (rows.length === 0) return "(none)"
    const header = ["id", "slug", "name", "createdAt", "updatedAt"]
    const data = rows.map((r) => [
        r.id,
        r.slug,
        r.name,
        r.createdAt.toISOString(),
        r.updatedAt.toISOString(),
    ])
    const widths = header.map((h, i) =>
        Math.max(h.length, ...data.map((row) => row[i].length)),
    )
    const fmt = (cells: string[]) =>
        cells.map((c, i) => c.padEnd(widths[i])).join("  ")
    return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...data.map(fmt)].join("\n")
}

async function main(): Promise<void> {
    const apply = process.argv.includes("--apply")

    const before = await findBrokenProducts()
    console.log(`MANUAL + ACTIVE + 0 active variants: ${before.length} product(s)`)
    console.log(formatTable(before))
    console.log("")
    console.log(
        apply
            ? "Suggested action: set status=INACTIVE (proceeding because --apply was passed)."
            : "Suggested action: set status=INACTIVE. Re-run with --apply to repair.",
    )

    if (!apply) return
    if (before.length === 0) return

    const ids = before.map((p) => p.id)
    await prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
            where: { id: { in: ids } },
            data: { status: "INACTIVE" },
        })
    })

    const after = await findBrokenProducts()
    console.log("")
    console.log(`Repair complete. before=${before.length}  after=${after.length}`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
