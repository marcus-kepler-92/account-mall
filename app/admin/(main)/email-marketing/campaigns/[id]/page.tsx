import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/app/admin/components"
import { formatDateTime } from "@/lib/utils"
import { CampaignSendButton } from "./campaign-send-button"

type Params = Promise<{ id: string }>

const statusConfig = {
  DRAFT: { label: "草稿", variant: "secondary" as const },
  SENDING: { label: "发送中", variant: "outline" as const },
  SENT: { label: "已发送", variant: "default" as const },
  FAILED: { label: "失败", variant: "destructive" as const },
}

const recipientTypeLabel = {
  CUSTOMERS: "下单客户",
  DISTRIBUTORS: "分销员",
}

export const dynamic = "force-dynamic"

export default async function CampaignDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: { template: { select: { id: true, title: true } } },
  })

  if (!campaign) notFound()

  const filter = campaign.recipientFilter as Record<string, unknown>
  const { label, variant } = statusConfig[campaign.status]
  const showActions = campaign.status !== "SENT"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/email-marketing">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <PageHeader title={campaign.name} description={campaign.subject} />
          </div>
        </div>
        {showActions && (
          <CampaignSendButton
            campaignId={id}
            recipientCount={campaign.recipientCount}
            status={campaign.status}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">状态</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <Badge variant={variant}>{label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">受众</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="font-medium text-sm">{recipientTypeLabel[campaign.recipientType]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">收件人数</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="font-medium text-sm">{campaign.recipientCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">发送时间</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="font-medium text-sm">
              {campaign.sentAt ? formatDateTime(campaign.sentAt.toISOString()) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {(campaign.status === "SENT" || campaign.status === "FAILED") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">发送结果</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">总计</p>
              <p className="text-2xl font-bold">{campaign.recipientCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">成功</p>
              <p className="text-2xl font-bold text-green-600">{campaign.successCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">失败</p>
              <p className={`text-2xl font-bold ${campaign.failCount > 0 ? "text-orange-500" : ""}`}>
                {campaign.failCount}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">活动信息</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {[
            { label: "活动名称", value: campaign.name },
            { label: "邮件主题", value: campaign.subject },
            { label: "使用模板", value: campaign.template?.title ?? "无" },
            {
              label: "受众筛选",
              value:
                campaign.recipientType === "DISTRIBUTORS"
                  ? { all: "全部分销员", level1: "一级分销员", level2: "二级分销员" }[
                      (filter.level as string) ?? "all"
                    ] ?? "全部分销员"
                  : "全部已完成订单客户",
            },
            { label: "创建时间", value: formatDateTime(campaign.createdAt.toISOString()) },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">邮件预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden" style={{ height: 400 }}>
            <iframe
              srcDoc={campaign.html}
              className="w-full h-full pointer-events-none"
              sandbox="allow-same-origin"
              title="邮件预览"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
