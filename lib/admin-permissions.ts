import { cache } from "react"
import { getSessionForAdminArea } from "@/lib/auth-guard"
import { resolvePermissions } from "@/lib/admin-role-config"

export { ADMIN_ROLE_CONFIG, resolvePermissions } from "@/lib/admin-role-config"
export type { AdminSubRole } from "@/lib/admin-role-config"

export const getAdminPermissions = cache(async () => {
  const result = await getSessionForAdminArea()
  if (!result || result.role !== "ADMIN") return null

  const { isSuperAdmin, allowedMenus, canReassignDistributor } = resolvePermissions(result.adminRole)

  return {
    adminRole: result.adminRole,
    isSuperAdmin,
    allowedMenus,
    canReassignDistributor,
    mustChangePassword: result.mustChangePassword,
  }
})
