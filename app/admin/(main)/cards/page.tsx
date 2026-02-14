import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { CreditCard, ChevronLeft, ChevronRight, CircleDot, Clock, CheckCircle2 } from "lucide-react"
import {
    DEFAULT_CARD_FILTERS,
    parseCardFilters,
    type CardFiltersInput,
} from "./cards-filters"
import { CardsFilterBar } from "./cards-filter-bar"
import { CardsHeaderActions } from "./cards-header-actions"
import { CardRowActions } from "./card-row-actions"

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
    const statsTotal = stats.UNSOLD + stats.RESERVED + stats.SOLD

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const serializedCards = cards.map((card) => ({
        id: card.id,
        content: card.content,
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

    const buildStatusLink = (status: string) => {
        const paramsEntries = new URLSearchParams()
        if (status !== "ALL") {
            paramsEntries.set("status", status)
        }
        const query = paramsEntries.toString()
        return `/admin/cards${query ? `?${query}` : ""}`
    }

    const buildPageSizeLink = (newPageSize: number) => {
        const baseFilters = { ...DEFAULT_CARD_FILTERS, ...filters, page: 1, pageSize: newPageSize }
        const paramsEntries = new URLSearchParams()
        paramsEntries.set("pageSize", String(newPageSize))
        if (baseFilters.status !== "ALL") paramsEntries.set("status", baseFilters.status)
        if (baseFilters.productKeyword) paramsEntries.set("productKeyword", baseFilters.productKeyword)
        if (baseFilters.orderNo) paramsEntries.set("orderNo", baseFilters.orderNo)
        if (baseFilters.codeLike) paramsEntries.set("codeLike", baseFilters.codeLike)
        const query = paramsEntries.toString()
        return `/admin/cards${query ? `?${query}` : ""}`
    }

    const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

    const hasFilters =
        filters.status !== "ALL" ||
        filters.codeLike ||
        filters.orderNo ||
        filters.productKeyword

    const statCards = [
        {
            key: "UNSOLD",
            label: "未售",
            value: stats.UNSOLD,
            icon: CircleDot,
            color: "text-success",
            borderColor: "border-l-success",
            active: filters.status === "UNSOLD",
        },
        {
            key: "RESERVED",
            label: "预占中",
            value: stats.RESERVED,
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
            active: filters.status === "RESERVED",
        },
        {
            key: "SOLD",
            label: "已售",
            value: stats.SOLD,
            icon: CheckCircle2,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
            active: filters.status === "SOLD",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">卡密管理</h2>
                    <p className="text-muted-foreground">
                        跨商品查看和管理所有卡密库存
                    </p>
                </div>
                <CardsHeaderActions />
            </div>

            {/* Stats cards - clickable to filter by status */}
            <div className="grid gap-4 sm:grid-cols-3">
                {statCards.map((stat) => (
                    <Link key={stat.key} href={buildStatusLink(stat.active ? "ALL" : stat.key)}>
                        <Card className={`border-l-4 ${stat.borderColor} transition-colors hover:bg-accent/50 cursor-pointer ${stat.active ? "ring-2 ring-primary/20 bg-accent/30" : ""}`}>
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                    </div>
                                    <stat.icon className={`size-8 ${stat.color} opacity-80`} />
                                </div>
                                {statsTotal > 0 && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full bg-current ${stat.color}`}
                                                style={{ width: `${(stat.value / statsTotal) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {statsTotal > 0 ? ((stat.value / statsTotal) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Search & Filter bar */}
            <CardsFilterBar initialFilters={filters} />

            {/* Cards table */}
            {serializedCards.length > 0 ? (
                <Card>
                    {/* Table toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <p className="text-sm text-muted-foreground">
                            {hasFilters ? "筛选结果：" : ""}共 <span className="font-medium text-foreground">{total}</span> 条记录
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            每页
                            {PAGE_SIZE_OPTIONS.map((size) =>
                                size === pageSize ? (
                                    <span
                                        key={size}
                                        className="inline-flex items-center justify-center size-6 rounded bg-primary text-primary-foreground font-medium"
                                    >
                                        {size}
                                    </span>
                                ) : (
                                    <Link
                                        key={size}
                                        href={buildPageSizeLink(size)}
                                        className="inline-flex items-center justify-center size-6 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        {size}
                                    </Link>
                                )
                            )}
                            条
                        </div>
                    </div>

                    {/* Table */}
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="pl-4">卡密</TableHead>
                                <TableHead>商品</TableHead>
                                <TableHead className="text-center">状态</TableHead>
                                <TableHead>订单号</TableHead>
                                <TableHead className="text-right">创建时间</TableHead>
                                <TableHead className="text-right pr-4 w-[120px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {serializedCards.map((card) => (
                                <TableRow key={card.id}>
                                    <TableCell className="pl-4">
                                        <span className="font-mono text-xs">
                                            {card.maskedContent}
                                        </span>
                                    </TableCell>
                                    <TableCell>
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
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                            variant="outline"
                                            className={
                                                card.status === "UNSOLD"
                                                    ? "border-success/50 bg-success/10 text-success"
                                                    : card.status === "RESERVED"
                                                        ? "border-warning/50 bg-warning/10 text-warning"
                                                        : "border-muted-foreground/30 bg-muted text-muted-foreground"
                                            }
                                        >
                                            {card.status === "UNSOLD"
                                                ? "未售"
                                                : card.status === "RESERVED"
                                                    ? "预占中"
                                                    : "已售"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {card.orderNo ?? "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="text-xs text-muted-foreground">
                                            {card.createdAt.toLocaleString("zh-CN")}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                        <CardRowActions
                                            content={card.content}
                                            status={card.status}
                                            productId={card.product.id}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                            第 <span className="font-medium">{page}</span> / {totalPages} 页
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={page <= 1}
                                asChild={page > 1}
                            >
                                {page > 1 ? (
                                    <Link href={buildPageLink(page - 1)}>
                                        <ChevronLeft className="size-4" />
                                    </Link>
                                ) : (
                                    <span><ChevronLeft className="size-4" /></span>
                                )}
                            </Button>
                            {/* Page number buttons */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number
                                if (totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (page <= 3) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                } else {
                                    pageNum = page - 2 + i
                                }
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === page ? "default" : "outline"}
                                        size="icon"
                                        className="size-8"
                                        asChild={pageNum !== page}
                                    >
                                        {pageNum === page ? (
                                            <span>{pageNum}</span>
                                        ) : (
                                            <Link href={buildPageLink(pageNum)}>{pageNum}</Link>
                                        )}
                                    </Button>
                                )
                            })}
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={page >= totalPages}
                                asChild={page < totalPages}
                            >
                                {page < totalPages ? (
                                    <Link href={buildPageLink(page + 1)}>
                                        <ChevronRight className="size-4" />
                                    </Link>
                                ) : (
                                    <span><ChevronRight className="size-4" /></span>
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <CreditCard className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">
                            {hasFilters ? "当前筛选无结果" : "暂无卡密"}
                        </CardTitle>
                        <CardDescription className="mb-4 text-center max-w-sm">
                            {hasFilters
                                ? "当前筛选条件下没有匹配的卡密，请调整筛选条件或前往商品卡密页面批量导入。"
                                : "尚未导入任何卡密，请先前往商品管理添加商品，再在对应商品的卡密页面批量导入。"}
                        </CardDescription>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {hasFilters ? (
                                <Button asChild variant="outline">
                                    <Link href="/admin/cards">重置筛选</Link>
                                </Button>
                            ) : null}
                            <Button asChild variant="outline">
                                <Link href="/admin/products">前往商品管理</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

