// Client-safe: no server-only imports. Used by both server and client components.

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
      "/admin/cards",
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
