import { prisma } from "@/lib/prisma";
import { getAdminPermissions } from "@/lib/admin-permissions";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreditCard, CircleDot, Clock, CheckCircle2, Ban } from "lucide-react";
import { PageHeader, StatCard } from "@/app/admin/components";
import { parseServerSort } from "@/lib/table-sort";
import {
    DEFAULT_CARD_FILTERS,
    parseCardFilters,
    type CardFiltersInput,
    type CardStatusFilter,
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
    sort?: string;
    sortDir?: string;
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
    const perms = await getAdminPermissions();
    const isSuperAdmin = perms?.isSuperAdmin ?? false;
    const filters = parseCardFilters(rawParams as CardFiltersInput);
    const { orderBy } = parseServerSort(
        rawParams.sort ?? null,
        rawParams.sortDir ?? null,
        ["createdAt"] as const,
        { sort: "createdAt", sortDir: "desc" }
    );

    const page = filters.page;
    const pageSize = filters.pageSize;

    const where: Record<string, unknown> = {};

    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
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
                        productType: true,
                        price: true,
                    },
                },
                order: {
                    select: {
                        orderNo: true,
                    },
                },
            },
            orderBy,
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
            isFree: card.product.productType === "AUTO_FETCH" && Number(card.product.price) === 0,
        },
        createdAt: card.createdAt.toISOString(),
    }));

    const buildStatusLink = (statusKey: CardStatusFilter) => {
        const params = new URLSearchParams();
        const nextList = filters.statusList.includes(statusKey)
            ? filters.statusList.filter((s) => s !== statusKey)
            : [...filters.statusList, statusKey];
        if (nextList.length > 0) {
            params.set("status", nextList.join(","));
        }
        const query = params.toString();
        return `/admin/cards${query ? `?${query}` : ""}`;
    };

    const hasFilters =
        filters.statusList.length > 0 ||
        filters.codeLike ||
        filters.orderNo ||
        filters.productKeyword;

    return (
        <div className="space-y-6">
            <PageHeader title="卡密管理" description="跨商品查看和管理所有卡密库存">
                <CardsHeaderActions />
            </PageHeader>

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <StatCard
                    label="未售"
                    value={stats.UNSOLD}
                    icon={CircleDot}
                    borderColor="border-l-success"
                    iconColor="text-success"
                    active={filters.statusList.includes("UNSOLD")}
                    href={buildStatusLink("UNSOLD")}
                />
                <StatCard
                    label="预占中"
                    value={stats.RESERVED}
                    icon={Clock}
                    borderColor="border-l-warning"
                    iconColor="text-warning"
                    active={filters.statusList.includes("RESERVED")}
                    href={buildStatusLink("RESERVED")}
                />
                <StatCard
                    label="已售"
                    value={stats.SOLD}
                    icon={CheckCircle2}
                    borderColor="border-l-muted-foreground"
                    iconColor="text-muted-foreground"
                    active={filters.statusList.includes("SOLD")}
                    href={buildStatusLink("SOLD")}
                />
                <StatCard
                    label="停用"
                    value={stats.DISABLED}
                    icon={Ban}
                    borderColor="border-l-muted-foreground"
                    iconColor="text-muted-foreground"
                    active={filters.statusList.includes("DISABLED")}
                    href={buildStatusLink("DISABLED")}
                />
            </div>

            {serializedCards.length > 0 || hasFilters ? (
                <CardsDataTable
                    data={serializedCards}
                    total={total}
                    statusCounts={stats}
                    isSuperAdmin={isSuperAdmin}
                />
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
