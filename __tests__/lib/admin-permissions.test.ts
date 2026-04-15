// Mock auth-guard to avoid pulling in Prisma/better-auth in unit tests
jest.mock("@/lib/auth-guard", () => ({
  getSessionForAdminArea: jest.fn(),
}))

import { resolvePermissions, ADMIN_ROLE_CONFIG } from "@/lib/admin-permissions"

describe("resolvePermissions", () => {
  it("super admin (null) gets no menu restriction and can reassign", () => {
    const p = resolvePermissions(null)
    expect(p.isSuperAdmin).toBe(true)
    expect(p.allowedMenus).toBeNull()
    expect(p.canReassignDistributor).toBe(true)
  })

  it("SYSTEM_OPS gets restricted menus", () => {
    const p = resolvePermissions("SYSTEM_OPS")
    expect(p.isSuperAdmin).toBe(false)
    expect(p.allowedMenus).toEqual(expect.arrayContaining([
      "/admin/products",
      "/admin/orders",
      "/admin/announcements",
      "/admin/guides",
      "/admin/files",
      "/admin/auto-fetch",
    ]))
    expect(p.allowedMenus).not.toContain("/admin/distributors")
    expect(p.allowedMenus).not.toContain("/admin/admins")
  })

  it("SYSTEM_OPS cannot reassign distributor", () => {
    const p = resolvePermissions("SYSTEM_OPS")
    expect(p.canReassignDistributor).toBe(false)
  })

  it("unknown role falls back to super admin restrictions (full access)", () => {
    const p = resolvePermissions("UNKNOWN_ROLE")
    expect(p.isSuperAdmin).toBe(false)
    expect(p.allowedMenus).toBeNull()
    expect(p.canReassignDistributor).toBe(true)
  })
})
