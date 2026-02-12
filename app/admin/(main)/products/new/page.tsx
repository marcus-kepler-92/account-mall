import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/app/components/product-form"

export const dynamic = "force-dynamic"

export default async function AdminNewProductPage() {
    const tags = await prisma.tag.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
    })

    return <ProductForm allTags={tags} />
}
