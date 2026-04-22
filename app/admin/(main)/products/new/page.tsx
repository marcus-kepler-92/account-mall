import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { ProductForm } from "@/app/components/product-form"

export const dynamic = "force-dynamic"

export default async function AdminNewProductPage() {
    const [tags, cardTemplates] = await Promise.all([
        prisma.tag.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
        }),
        prisma.cardTemplate.findMany({
            select: { id: true, name: true, template: true },
            orderBy: { sortOrder: "asc" },
        }),
    ])

    return <ProductForm allTags={tags} allCardTemplates={cardTemplates} sourceUrlOptions={config.autoFetchSourceUrls} />
}
