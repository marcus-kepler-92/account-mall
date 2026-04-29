import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Package, CircleDot, Clock, CheckCircle2, Ban } from "lucide-react";
import { parseServerSort } from "@/lib/table-sort";
import { BackButton } from "./back-button";
import { BulkImportCards } from "./bulk-import-cards";
import { ExportCards } from "./export-cards";
import { ProductCardsDataTable } from "./product-cards-data-table";
import { StatCard } from "@/app/admin/components";
import type { ProductCardRow } from "./product-cards-columns";
import { resolveAdminCard } from "@/lib/card-format";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ productId: string }>;
    searchParams: Promise<{
        action?: string;
        page?: string;
        pageSize?: string;
        status?: string;
        search?: string;
        sort?: string;
        sortDir?: string;
    }>;
};

export default async function AdminProductCardsPage({ params, searchParams }: PageProps) {
    const { productId } = await params;
    const rawParams = await searchParams;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
            id: true,
            name: true,
            slug: true,
            cardTemplates: {
                orderBy: { sortOrder: "asc" },
                select: { template: true },
            },
        },
    });

    if (!product) {
        notFound();
    }

    const { orderBy } = parseServerSort(
        rawParams.sort ?? null,
        rawParams.sortDir ?? null,
        ["createdAt"] as const,
        { sort: "createdAt", sortDir: "desc" }
    );

    const page = Math.max(1, parseInt(rawParams.page ?? "", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(rawParams.pageSize ?? "", 10) || 20));

    const where: Record<string, unknown> = { productId };

    if (rawParams.status && rawParams.status !== "ALL") {
        const statuses = rawParams.status.split(",").filter(Boolean);
        if (statuses.length === 1) {
            where.status = statuses[0];
        } else if (statuses.length > 1) {
            where.status = { in: statuses };
        }
    }

    if (rawParams.search) {
        where.content = {
            contains: rawParams.search,
            mode: "insensitive",
        };
    }

    const [cards, total, counts] = await Promise.all([
        prisma.card.findMany({
            where,
            include: {
                order: { select: { orderNo: true } },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.card.count({ where }),
        prisma.card.groupBy({
            by: ["status"],
            where: { productId },
            _count: { id: true },
        }),
    ]);

    const stats = {
        UNSOLD: counts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
        RESERVED: counts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
        SOLD: counts.find((c) => c.status === "SOLD")?._count.id ?? 0,
        DISABLED: counts.find((c) => c.status === "DISABLED")?._count.id ?? 0,
    };

    const serializedCards: ProductCardRow[] = cards.map((c) => ({
        id: c.id,
        content: c.content,
        resolved: resolveAdminCard(c.content, product.cardTemplates),
        status: c.status as ProductCardRow["status"],
        orderNo: c.order?.orderNo ?? null,
        createdAt: c.createdAt.toISOString(),
    }));

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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
            </div>

            {/* Stats */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <StatCard label="未售" value={stats.UNSOLD} icon={CircleDot} borderColor="border-l-success" iconColor="text-success" />
                <StatCard label="预占中" value={stats.RESERVED} icon={Clock} borderColor="border-l-warning" iconColor="text-warning" />
                <StatCard label="已售" value={stats.SOLD} icon={CheckCircle2} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
                <StatCard label="停用" value={stats.DISABLED} icon={Ban} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
            </div>

            {/* DataTable */}
            <ProductCardsDataTable
                data={serializedCards}
                total={total}
                statusCounts={stats}
                actions={<>
                    <ExportCards productId={productId} statusCounts={stats} />
                    <BulkImportCards productId={productId} defaultOpen={rawParams.action === "import"} />
                </>}
            />
        </div>
    );
}
