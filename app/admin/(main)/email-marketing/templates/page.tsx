import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus, ArrowLeft } from "lucide-react"
import { PageHeader } from "@/app/admin/components"
import { TemplatesGrid } from "./templates-grid"

export const dynamic = "force-dynamic"

export default async function AdminEmailTemplatesPage() {
  const rawTemplates = await prisma.emailTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      html: true,
      createdAt: true,
    },
  })

  const templates = rawTemplates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="sm:hidden">
            <Link href="/admin/email-marketing">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <PageHeader title="邮件模板" description="管理可复用的邮件模板，用于群发活动" />
        </div>
        <Button asChild size="sm">
          <Link href="/admin/email-marketing/templates/new">
            <Plus className="size-4" />
            新建模板
          </Link>
        </Button>
      </div>
      <TemplatesGrid templates={templates} />
    </div>
  )
}
