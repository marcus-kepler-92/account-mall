import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components"
import { CardTemplatesDataTable } from "./card-templates-data-table"

export const dynamic = "force-dynamic"

export default async function CardTemplatesPage() {
  const templates = await prisma.cardTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      template: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  })

  const rows = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="卡密模版"
        description="管理全局卡密格式模版，商品可按需选择挂载"
      />
      <CardTemplatesDataTable data={rows} />
    </div>
  )
}
