import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components/page-header"
import { AutoFetchClient } from "./auto-fetch-client"

export const dynamic = "force-dynamic"

export default async function AutoFetchPage() {
    const products = await prisma.product.findMany({
        where: { productType: "AUTO_FETCH" },
        select: { id: true, name: true, slug: true, sourceUrl: true },
        orderBy: { name: "asc" },
    })

    return (
        <div className="space-y-6">
            <PageHeader
                title="自动获取验证"
                description="实时拉取账号列表，验证来源 URL 是否正常，直接复制可用账号给客户"
            />
            <AutoFetchClient products={products} />
        </div>
    )
}
