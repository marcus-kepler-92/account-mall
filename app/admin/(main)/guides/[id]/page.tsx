import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { GuideForm } from "@/app/components/guide-form"
import type { GuideFormData } from "@/app/components/guide-form"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ id: string }>
}

export default async function AdminEditGuidePage({ params }: PageProps) {
    const { id } = await params

    const [guide, tags] = await Promise.all([
        prisma.distributorGuide.findUnique({
            where: { id },
        }),
        prisma.tag.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true },
        }),
    ])

    if (!guide) {
        notFound()
    }

    const formData: GuideFormData = {
        id: guide.id,
        title: guide.title,
        content: guide.content,
        tagId: guide.tagId,
        status: guide.status,
        sortOrder: guide.sortOrder,
        publishedAt: guide.publishedAt?.toISOString() ?? null,
        createdAt: guide.createdAt.toISOString(),
        updatedAt: guide.updatedAt.toISOString(),
    }

    return <GuideForm guide={formData} tags={tags} />
}
