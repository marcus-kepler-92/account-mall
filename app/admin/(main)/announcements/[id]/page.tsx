import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AnnouncementForm } from "@/app/components/announcement-form"
import type { AnnouncementFormData } from "@/app/components/announcement-form"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ id: string }>
}

export default async function AdminEditAnnouncementPage({ params }: PageProps) {
    const { id } = await params

    const announcement = await prisma.announcement.findUnique({
        where: { id },
    })

    if (!announcement) {
        notFound()
    }

    const formData: AnnouncementFormData = {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        status: announcement.status,
        sortOrder: announcement.sortOrder,
        publishedAt: announcement.publishedAt?.toISOString() ?? null,
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
    }

    return <AnnouncementForm announcement={formData} />
}
