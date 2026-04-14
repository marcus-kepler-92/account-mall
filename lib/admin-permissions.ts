import { cache } from "react"
import { getSessionForAdminArea } from "@/lib/auth-guard"

export const ADMIN_ROLE_CONFIG = {
  SYSTEM_OPS: {
    label: "系统运维管理员",
    allowedMenus: [
      "/admin/products",
      "/admin/orders",
      "/admin/announcements",
      "/admin/guides",
      "/admin/files",
      "/admin/auto-fetch",
    ] as const,
    disabledFeatures: ["order:reassign-distributor"] as const,
  },
} satisfies Record<string, {
  label: string
  allowedMenus: readonly string[]
  disabledFeatures: readonly string[]
}>

export type AdminSubRole = keyof typeof ADMIN_ROLE_CONFIG

export function resolvePermissions(adminRole: string | null) {
  const config = adminRole && adminRole in ADMIN_ROLE_CONFIG
    ? ADMIN_ROLE_CONFIG[adminRole as AdminSubRole]
    : null

  return {
    isSuperAdmin: adminRole === null,
    allowedMenus: config ? [...config.allowedMenus] as string[] : null,
    canReassignDistributor: config
      ? !config.disabledFeatures.includes("order:reassign-distributor")
      : true,
  }
}

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
