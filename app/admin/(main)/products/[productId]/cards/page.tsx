import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Package } from "lucide-react";
import { BackButton } from "@/app/components/back-button";
import { BulkImportCards } from "@/app/components/bulk-import-cards";
import { ProductCardsDataTable } from "./product-cards-data-table";
import type { ProductCardRow } from "./product-cards-columns";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ productId: string }>;
    searchParams: Promise<{
        action?: string;
        page?: string;
        pageSize?: string;
        status?: string;
        search?: string;
    }>;
};

const MASK_LEN = 8;

function maskContent(content: string) {
    if (content.length <= MASK_LEN) return content;
    return content.slice(0, MASK_LEN) + "***";
}

export default async function AdminProductCardsPage({ params, searchParams }: PageProps) {
    const { productId } = await params;
    const rawParams = await searchParams;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, slug: true },
    });

    if (!product) {
        notFound();
    }

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
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
        maskedContent: maskContent(c.content),
        status: c.status as ProductCardRow["status"],
        orderNo: c.order?.orderNo ?? null,
        createdAt: c.createdAt.toISOString(),
    }));

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
                <BulkImportCards productId={productId} defaultOpen={rawParams.action === "import"} />
            </div>

            {/* Stats */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="size-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">停用</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{stats.DISABLED}</p>
                    </CardContent>
                </Card>
            </div>

            {/* DataTable */}
            <ProductCardsDataTable data={serializedCards} total={total} statusCounts={stats} />
        </div>
    );
}
