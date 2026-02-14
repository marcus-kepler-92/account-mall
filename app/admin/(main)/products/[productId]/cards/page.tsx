import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Package } from "lucide-react"
import { BackButton } from "@/app/components/back-button"
import { CardsList } from "@/app/components/cards-list"
import { BulkImportCards } from "@/app/components/bulk-import-cards"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ productId: string }>
    searchParams: Promise<{ action?: string }>
}

export default async function AdminProductCardsPage({ params, searchParams }: PageProps) {
    const { productId } = await params
    const { action } = await searchParams

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, slug: true },
    })

    if (!product) {
        notFound()
    }

    const [cards, counts] = await Promise.all([
        prisma.card.findMany({
            where: { productId },
            include: {
                order: { select: { orderNo: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.card.groupBy({
            by: ["status"],
            where: { productId },
            _count: { id: true },
        }),
    ])

    const stats = {
        UNSOLD: counts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
        RESERVED: counts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
        SOLD: counts.find((c) => c.status === "SOLD")?._count.id ?? 0,
    }

    const serializedCards = cards.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        orderNo: c.order?.orderNo ?? null,
        createdAt: c.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Package className="size-6" />
                            {product.name}
                        </h2>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            卡密管理 · /{product.slug}
                        </p>
                    </div>
                </div>
                <BulkImportCards productId={productId} defaultOpen={action === "import"} />
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="size-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">未售</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{stats.UNSOLD}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="size-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">预占中</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{stats.RESERVED}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="size-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">已售</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{stats.SOLD}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Cards list */}
            <CardsList productId={productId} cards={serializedCards} stats={stats} />
        </div>
    )
}
