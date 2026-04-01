import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PageHeader } from "@/app/admin/components"
import { CampaignsDataTable } from "./campaigns-data-table"
import type { CampaignRow } from "./campaigns-columns"

export const dynamic = "force-dynamic"

export default async function EmailMarketingPage() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      recipientType: true,
      recipientCount: true,
      successCount: true,
      failCount: true,
      sentAt: true,
      createdAt: true,
      template: { select: { id: true, title: true } },
    },
  })

  const data: CampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    recipientType: c.recipientType,
    recipientCount: c.recipientCount,
    successCount: c.successCount,
    failCount: c.failCount,
    sentAt: c.sentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    template: c.template ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title="邮件营销" description="创建并管理邮件群发活动" />
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/email-marketing/templates">
              管理模板
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/email-marketing/campaigns/new">
              <Plus className="size-4" />
              新建活动
            </Link>
          </Button>
        </div>
      </div>
      <CampaignsDataTable data={data} />
    </div>
  )
}
