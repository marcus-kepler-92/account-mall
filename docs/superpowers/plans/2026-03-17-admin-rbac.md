# Admin RBAC & Admin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sub-role based RBAC to the admin panel, including a 系统运维管理员 role, admin user management page, and forced first-login password change.

**Architecture:** Add `adminRole` and `mustChangePassword` fields to `User`. A central `lib/admin-permissions.ts` derives all permission flags from the role config (pure, testable). The admin layout calls `getAdminPermissions()` (React cache-memoized) to filter the sidebar and guard the mustChangePassword redirect. Super-admin-only operations use a new `getSuperAdminSession()` helper.

**Tech Stack:** Prisma 6, better-auth 1.4.18 (`hashPassword` from `better-auth/crypto`), React `cache()`, Next.js 16 App Router, TanStack Table, shadcn/ui, Jest

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `lib/admin-permissions.ts` | Role config, `resolvePermissions()`, `getAdminPermissions()` |
| `app/admin/(main)/admins/page.tsx` | Admin list page (server, full fetch) |
| `app/admin/(main)/admins/admins-columns.tsx` | Column defs |
| `app/admin/(main)/admins/admins-data-table.tsx` | Client table + create dialog |
| `app/admin/(main)/admins/admins-row-actions.tsx` | Edit role + reset password + delete |
| `app/admin/(main)/admins/loading.tsx` | Skeleton |
| `app/admin/change-password/page.tsx` | Standalone forced-change-password page |
| `app/admin/change-password/change-password-form.tsx` | Form component |
| `app/api/admin/admins/route.ts` | GET (list), POST (create) |
| `app/api/admin/admins/[id]/route.ts` | PATCH (update role / reset password), DELETE |
| `app/api/admin/change-password/route.ts` | POST (update password + clear flag) |
| `__tests__/lib/admin-permissions.test.ts` | Unit tests for resolvePermissions |
| `__tests__/api/admin/admins/route.test.ts` | API tests: GET, POST |
| `__tests__/api/admin/admins/[id]/route.test.ts` | API tests: PATCH, DELETE |
| `__tests__/api/admin/change-password/route.test.ts` | API tests: POST |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `adminRole String?`, `mustChangePassword Boolean @default(false)` |
| `lib/auth-guard.ts` | `getSessionForAdminArea()` returns `adminRole` + `mustChangePassword`; add `getSuperAdminSession()` |
| `app/admin/(main)/layout.tsx` | Use `getAdminPermissions()`, check mustChangePassword, pass allowedMenus to sidebar |
| `app/components/admin-sidebar.tsx` | Accept `allowedMenus: string[] \| null` + `isSuperAdmin: boolean`, filter navItems, add 管理员管理 item |
| `app/admin/(main)/orders/page.tsx` | Call `getAdminPermissions()`, pass `canReassignDistributor` to DataTable |
| `app/admin/(main)/orders/orders-columns.tsx` | `createOrdersColumns(distributors, canReassignDistributor)` |
| `app/admin/(main)/orders/orders-data-table.tsx` | Accept + forward `canReassignDistributor` |
| `app/admin/(main)/orders/order-distributor-cell.tsx` | Add `readOnly?: boolean` prop |
| `app/api/admin/orders/[orderId]/distributor/route.ts` | Replace `getAdminSession()` with `getSuperAdminSession()` |
| `__tests__/lib/auth-guard.test.ts` | Add tests for updated `getSessionForAdminArea` + `getSuperAdminSession` |
| `__tests__/api/admin/orders/orderId/distributor.test.ts` | Update mock to use `getSuperAdminSession` |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

In `prisma/schema.prisma`, inside the `model User` block, add after the `disabledAt` line:

```prisma
  adminRole          String?   @db.VarChar(64)    // null = super admin; "SYSTEM_OPS" = 系统运维管理员
  mustChangePassword Boolean   @default(false)     // true = force password change on next login
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `add_admin_role_and_must_change_password`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npm run db:generate
```

Expected: exits 0 with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add adminRole and mustChangePassword fields to User"
```

---

## Task 2: lib/admin-permissions.ts

**Files:**
- Create: `lib/admin-permissions.ts`
- Create: `__tests__/lib/admin-permissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/admin-permissions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/lib/admin-permissions.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/admin-permissions'"

- [ ] **Step 3: Create lib/admin-permissions.ts**

```ts
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
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/lib/admin-permissions.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin-permissions.ts __tests__/lib/admin-permissions.test.ts
git commit -m "feat(rbac): add admin-permissions config and resolvePermissions helper"
```

---

## Task 3: Update lib/auth-guard.ts

**Files:**
- Modify: `lib/auth-guard.ts`
- Modify: `__tests__/lib/auth-guard.test.ts`

- [ ] **Step 1: Update the test file first**

In `__tests__/lib/auth-guard.test.ts`, update the existing import at the top from:
```ts
import { getDistributorSession, getAdminSession } from "@/lib/auth-guard"
```
to:
```ts
import { getDistributorSession, getAdminSession, getSessionForAdminArea, getSuperAdminSession } from "@/lib/auth-guard"
```

Then add the following describe blocks at the end of the file:

```ts
describe("getSessionForAdminArea", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    prismaMock.user.findUnique.mockReset()
  })

  it("returns null when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await getSessionForAdminArea()).toBeNull()
  })

  it("returns role, adminRole, and mustChangePassword from DB", async () => {
    const session = { user: { id: "a1", email: "a@b.com", name: "A" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      adminRole: "SYSTEM_OPS",
      mustChangePassword: true,
    } as any)

    const result = await getSessionForAdminArea()
    expect(result).not.toBeNull()
    expect(result!.role).toBe("ADMIN")
    expect(result!.adminRole).toBe("SYSTEM_OPS")
    expect(result!.mustChangePassword).toBe(true)
  })
})

describe("getSuperAdminSession", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    prismaMock.user.findUnique.mockReset()
  })

  it("returns null when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns null when role is not ADMIN", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    prismaMock.user.findUnique.mockResolvedValue({ role: "DISTRIBUTOR", adminRole: null, mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns null when user is a sub-role admin (adminRole !== null)", async () => {
    const session = { user: { id: "a1" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: "SYSTEM_OPS", mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns session when user is super admin (ADMIN + adminRole null)", async () => {
    const session = { user: { id: "a1" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: null, mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toEqual(session)
  })
})
```

- [ ] **Step 2: Run existing auth-guard tests to confirm current state**

```bash
npx jest __tests__/lib/auth-guard.test.ts --no-coverage
```

Expected: The existing tests PASS, the new tests FAIL.

- [ ] **Step 3: Update lib/auth-guard.ts**

Replace the full file content:

```ts
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

type SessionUser = { id: string; email: string; name: string; image?: string | null; role?: string; distributorCode?: string | null }
type UserWithDisabledAt = { id: string; disabledAt?: Date | null }

export async function getSessionForAdminArea() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user) return null

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, adminRole: true, mustChangePassword: true },
    })
    if (!dbUser) return null

    return {
        session,
        role: dbUser.role as string,
        adminRole: dbUser.adminRole as string | null,
        mustChangePassword: dbUser.mustChangePassword,
    }
}

/**
 * Returns the session only if authenticated and role === 'ADMIN' (any sub-role).
 */
export async function getAdminSession() {
    const result = await getSessionForAdminArea()
    if (!result || result.role !== "ADMIN") return null
    return result.session
}

/**
 * Returns the session only if authenticated, role === 'ADMIN', and adminRole === null (super admin).
 * Use this for super-admin-only operations (admin management, etc.).
 */
export async function getSuperAdminSession() {
    const result = await getSessionForAdminArea()
    if (!result || result.role !== "ADMIN") return null
    if (result.adminRole !== null) return null
    return result.session
}

/**
 * Returns the session only if authenticated, role is DISTRIBUTOR, and the user is not disabled.
 */
export async function getDistributorSession() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    const user = session?.user as SessionUser | undefined
    if (!session || !user || user.role !== "DISTRIBUTOR") {
        return null
    }
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
    }) as UserWithDisabledAt | null
    if (!dbUser || dbUser.disabledAt != null) {
        return null
    }
    return session
}
```

- [ ] **Step 4: Run all auth-guard tests**

```bash
npx jest __tests__/lib/auth-guard.test.ts --no-coverage
```

Expected: All PASS (existing + new tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth-guard.ts __tests__/lib/auth-guard.test.ts
git commit -m "feat(auth-guard): return adminRole/mustChangePassword; add getSuperAdminSession"
```

---

## Task 4: Update Admin Layout and Sidebar

**Files:**
- Modify: `app/admin/(main)/layout.tsx`
- Modify: `app/components/admin-sidebar.tsx`

- [ ] **Step 1: Update app/admin/(main)/layout.tsx**

Replace full content:

```tsx
import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/app/components/admin-sidebar"
import { AdminBreadcrumb } from "@/app/components/admin-breadcrumb"
import { AdminTopbarActions } from "@/app/components/admin-topbar-actions"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { VisibilityRefresh } from "@/app/components/visibility-refresh"

export default async function AdminMainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const perms = await getAdminPermissions()
    if (!perms) {
        redirect("/admin/login")
    }
    if (perms.mustChangePassword) {
        redirect("/admin/change-password")
    }

    return (
        <SidebarProvider>
            <VisibilityRefresh />
            <AdminSidebar allowedMenus={perms.allowedMenus} isSuperAdmin={perms.isSuperAdmin} />
            <SidebarInset>
                <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1" />
                    <div className="flex-1 min-w-0">
                        <AdminBreadcrumb />
                    </div>
                    <AdminTopbarActions />
                </header>
                <div className="flex-1 min-w-0 p-3 sm:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
```

- [ ] **Step 2: Update app/components/admin-sidebar.tsx**

Replace the `navItems` constant and the `AdminSidebar` function signature. Full updated file:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    CreditCard,
    LogOut,
    Store,
    Megaphone,
    Users,
    Layers,
    Wallet,
    BookOpen,
    FolderOpen,
    FlaskConical,
    Mail,
    Landmark,
    ShieldCheck,
} from "lucide-react"
import { useTheme } from "next-themes"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { useSiteName, useAdminPanelLabel } from "@/app/components/site-name-provider"

const allNavItems = [
    { title: "仪表盘", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "商品管理", href: "/admin/products", icon: Package },
    { title: "订单管理", href: "/admin/orders", icon: ShoppingCart },
    { title: "卡密管理", href: "/admin/cards", icon: CreditCard },
    { title: "公告管理", href: "/admin/announcements", icon: Megaphone },
    { title: "分销指南", href: "/admin/guides", icon: BookOpen },
    { title: "分销员管理", href: "/admin/distributors", icon: Users },
    { title: "阶梯佣金配置", href: "/admin/commission-tiers", icon: Layers },
    { title: "提现管理", href: "/admin/withdrawals", icon: Wallet },
    { title: "收款渠道", href: "/admin/payment-channels", icon: Landmark },
    { title: "文件管理", href: "/admin/files", icon: FolderOpen },
    { title: "自动获取验证", href: "/admin/auto-fetch", icon: FlaskConical },
    { title: "邮件营销", href: "/admin/email-marketing", icon: Mail },
]

const superAdminOnlyItems = [
    { title: "管理员管理", href: "/admin/admins", icon: ShieldCheck },
]

interface AdminSidebarProps {
    allowedMenus: string[] | null
    isSuperAdmin: boolean
}

export function AdminSidebar({ allowedMenus, isSuperAdmin }: AdminSidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    useTheme()
    const siteName = useSiteName()
    const adminPanelLabel = useAdminPanelLabel()
    const [pendingWithdrawals, setPendingWithdrawals] = useState(0)

    useEffect(() => {
        fetch("/api/admin/withdrawals/count")
            .then((r) => r.json())
            .then((data) => setPendingWithdrawals(data.pending ?? 0))
            .catch(() => {})
    }, [])

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/admin/login")
                },
            },
        })
    }

    const navItems = [
        ...allNavItems.filter(item => !allowedMenus || allowedMenus.includes(item.href)),
        ...(isSuperAdmin ? superAdminOnlyItems : []),
    ]

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/admin/dashboard">
                                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <Store className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">{siteName}</span>
                                    <span className="text-xs text-muted-foreground">{adminPanelLabel}</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>导航</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                                        tooltip={item.title}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    {item.href === "/admin/withdrawals" && pendingWithdrawals > 0 && (
                                        <SidebarMenuBadge>{pendingWithdrawals}</SidebarMenuBadge>
                                    )}
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="退出登录"
                            onClick={handleSignOut}
                        >
                            <LogOut />
                            <span>退出登录</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/layout.tsx app/components/admin-sidebar.tsx
git commit -m "feat(layout): filter sidebar by adminRole and enforce mustChangePassword redirect"
```

---

## Task 5: Orders Permission Propagation

**Files:**
- Modify: `app/admin/(main)/orders/order-distributor-cell.tsx`
- Modify: `app/admin/(main)/orders/orders-columns.tsx`
- Modify: `app/admin/(main)/orders/orders-data-table.tsx`
- Modify: `app/admin/(main)/orders/page.tsx`

- [ ] **Step 1: Add readOnly prop to OrderDistributorCell**

In `app/admin/(main)/orders/order-distributor-cell.tsx`, update the `OrderDistributorCellProps` interface and the early-return guard:

```tsx
interface OrderDistributorCellProps {
  orderId: string
  orderStatus: "PENDING" | "COMPLETED" | "CLOSED"
  distributor: { id: string; name: string; distributorCode: string | null } | null
  distributors: DistributorOption[]
  readOnly?: boolean
}
```

And update the component signature and the interactive guard:

```tsx
export function OrderDistributorCell({
  orderId,
  orderStatus,
  distributor,
  distributors,
  readOnly = false,
}: OrderDistributorCellProps) {
```

Change the `if (orderStatus !== "COMPLETED")` block to also handle `readOnly`:

```tsx
  if (orderStatus !== "COMPLETED" || readOnly) {
    return distributor ? (
      <div className="flex flex-col text-xs">
        <span>{distributor.name}</span>
        {distributor.distributorCode && (
          <span className="text-muted-foreground font-mono">{distributor.distributorCode}</span>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  }
```

- [ ] **Step 2: Update createOrdersColumns to accept canReassignDistributor**

In `app/admin/(main)/orders/orders-columns.tsx`, update the factory signature (line 45):

```tsx
export function createOrdersColumns(distributors: DistributorOption[], canReassignDistributor: boolean): ColumnDef<OrderRow>[] {
```

Find the column definition that renders `OrderDistributorCell` and pass the `readOnly` prop. Search for the cell that uses `OrderDistributorCell` and add `readOnly={!canReassignDistributor}`:

```tsx
cell: ({ row }) => (
  <OrderDistributorCell
    orderId={row.original.id}
    orderStatus={row.original.status}
    distributor={row.original.distributor}
    distributors={distributors}
    readOnly={!canReassignDistributor}
  />
),
```

- [ ] **Step 3: Update OrdersDataTable to accept and forward canReassignDistributor**

In `app/admin/(main)/orders/orders-data-table.tsx`:

Update the props interface (around line 41):
```tsx
interface OrdersDataTableProps {
    data: OrderRow[];
    total: number;
    statusCounts: {
        PENDING: number;
        COMPLETED: number;
        CLOSED: number;
    };
    distributors: DistributorOption[];
    canReassignDistributor: boolean;
}
```

Update the function signature and the `useMemo` call:
```tsx
export function OrdersDataTable({ data, total, statusCounts, distributors, canReassignDistributor }: OrdersDataTableProps) {
    // ...
    const columns = useMemo(() => createOrdersColumns(distributors, canReassignDistributor), [distributors, canReassignDistributor]);
```

- [ ] **Step 4: Update orders/page.tsx to call getAdminPermissions**

In `app/admin/(main)/orders/page.tsx`, add the import at the top:
```tsx
import { getAdminPermissions } from "@/lib/admin-permissions"
```

Inside `AdminOrdersPage`, add before the `return` statement (after all the Prisma queries):
```tsx
    const perms = await getAdminPermissions()
    const canReassignDistributor = perms?.canReassignDistributor ?? true
```

Pass to `OrdersDataTable`:
```tsx
    <OrdersDataTable
        data={rows}
        total={total}
        statusCounts={statusCounts}
        distributors={distributorOptions}
        canReassignDistributor={canReassignDistributor}
    />
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/(main)/orders/order-distributor-cell.tsx \
        app/admin/(main)/orders/orders-columns.tsx \
        app/admin/(main)/orders/orders-data-table.tsx \
        app/admin/(main)/orders/page.tsx
git commit -m "feat(orders): hide distributor reassign for SYSTEM_OPS role"
```

---

## Task 6: Order Distributor API Guard

**Files:**
- Modify: `app/api/admin/orders/[orderId]/distributor/route.ts`
- Modify: `__tests__/api/admin/orders/orderId/distributor.test.ts`

- [ ] **Step 1: Update the test to use getSuperAdminSession**

In `__tests__/api/admin/orders/orderId/distributor.test.ts`:

Replace:
```ts
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
```
With:
```ts
jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
```

Replace all `getAdminSession` references:
```ts
import { getSuperAdminSession } from "@/lib/auth-guard"
// ...
;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
// and in the 401 test:
;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest "__tests__/api/admin/orders/orderId/distributor.test.ts" --no-coverage
```

Expected: FAIL — test expects `getSuperAdminSession` but route still calls `getAdminSession`.

- [ ] **Step 3: Update the route**

In `app/api/admin/orders/[orderId]/distributor/route.ts`, change:
```ts
import { getAdminSession } from "@/lib/auth-guard"
```
To:
```ts
import { getSuperAdminSession } from "@/lib/auth-guard"
```

Change (in PATCH handler):
```ts
  const session = await getAdminSession()
```
To:
```ts
  const session = await getSuperAdminSession()
```

- [ ] **Step 4: Run test**

```bash
npx jest "__tests__/api/admin/orders/orderId/distributor.test.ts" --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[orderId]/distributor/route.ts \
        "__tests__/api/admin/orders/orderId/distributor.test.ts"
git commit -m "feat(orders-api): restrict distributor reassign to super admin only"
```

---

## Task 7: Admin Management API

**Files:**
- Create: `app/api/admin/admins/route.ts`
- Create: `app/api/admin/admins/[id]/route.ts`
- Create: `__tests__/api/admin/admins/route.test.ts`
- Create: `__tests__/api/admin/admins/[id]/route.test.ts`

### Step 1–4: GET + POST /api/admin/admins

- [ ] **Step 1: Write failing tests for route.ts**

Create `__tests__/api/admin/admins/route.test.ts`:

```ts
import { GET, POST } from "@/app/api/admin/admins/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

const mockSession = { user: { id: "super-1" } }
const mockAdmin = {
  id: "admin-2",
  email: "ops@example.com",
  username: null,
  name: "运维管理员",
  adminRole: "SYSTEM_OPS",
  createdAt: new Date("2025-01-01"),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

describe("GET /api/admin/admins", () => {
  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns list of ADMIN users", async () => {
    prismaMock.user.findMany.mockResolvedValue([mockAdmin] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].email).toBe("ops@example.com")
  })
})

describe("POST /api/admin/admins", () => {
  function makeReq(body: unknown) {
    return new NextRequest("http://localhost/api/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ email: "x@x.com", name: "X", adminRole: null }))
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid body", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when email already exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" } as any)
    const res = await POST(makeReq({ email: "ops@example.com", name: "Ops", adminRole: "SYSTEM_OPS" }))
    expect(res.status).toBe(409)
  })

  it("creates user and account, returns generated password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ ...mockAdmin, id: "new-1" } as any)
    prismaMock.account.create.mockResolvedValue({} as any)

    const res = await POST(makeReq({ email: "ops@example.com", name: "Ops", adminRole: "SYSTEM_OPS" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.password).toBeDefined()
    expect(typeof body.password).toBe("string")
    expect(body.password.length).toBeGreaterThanOrEqual(16)
    expect(body.user.email).toBe("ops@example.com")
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest "__tests__/api/admin/admins/route.test.ts" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create app/api/admin/admins/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest, conflict, internalServerError, invalidJsonBody, validationError } from "@/lib/api-response"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"

const VALID_SUB_ROLES = Object.keys(ADMIN_ROLE_CONFIG) as AdminSubRole[]

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  adminRole: z.enum(VALID_SUB_ROLES as [AdminSubRole, ...AdminSubRole[]]).nullable(),
})

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => chars[b % chars.length]).join("")
}

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, username: true, name: true, adminRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(admins)
}

export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { email, name, adminRole } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return conflict("该邮箱已被使用")

  const password = generatePassword()
  const hashedPwd = await hashPassword(password)
  const now = new Date()

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true,
        role: "ADMIN",
        adminRole: adminRole ?? null,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      },
    })

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPwd,
        createdAt: now,
        updatedAt: now,
      },
    })

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name, adminRole: user.adminRole, createdAt: user.createdAt },
        password,
      },
      { status: 201 }
    )
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 4: Run GET+POST tests**

```bash
npx jest "__tests__/api/admin/admins/route.test.ts" --no-coverage
```

Expected: All PASS.

### Step 5–8: PATCH + DELETE /api/admin/admins/[id]

- [ ] **Step 5: Write failing tests for [id]/route.ts**

Create `__tests__/api/admin/admins/[id]/route.test.ts`:

```ts
import { PATCH, DELETE } from "@/app/api/admin/admins/[id]/route"
import { prismaMock } from "../../../../__mocks__/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

const mockSession = { user: { id: "super-1" } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

function makeReq(body: unknown, id = "admin-2") {
  return new NextRequest(`http://localhost/api/admin/admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeContext(id = "admin-2") {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/admin/admins/[id]", () => {
  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: null }), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid action", async () => {
    const res = await PATCH(makeReq({ action: "badAction" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("updateRole returns 400 when trying to update self", async () => {
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: null }), makeContext("super-1"))
    expect(res.status).toBe(400)
  })

  it("updateRole returns 404 when target not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: "SYSTEM_OPS" }), makeContext())
    expect(res.status).toBe(404)
  })

  it("updateRole updates adminRole", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.user.update.mockResolvedValue({ id: "admin-2", adminRole: "SYSTEM_OPS" } as any)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: "SYSTEM_OPS" }), makeContext())
    expect(res.status).toBe(200)
  })

  it("resetPassword returns new password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.account.updateMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.user.update.mockResolvedValue({ id: "admin-2" } as any)
    const res = await PATCH(makeReq({ action: "resetPassword" }), makeContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.password).toBeDefined()
    expect(body.password.length).toBeGreaterThanOrEqual(16)
  })
})

describe("DELETE /api/admin/admins/[id]", () => {
  function makeDeleteReq(id = "admin-2") {
    return new NextRequest(`http://localhost/api/admin/admins/${id}`, { method: "DELETE" })
  }

  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 400 when trying to delete self", async () => {
    const res = await DELETE(makeDeleteReq("super-1"), makeContext("super-1"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(404)
  })

  it("deletes the admin user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.user.delete.mockResolvedValue({ id: "admin-2" } as any)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Run to confirm failure**

```bash
npx jest "__tests__/api/admin/admins/\[id\]/route.test.ts" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 7: Create app/api/admin/admins/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest, notFound, internalServerError, invalidJsonBody, validationError } from "@/lib/api-response"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"

const VALID_SUB_ROLES = Object.keys(ADMIN_ROLE_CONFIG) as AdminSubRole[]

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateRole"),
    adminRole: z.enum(VALID_SUB_ROLES as [AdminSubRole, ...AdminSubRole[]]).nullable(),
  }),
  z.object({
    action: z.literal("resetPassword"),
  }),
])

type RouteContext = { params: Promise<{ id: string }> }

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => chars[b % chars.length]).join("")
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params
  const callerId = (session.user as { id: string }).id

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  if (parsed.data.action === "updateRole") {
    if (id === callerId) return badRequest("不能修改自己的角色")

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

    const updated = await prisma.user.update({
      where: { id },
      data: { adminRole: parsed.data.adminRole },
      select: { id: true, email: true, name: true, adminRole: true },
    })
    return NextResponse.json(updated)
  }

  // resetPassword
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

  const password = generatePassword()
  const hashedPwd = await hashPassword(password)

  try {
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPwd },
    })
    await prisma.user.update({
      where: { id },
      data: { mustChangePassword: true },
    })
    return NextResponse.json({ password })
  } catch {
    return internalServerError()
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params
  const callerId = (session.user as { id: string }).id

  if (id === callerId) return badRequest("不能删除自己的账号")

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
```

- [ ] **Step 8: Run all admin admins tests**

```bash
npx jest "__tests__/api/admin/admins" --no-coverage
```

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/admins/ __tests__/api/admin/admins/
git commit -m "feat(api): admin management CRUD endpoints (GET, POST, PATCH, DELETE)"
```

---

## Task 8: Admin Management Page UI

**Files:**
- Create: `app/admin/(main)/admins/page.tsx`
- Create: `app/admin/(main)/admins/admins-columns.tsx`
- Create: `app/admin/(main)/admins/admins-data-table.tsx`
- Create: `app/admin/(main)/admins/admins-row-actions.tsx`
- Create: `app/admin/(main)/admins/loading.tsx`

- [ ] **Step 1: Create admins-columns.tsx**

```tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"
import { AdminsRowActions } from "./admins-row-actions"

export type AdminRow = {
  id: string
  email: string | null
  username: string | null
  name: string
  adminRole: string | null
  createdAt: string
}

function roleLabel(adminRole: string | null): string {
  if (!adminRole) return "超级管理员"
  return (ADMIN_ROLE_CONFIG as Record<string, { label: string }>)[adminRole]?.label ?? adminRole
}

export const adminsColumns: ColumnDef<AdminRow>[] = [
  {
    accessorKey: "name",
    header: "姓名",
  },
  {
    accessorKey: "email",
    header: "邮箱",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "username",
    header: "用户名",
    cell: ({ row }) => row.original.username ?? "—",
  },
  {
    accessorKey: "adminRole",
    header: "角色",
    cell: ({ row }) => {
      const label = roleLabel(row.original.adminRole)
      return (
        <Badge variant={row.original.adminRole === null ? "default" : "secondary"}>
          {label}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "创建时间",
    cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminsRowActions row={row.original} />,
  },
]
```

- [ ] **Step 2: Create admins-row-actions.tsx**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, KeyRound, UserCog, Trash2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"
import type { AdminRow } from "./admins-columns"

interface AdminsRowActionsProps {
  row: AdminRow
}

function PasswordRevealDialog({ password, open, onClose }: { password: string; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>密码已重置</DialogTitle>
          <DialogDescription>这是一次性密码，仅显示一次。管理员下次登录时需要修改密码。</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
          <span className="flex-1 select-all">{password}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminsRowActions({ row }: AdminsRowActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>(row.adminRole ?? "__super__")
  const [revealPassword, setRevealPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleUpdateRole = async () => {
    setLoading(true)
    const adminRole = selectedRole === "__super__" ? null : selectedRole
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRole", adminRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      toast.success("角色已更新")
      setRoleOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      const data = await res.json()
      setRevealPassword(data.password)
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "删除失败")
        return
      }
      toast.success("管理员已删除")
      router.refresh()
    } catch {
      toast.error("删除失败")
    } finally {
      setLoading(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRoleOpen(true)}>
            <UserCog className="size-4 mr-2" />
            修改角色
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleResetPassword} disabled={loading}>
            <KeyRound className="size-4 mr-2" />
            重置密码
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            删除账号
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit role dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>{row.name}（{row.email}）</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>子角色</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__super__">超级管理员</SelectItem>
                {(Object.entries(ADMIN_ROLE_CONFIG) as [AdminSubRole, { label: string }][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>取消</Button>
            <Button onClick={handleUpdateRole} disabled={loading}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除管理员账号 <span className="font-medium">{row.name}</span>（{row.email}）。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password reveal dialog */}
      {revealPassword && (
        <PasswordRevealDialog
          password={revealPassword}
          open={true}
          onClose={() => setRevealPassword(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Create admins-data-table.tsx**

```tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Check, Plus, Loader2 } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DataTable } from "@/app/admin/components"
import { PageHeader } from "@/app/admin/components"
import { adminsColumns, type AdminRow } from "./admins-columns"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"

interface AdminsDataTableProps {
  data: AdminRow[]
}

function CreateAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [adminRole, setAdminRole] = useState<string>("__super__")
  const [result, setResult] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          adminRole: adminRole === "__super__" ? null : adminRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "创建失败")
        return
      }
      setResult({ password: data.password })
      onCreated()
    } catch {
      toast.error("创建失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setResult(null)
    setEmail("")
    setName("")
    setAdminRole("__super__")
    setCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1" />
          新增管理员
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>新增管理员</DialogTitle>
              <DialogDescription>系统将自动生成初始密码，管理员首次登录时需要修改。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>邮箱</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>姓名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="管理员姓名" />
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select value={adminRole} onValueChange={setAdminRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__super__">超级管理员</SelectItem>
                    {(Object.entries(ADMIN_ROLE_CONFIG) as [AdminSubRole, { label: string }][]).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handleCreate} disabled={loading || !email || !name}>
                {loading && <Loader2 className="size-4 mr-1 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>管理员已创建</DialogTitle>
              <DialogDescription>以下是初始密码，仅显示一次。请妥善保管并告知管理员。</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              <span className="flex-1 select-all">{result.password}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
                {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>完成</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AdminsDataTable({ data }: AdminsDataTableProps) {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns: adminsColumns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  return (
    <div className="space-y-4">
      <PageHeader title="管理员管理" description="管理后台管理员账号及其权限角色">
        <CreateAdminDialog onCreated={() => router.refresh()} />
      </PageHeader>
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索姓名或邮箱..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <DataTable table={table} />
    </div>
  )
}
```

- [ ] **Step 4: Create page.tsx**

```tsx
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
```

- [ ] **Step 5: Create loading.tsx**

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminAdminsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/(main)/admins/
git commit -m "feat(ui): admin management page with create/edit role/reset password/delete"
```

---

## Task 9: Change Password Page and API

**Files:**
- Create: `app/admin/change-password/page.tsx`
- Create: `app/admin/change-password/change-password-form.tsx`
- Create: `app/api/admin/change-password/route.ts`
- Create: `__tests__/api/admin/change-password/route.test.ts`

- [ ] **Step 1: Write failing API test**

Create `__tests__/api/admin/change-password/route.test.ts`:

```ts
import { POST } from "@/app/api/admin/change-password/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed-new") }))

const mockSession = { user: { id: "admin-1" } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/admin/change-password", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when password is too short", async () => {
    const res = await POST(makeReq({ password: "short" }))
    expect(res.status).toBe(400)
  })

  it("updates password and clears mustChangePassword flag", async () => {
    prismaMock.account.updateMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.user.update.mockResolvedValue({ id: "admin-1" } as any)

    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)

    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin-1", providerId: "credential" },
      data: { password: "hashed-new" },
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { mustChangePassword: false },
    })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest "__tests__/api/admin/change-password/route.test.ts" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create app/api/admin/change-password/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, internalServerError } from "@/lib/api-response"

const schema = z.object({
  password: z.string().min(8, "密码至少 8 位"),
})

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const userId = (session.user as { id: string }).id

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const hashedPwd = await hashPassword(parsed.data.password)

  try {
    await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPwd },
    })
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 4: Run test**

```bash
npx jest "__tests__/api/admin/change-password/route.test.ts" --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Create change-password-form.tsx**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ChangePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("两次密码不一致")
      return
    }
    if (password.length < 8) {
      toast.error("密码至少 8 位")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "修改失败")
        return
      }
      toast.success("密码已修改，正在跳转...")
      router.replace("/admin/dashboard")
    } catch {
      toast.error("修改失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
        <CardDescription>首次登录需要设置新密码，至少 8 位</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">新密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">确认密码</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 mr-1 animate-spin" />}
            确认修改
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Create app/admin/change-password/page.tsx**

```tsx
import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/auth-guard"
import { ChangePasswordForm } from "./change-password-form"

export default async function ChangePasswordPage() {
  const session = await getAdminSession()
  if (!session) redirect("/admin/login")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ChangePasswordForm />
    </div>
  )
}
```

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/change-password/ app/api/admin/change-password/ \
        __tests__/api/admin/change-password/
git commit -m "feat: forced password change page and API for newly created admins"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: All tests PASS.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Successful build.
