import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { AdminsDataTable } from "./admins-data-table"
import type { AdminRow } from "./admins-columns"

export const dynamic = "force-dynamic"

export default async function AdminAdminsPage() {
  const perms = await getAdminPermissions()
  if (!perms?.isSuperAdmin) redirect("/admin/forbidden")

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, username: true, name: true, adminRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const rows: AdminRow[] = admins.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }))

  return <AdminsDataTable data={rows} />
}
