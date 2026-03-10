import { prisma } from "@/lib/prisma"
import { GuideForm } from "@/app/components/guide-form"

export const dynamic = "force-dynamic"

export default async function AdminNewGuidePage() {
    const tags = await prisma.tag.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
    })

    return <GuideForm tags={tags} />
}
