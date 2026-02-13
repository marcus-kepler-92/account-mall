import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CreditCard } from "lucide-react"
import {
    DEFAULT_CARD_FILTERS,
    parseCardFilters,
    type CardFiltersInput,
} from "./cards-filters"
import { CardsFilterBar } from "./cards-filter-bar"
import { CardsHeaderActions } from "./cards-header-actions"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    status?: string
    productKeyword?: string
    orderNo?: string
    codeLike?: string
}>

const MASK_LEN = 8

function maskContent(content: string) {
    if (content.length <= MASK_LEN) return content
    return content.slice(0, MASK_LEN) + "***"
}

export default async function AdminCardsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const rawParams = await searchParams
    const filters = parseCardFilters(rawParams as CardFiltersInput)

    const page = filters.page
    const pageSize = filters.pageSize

    const where: Record<string, unknown> = {}

    if (filters.status !== "ALL") {
        where.status = filters.status
    }

    if (filters.codeLike) {
        where.content = {
            contains: filters.codeLike,
            mode: "insensitive",
        }
    }

    if (filters.orderNo) {
        where.order = {
            orderNo: {
                contains: filters.orderNo,
                mode: "insensitive",
            },
        }
    }

    if (filters.productKeyword) {
        where.product = {
            OR: [
                {
                    name: {
                        contains: filters.productKeyword,
                        mode: "insensitive",
                    },
                },
                {
                    slug: {
                        contains: filters.productKeyword,
                        mode: "insensitive",
                    },
                },
            ],
        }
    }

    const [cards, total, statusCounts] = await Promise.all([
        prisma.card.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                order: {
                    select: {
                        orderNo: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.card.count({ where }),
        prisma.card.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
    ])

    const stats = {
        UNSOLD: statusCounts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
        RESERVED: statusCounts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
        SOLD: statusCounts.find((c) => c.status === "SOLD")?._count.id ?? 0,
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const serializedCards = cards.map((card) => ({
        id: card.id,
        maskedContent: maskContent(card.content),
        status: card.status,
        orderNo: card.order?.orderNo ?? null,
        product: {
            id: card.product.id,
            name: card.product.name,
            slug: card.product.slug,
        },
        createdAt: card.createdAt,
    }))

    const buildPageLink = (targetPage: number) => {
        const paramsEntries = new URLSearchParams()
        const baseFilters = { ...DEFAULT_CARD_FILTERS, ...filters, page: targetPage }

        if (baseFilters.page > 1) {
            paramsEntries.set("page", String(baseFilters.page))
        }
        if (baseFilters.pageSize !== DEFAULT_CARD_FILTERS.pageSize) {
            paramsEntries.set("pageSize", String(baseFilters.pageSize))
        }
        if (baseFilters.status !== "ALL") {
            paramsEntries.set("status", baseFilters.status)
        }
        if (baseFilters.productKeyword) {
            paramsEntries.set("productKeyword", baseFilters.productKeyword)
        }
        if (baseFilters.orderNo) {
            paramsEntries.set("orderNo", baseFilters.orderNo)
        }
        if (baseFilters.codeLike) {
            paramsEntries.set("codeLike", baseFilters.codeLike)
        }

        const query = paramsEntries.toString()
        return `/admin/cards${query ? `?${query}` : ""}`
    }

    const getStatusBadgeVariant = (status: string) => {
        if (status === "UNSOLD") return "secondary" as const
        if (status === "RESERVED") return "outline" as const
        return "default" as const
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">卡密管理</h2>
                    <p className="text-muted-foreground">
                        跨商品查看和管理所有卡密库存
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        共 <span className="font-medium">{total}</span> 条卡密，
                        未售 <span className="font-medium">{stats.UNSOLD}</span>，
                        预占中 <span className="font-medium">{stats.RESERVED}</span>，
                        已售 <span className="font-medium">{stats.SOLD}</span>
                    </p>
                </div>
                <CardsHeaderActions />
            </div>

            {/* Search & Filter bar */}
            <CardsFilterBar initialFilters={filters} />

            {/* Cards table */}
            {serializedCards.length > 0 ? (
                <div className="space-y-4">
                    <div className="overflow-x-auto rounded-md border bg-card">
                        <table className="min-w-full text-sm">
                            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">卡密</th>
                                    <th className="px-4 py-2 text-left font-medium">商品</th>
                                    <th className="px-4 py-2 text-center font-medium">状态</th>
                                    <th className="px-4 py-2 text-left font-medium">订单号</th>
                                    <th className="px-4 py-2 text-right font-medium">创建时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                {serializedCards.map((card) => (
                                    <tr
                                        key={card.id}
                                        className="border-b last:border-0 hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-2 align-middle">
                                            <span className="font-mono text-xs break-all">
                                                {card.maskedContent}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 align-middle">
                                            <div className="flex flex-col">
                                                <Link
                                                    href={`/admin/products/${card.product.id}/cards`}
                                                    className="text-sm font-medium hover:underline"
                                                >
                                                    {card.product.name}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">
                                                    /{card.product.slug}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center align-middle">
                                            <Badge variant={getStatusBadgeVariant(card.status)}>
                                                {card.status === "UNSOLD"
                                                    ? "未售"
                                                    : card.status === "RESERVED"
                                                        ? "预占中"
                                                        : "已售"}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2 align-middle">
                                            <span className="text-xs text-muted-foreground">
                                                {card.orderNo ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right align-middle">
                                            <span className="text-xs text-muted-foreground">
                                                {card.createdAt.toLocaleString("zh-CN")}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                            第 <span className="font-medium">{page}</span> /
                            <span className="font-medium">{totalPages}</span> 页，
                            每页 <span className="font-medium">{pageSize}</span> 条
                        </div>
                        <div className="flex items-center gap-2">
                            {page <= 1 ? (
                                <Button variant="outline" size="sm" disabled>
                                    上一页
                                </Button>
                            ) : (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={buildPageLink(page - 1)}>上一页</Link>
                                </Button>
                            )}
                            {page >= totalPages ? (
                                <Button variant="outline" size="sm" disabled>
                                    下一页
                                </Button>
                            ) : (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={buildPageLink(page + 1)}>下一页</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <CreditCard className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">暂无卡密</CardTitle>
                        <CardDescription className="mb-4 text-center max-w-sm">
                            当前筛选条件下没有匹配的卡密，你可以调整筛选条件或前往商品卡密页面批量导入。
                        </CardDescription>
                        <Button asChild variant="outline">
                            <Link href="/admin/products">前往商品管理</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

