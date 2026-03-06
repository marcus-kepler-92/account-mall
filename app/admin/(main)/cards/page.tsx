import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreditCard, CircleDot, Clock, CheckCircle2, Ban } from "lucide-react";
import {
    DEFAULT_CARD_FILTERS,
    parseCardFilters,
    type CardFiltersInput,
} from "./cards-filters";
import { CardsHeaderActions } from "./cards-header-actions";
import { CardsDataTable } from "./cards-data-table";
import type { CardRow } from "./cards-columns";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
    page?: string;
    pageSize?: string;
    status?: string;
    productKeyword?: string;
    orderNo?: string;
    codeLike?: string;
}>;

const MASK_LEN = 8;

function maskContent(content: string) {
    if (content.length <= MASK_LEN) return content;
    return content.slice(0, MASK_LEN) + "***";
}

export default async function AdminCardsPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const rawParams = await searchParams;
    const filters = parseCardFilters(rawParams as CardFiltersInput);

    const page = filters.page;
    const pageSize = filters.pageSize;

    const where: Record<string, unknown> = {};

    if (filters.status !== "ALL") {
        where.status = filters.status;
    }

    if (filters.codeLike) {
        where.content = {
            contains: filters.codeLike,
            mode: "insensitive",
        };
    }

    if (filters.orderNo) {
        where.order = {
            orderNo: {
                contains: filters.orderNo,
                mode: "insensitive",
            },
        };
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
        };
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
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.card.count({ where }),
        prisma.card.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
    ]);

    const stats = {
        UNSOLD: statusCounts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
        RESERVED: statusCounts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
        SOLD: statusCounts.find((c) => c.status === "SOLD")?._count.id ?? 0,
        DISABLED: statusCounts.find((c) => c.status === "DISABLED")?._count.id ?? 0,
    };
    const statsTotal = stats.UNSOLD + stats.RESERVED + stats.SOLD + stats.DISABLED;

    const serializedCards: CardRow[] = cards.map((card) => ({
        id: card.id,
        content: card.content,
        maskedContent: maskContent(card.content),
        status: card.status as CardRow["status"],
        orderNo: card.order?.orderNo ?? null,
        product: {
            id: card.product.id,
            name: card.product.name,
            slug: card.product.slug,
        },
        createdAt: card.createdAt.toISOString(),
    }));

    const buildStatusLink = (status: string) => {
        const paramsEntries = new URLSearchParams();
        if (status !== "ALL") {
            paramsEntries.set("status", status);
        }
        const query = paramsEntries.toString();
        return `/admin/cards${query ? `?${query}` : ""}`;
    };

    const hasFilters =
        filters.status !== "ALL" ||
        filters.codeLike ||
        filters.orderNo ||
        filters.productKeyword;

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
        {
            key: "DISABLED",
            label: "停用",
            value: stats.DISABLED,
            icon: Ban,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
            active: filters.status === "DISABLED",
        },
    ];

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
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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

            {/* DataTable */}
            {serializedCards.length > 0 || hasFilters ? (
                <CardsDataTable data={serializedCards} total={total} statusCounts={stats} />
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <CreditCard className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">暂无卡密</CardTitle>
                        <CardDescription className="mb-4 text-center max-w-sm">
                            尚未导入任何卡密，请先前往商品管理添加商品，再在对应商品的卡密页面批量导入。
                        </CardDescription>
                        <Button asChild variant="outline">
                            <Link href="/admin/products">前往商品管理</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
