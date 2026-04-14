# Admin RBAC & Admin Management — Design Spec

Date: 2026-03-17

## Overview

Add sub-role based access control to the admin panel:
1. A new `adminRole` field on `User` to distinguish super admins from sub-role admins
2. Menu-level and button-level permission enforcement based on role config
3. An admin management CRUD page (super admin only)
4. A new built-in sub-role: 系统运维管理员 (`SYSTEM_OPS`)
5. Forced password change on first login for newly created admins

---

## 1. Data Model

### New fields on `User`

```prisma
adminRole          String?  @db.VarChar(64)  // null = super admin; "SYSTEM_OPS" = 系统运维管理员
mustChangePassword Boolean  @default(false)   // true = redirect to change-password on next login
```

> Existing ADMIN users default to `adminRole = null` (super admin) — no data migration needed.
> Provide a no-op SQL for production verification: `SELECT id, name FROM "User" WHERE role = 'ADMIN' AND "adminRole" IS NOT NULL;`

---

## 2. Permission Config

**File: `lib/admin-permissions.ts`**

```ts
import { cache } from "react"

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
    ],
    disabledFeatures: new Set(["order:reassign-distributor"]),
  },
} as const

export type AdminRole = keyof typeof ADMIN_ROLE_CONFIG | null

export const getAdminPermissions = cache(async () => {
  const result = await getSessionForAdminArea()
  const adminRole = (result?.adminRole ?? null) as AdminRole

  const isSuperAdmin = adminRole === null
  const config = adminRole ? ADMIN_ROLE_CONFIG[adminRole] : null

  return {
    adminRole,
    isSuperAdmin,
    // null = no restriction (super admin sees all menus)
    allowedMenus: config?.allowedMenus ?? null,
    canReassignDistributor: !config?.disabledFeatures.has("order:reassign-distributor"),
  }
})
```

`cache()` ensures at most one DB call per request even when called from multiple components.

---

## 3. Sidebar Menu Filtering

- `app/admin/(main)/layout.tsx` calls `getAdminPermissions()`, passes `allowedMenus` to `AdminSidebar`
- `AdminSidebar` receives `allowedMenus: string[] | null` prop; `null` = show all
- Filter: `navItems.filter(item => !allowedMenus || allowedMenus.includes(item.href))`
- `/admin/admins` menu item added; only included in `allowedMenus` when `isSuperAdmin`

---

## 4. Button-Level Restriction: Order Distributor Reassignment

The interactive distributor cell (`OrderDistributorCell`) is in the order list.

Changes:
- `orders-columns.tsx`: change export to `getColumns({ canReassignDistributor: boolean })`
- `OrderDistributorCell`: add `readOnly?: boolean` prop; when `true`, always render the static display (no popover trigger), even for COMPLETED orders
- `orders/page.tsx`: call `getAdminPermissions()`, pass `canReassignDistributor` to `OrdersDataTable`
- `OrdersDataTable`: accepts and forwards `canReassignDistributor` to `getColumns()`

**API guard**: `PATCH /api/admin/orders/[orderId]/distributor` — check caller's `adminRole`; return 403 if `SYSTEM_OPS`.

---

## 5. Admin Management Page

**Route**: `/admin/admins` (super admin only — 404 redirect for sub-roles)

### List

- Server-side full fetch, client-side filtering (admin count < 100)
- Columns: 用户名、邮箱、子角色（超级管理员 / 系统运维管理员）、创建时间、操作

### Create Admin Dialog

- Fields: 用户名、邮箱、子角色（下拉）
- Password: generated server-side (16-char random alphanumeric), returned in response, shown once in dialog with copy button
- `mustChangePassword = true` on created user

### Edit Admin (Row Action)

- Change `adminRole` (dropdown)
- Reset password: generates new random password, shown once in dialog
- Cannot edit self's `adminRole`

### Delete Admin (Row Action)

- `AlertDialog` confirmation
- Cannot delete self
- API returns 400 if attempting self-delete

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/admins` | List all ADMIN users |
| POST | `/api/admin/admins` | Create new admin |
| PATCH | `/api/admin/admins/[id]` | Update adminRole or reset password |
| DELETE | `/api/admin/admins/[id]` | Delete admin |

All endpoints: verify caller is authenticated + `adminRole === null` (super admin only).

**User creation**: Use `auth.api.createUser` (better-auth server-side admin API) or direct Prisma insert with hashed password via `bcrypt`.

---

## 6. Forced Password Change

**New page**: `/admin/change-password`

- Accessible without the main layout (no sidebar)
- Form: 新密码 + 确认密码
- On submit: update password + set `mustChangePassword = false`
- API: `POST /api/admin/change-password`

**Enforcement**: In `app/admin/(main)/layout.tsx`, after session check:
```ts
const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { mustChangePassword: true } })
if (dbUser?.mustChangePassword) redirect("/admin/change-password")
```

Also in `app/admin/login/page.tsx` (post-login redirect): already handled by layout guard above.

---

## 7. File Structure

New files:
```
lib/admin-permissions.ts
app/admin/(main)/admins/
  page.tsx
  admins-columns.tsx
  admins-data-table.tsx
  admins-row-actions.tsx
  loading.tsx
app/admin/change-password/
  page.tsx
  change-password-form.tsx
api/admin/admins/
  route.ts              (GET, POST)
  [id]/route.ts         (PATCH, DELETE)
api/admin/change-password/
  route.ts              (POST)
```

Modified files:
```
prisma/schema.prisma                              (add adminRole, mustChangePassword)
lib/auth-guard.ts                                 (return adminRole from getSessionForAdminArea)
lib/admin-permissions.ts                          (new)
app/admin/(main)/layout.tsx                       (add mustChangePassword check + pass allowedMenus)
app/components/admin-sidebar.tsx                  (accept allowedMenus prop, filter navItems)
app/admin/(main)/orders/page.tsx                  (pass canReassignDistributor to DataTable)
app/admin/(main)/orders/orders-columns.tsx        (getColumns factory)
app/admin/(main)/orders/orders-data-table.tsx     (accept + forward canReassignDistributor)
app/admin/(main)/orders/order-distributor-cell.tsx (add readOnly prop)
app/api/admin/orders/[orderId]/distributor/route.ts (add adminRole guard)
```

---

## 8. Migration

```sql
-- Prisma migration (auto-generated)
ALTER TABLE "User" ADD COLUMN "adminRole" VARCHAR(64);
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
```

Production verification SQL (run after deploy):
```sql
-- Should return 0 rows if all existing admins are correctly set as super admin
SELECT id, name, "adminRole" FROM "User" WHERE role = 'ADMIN' AND "adminRole" IS NOT NULL;
```
