# Dashboard 重设计：销量 / 利润 / 里程碑三看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/admin/dashboard` 重组为「全局 KPI 头 + 三 Tab」结构，同时补全成本追踪、拆分邀请/销售里程碑逻辑。

**Architecture:** Schema 层加 3 个字段（`Product.costPerUnit`、`Order.costSnapshot`、`InvitationMilestone.type`）；里程碑触发逻辑按 type 分支，INVITATION 在注册时触发，SALES 在订单完成时触发；Dashboard 全局 KPI 用 SSR，三个 Tab 各自 Client Component + TanStack Query 懒加载。

**Tech Stack:** Next.js 16 App Router · Prisma 6 · React 19 · shadcn/ui · TanStack Query · Zod · Jest

**Spec:** `docs/superpowers/specs/2026-03-17-dashboard-redesign-design.md`

---

## 文件改动总览

### 新建
| 文件 | 说明 |
|------|------|
| `app/admin/(main)/dashboard/dashboard-global-kpi.tsx` | 全局 KPI 头（SSR props 注入） |
| `app/admin/(main)/dashboard/dashboard-sales-tab.tsx` | 销量 Tab |
| `app/admin/(main)/dashboard/dashboard-profit-tab.tsx` | 利润 Tab |
| `app/admin/(main)/dashboard/dashboard-milestone-tab.tsx` | 里程碑 Tab |
| `app/api/admin/milestone-report/route.ts` | 里程碑数据 API |

### 修改
| 文件 | 改动 |
|------|------|
| `prisma/schema.prisma` | 加 3 个字段 + 1 个枚举 |
| `lib/validations/product.ts` | 加 `costPerUnit` 字段 |
| `app/components/product-form.tsx` | 加成本输入框 |
| `lib/complete-pending-order.ts` | select + 写入 `costSnapshot` |
| `lib/domains/distributors/validators.ts` | `createMilestoneSchema` 加 `type` |
| `lib/domains/distributors/types.ts` | `MilestoneRow` 加 `type` |
| `lib/domains/distributors/milestone-service.ts` | 分支触发逻辑；新增 `checkAndIssueInvitationMilestoneBonuses` |
| `lib/domains/distributors/index.ts` | 导出新函数 |
| `lib/domains/distributors/service.ts` | `acceptInvite` 加 INVITATION 触发 |
| `app/admin/(main)/invitation-milestones/invitation-milestones-columns.tsx` | 加 `type` 列 |
| `app/admin/(main)/invitation-milestones/add-milestone-dialog.tsx` | 加 type RadioGroup |
| `app/admin/(main)/invitation-milestones/edit-milestone-dialog.tsx` | 加 type RadioGroup |
| `app/admin/(main)/invitation-milestones/page.tsx` | 传 `type` 给 data |
| `app/api/admin/sales-report/route.ts` | 加 `cost`/`margin`/`totalCost`/`hasMissingCost` |
| `app/admin/(main)/dashboard/dashboard-data.ts` | 加全局 KPI 查询函数 |
| `app/admin/(main)/dashboard/page.tsx` | 重组为全局 KPI + Tab 框架 |
| `__tests__/lib/complete-pending-order-milestone.test.ts` | 更新 mock 加 type 字段 |
| `lib/domains/distributors/__tests__/service.test.ts` | 加 `acceptInvite` 里程碑触发测试 |

### 删除
| 文件 |
|------|
| `app/admin/(main)/dashboard/dashboard-sales-panel.tsx` |
| `app/admin/(main)/dashboard/dashboard-distributor-panel.tsx` |
| `app/admin/(main)/dashboard/dashboard-pending-withdrawals.tsx` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema 中添加三处变更**

在 `prisma/schema.prisma` 中：

**1a. `Product` 模型加 `costPerUnit`**（在 `price` 字段后面）：
```prisma
price           Decimal    @db.Decimal(10, 2)
costPerUnit     Decimal?   @db.Decimal(10, 2)
```

**1b. `Order` 模型加 `costSnapshot`**（在 `unitPriceSnapshot` 字段后面）：
```prisma
unitPriceSnapshot         Decimal?    @db.Decimal(10, 2)
costSnapshot              Decimal?    @db.Decimal(10, 2)
```

**1c. 在 schema 枚举区域添加 `MilestoneType` 枚举**，并在 `InvitationMilestone` 模型加 `type` 字段：
```prisma
enum MilestoneType {
  INVITATION
  SALES
}
```

在 `InvitationMilestone` 模型 `id` 字段后加：
```prisma
type            MilestoneType  @default(INVITATION)
```

- [ ] **Step 2: 生成迁移**

```bash
npm run db:migrate
# 提示输入迁移名称时输入：add_cost_and_milestone_type
```

预期输出：`✔  Generated Prisma Client` + 新迁移文件创建成功。

- [ ] **Step 3: 验证生成的 client 包含新字段**

```bash
grep -n "costPerUnit\|costSnapshot\|MilestoneType" node_modules/@prisma/client/index.d.ts | head -10
```

预期：能找到三个新字段/枚举的类型定义。

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add costPerUnit, costSnapshot, MilestoneType"
```

---

## Task 2: Product 成本字段（Validation + Form）

**Files:**
- Modify: `lib/validations/product.ts`
- Modify: `app/components/product-form.tsx`

- [ ] **Step 1: 在 `createProductSchema` 和 `updateProductSchema` 中加 `costPerUnit`**

在 `lib/validations/product.ts` 的 `createProductSchema` 中（`price` 字段后）加：
```typescript
costPerUnit: z.number().min(0, "采购成本不能为负").nullable().optional(),
```

在 `updateProductSchema` 中同样加（带 `.optional()`）：
```typescript
costPerUnit: z.number().min(0, "采购成本不能为负").nullable().optional(),
```

- [ ] **Step 2: 在商品表单中加成本输入框**

在 `app/components/product-form.tsx` 中，在 `price` 的 `FormField` 之后加：

```tsx
<FormField
  control={form.control}
  name="costPerUnit"
  render={({ field }) => (
    <FormItem>
      <FormLabel>采购成本（每张卡密，可选）</FormLabel>
      <FormControl>
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="留空表示未设置"
          value={field.value ?? ""}
          onChange={(e) => {
            const v = e.target.value
            field.onChange(v === "" ? null : parseFloat(v))
          }}
        />
      </FormControl>
      <FormDescription>用于利润看板计算，不影响售价和用户展示</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

需在文件顶部确认已导入 `FormDescription`，若无则从 `@/components/ui/form` 补充导入。

- [ ] **Step 3: 确认表单 defaultValues 包含 costPerUnit**

在 `product-form.tsx` 的 `useForm` defaultValues 中加：
```typescript
costPerUnit: product?.costPerUnit ?? null,
```

- [ ] **Step 4: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -i "product-form\|validations/product" | head -20
```

预期：无错误输出。

- [ ] **Step 5: Commit**

```bash
git add lib/validations/product.ts app/components/product-form.tsx
git commit -m "feat(product): add costPerUnit field for profit calculation"
```

---

## Task 3: Order 成本快照（completePendingOrder）

**Files:**
- Modify: `lib/complete-pending-order.ts`
- Test: `__tests__/lib/complete-pending-order-milestone.test.ts`

- [ ] **Step 1: 先看现有测试，确认 mock 结构**

```bash
head -60 __tests__/lib/complete-pending-order-milestone.test.ts
```

- [ ] **Step 2: 在 `completePendingOrder` 的 `findFirst` include 中加 `costPerUnit`**

在 `lib/complete-pending-order.ts` 第 20-27 行的 `product` select 中加：

```typescript
product: {
  select: { name: true, productType: true, validityHours: true, costPerUnit: true },
},
```

- [ ] **Step 3: 在 `order.updateMany` data 中写入 `costSnapshot`**

在事务内的 `updateMany` data 对象中加：

```typescript
data: {
  status: "COMPLETED",
  paidAt,
  costSnapshot: order.product?.costPerUnit ?? null,
  ...(expiresAt && { expiresAt }),
},
```

- [ ] **Step 4: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "complete-pending-order" | head -10
```

预期：无错误。

- [ ] **Step 5: 运行现有测试确认未破坏**

```bash
npx jest __tests__/lib/complete-pending-order-milestone.test.ts --no-coverage
```

预期：所有测试通过（mock 里 product 缺少 costPerUnit 不影响，因为是 optional）。

- [ ] **Step 6: Commit**

```bash
git add lib/complete-pending-order.ts
git commit -m "feat(order): snapshot costPerUnit at order completion"
```

---

## Task 4: Milestone 类型拆分——Validators & Types

**Files:**
- Modify: `lib/domains/distributors/validators.ts`
- Modify: `lib/domains/distributors/types.ts`

- [ ] **Step 1: 更新 `createMilestoneSchema`**

将 `lib/domains/distributors/validators.ts` 中第 80-88 行替换为：

```typescript
export const createMilestoneSchema = z.object({
  type: z.enum(["INVITATION", "SALES"]),
  thresholdCount: z.number().int().min(0).default(0),
  thresholdAmount: z.number().min(0).default(0),
  bonusAmount: z.number().positive("奖励金额必须大于 0"),
}).superRefine((data, ctx) => {
  if (data.type === "INVITATION" && data.thresholdCount < 1) {
    ctx.addIssue({ code: "custom", message: "邀请人数至少为 1", path: ["thresholdCount"] })
  }
  if (data.type === "SALES" && data.thresholdAmount <= 0) {
    ctx.addIssue({ code: "custom", message: "门槛销售额必须大于 0", path: ["thresholdAmount"] })
  }
})

export const updateMilestoneSchema = z.object({
  type: z.enum(["INVITATION", "SALES"]).optional(),
  thresholdCount: z.number().int().min(0).optional(),
  thresholdAmount: z.number().min(0).optional(),
  bonusAmount: z.number().positive("奖励金额必须大于 0").optional(),
})

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
```

- [ ] **Step 2: 更新 `MilestoneRow` type**

在 `lib/domains/distributors/types.ts` 找到 `MilestoneRow`（约第 252 行），加 `type` 字段：

```typescript
export type MilestoneRow = {
  id: string
  type: "INVITATION" | "SALES"
  thresholdAmount: number
  thresholdCount: number
  bonusAmount: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 3: 在 `milestone-service.ts` 的 `serializeMilestone` 函数中加 `type`**

将 `serializeMilestone` 函数的返回对象加：
```typescript
return {
  id: m.id,
  type: m.type as "INVITATION" | "SALES",
  thresholdAmount: Number(m.thresholdAmount),
  thresholdCount: m.thresholdCount,
  bonusAmount: Number(m.bonusAmount),
  sortOrder: m.sortOrder,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
}
```

serializeMilestone 的参数类型也要加 `type: string`：
```typescript
function serializeMilestone(m: {
  id: string
  type: string
  thresholdAmount: unknown
  thresholdCount: number
  bonusAmount: unknown
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): MilestoneRow {
```

- [ ] **Step 4: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "milestone" | head -20
```

预期：无错误。

- [ ] **Step 5: Commit**

```bash
git add lib/domains/distributors/validators.ts lib/domains/distributors/types.ts lib/domains/distributors/milestone-service.ts
git commit -m "feat(milestone): add type field to schema, validators, and types"
```

---

## Task 5: Milestone Service——触发逻辑分支

**Files:**
- Modify: `lib/domains/distributors/milestone-service.ts`
- Modify: `lib/domains/distributors/index.ts`
- Test: `lib/domains/distributors/__tests__/service.test.ts`

- [ ] **Step 1: 重写 `checkAndIssueMilestoneBonuses`（仅处理 SALES 类型）**

将 `milestone-service.ts` 中 `checkAndIssueMilestoneBonuses` 函数（第 100 行起）完整替换为：

```typescript
/** Called at order completion — checks SALES milestones for the invitee's inviter */
export async function checkAndIssueMilestoneBonuses(
  tx: Prisma.TransactionClient,
  distributorId: string,
): Promise<void> {
  const invitee = await tx.user.findUnique({
    where: { id: distributorId },
    select: { inviterId: true },
  })
  if (!invitee?.inviterId) return
  const inviterId = invitee.inviterId

  const inviter = await tx.user.findUnique({
    where: { id: inviterId },
    select: { role: true, disabledAt: true },
  })
  if (!inviter || inviter.role !== "DISTRIBUTOR" || inviter.disabledAt !== null) return

  const [milestones, triggered] = await Promise.all([
    tx.invitationMilestone.findMany({
      where: { type: "SALES" },
      orderBy: { thresholdAmount: "asc" },
    }),
    tx.invitationMilestoneBonus.findMany({
      where: { inviterId },
      select: { milestoneId: true },
    }),
  ])
  if (milestones.length === 0) return
  const triggeredSet = new Set(triggered.map((b) => b.milestoneId))
  const untriggered = milestones.filter((m) => !triggeredSet.has(m.id))
  if (untriggered.length === 0) return

  const invitees = await tx.user.findMany({
    where: { inviterId, role: "DISTRIBUTOR", disabledAt: null },
    select: { id: true },
  })
  const inviteeIds = invitees.map((u) => u.id)
  if (inviteeIds.length === 0) return

  for (const milestone of untriggered) {
    const result = await tx.order.aggregate({
      where: {
        distributorId: { in: inviteeIds },
        status: "COMPLETED",
        paidAt: { gte: milestone.createdAt },
      },
      _sum: { amount: true },
    })
    if (Number(result._sum.amount ?? 0) < Number(milestone.thresholdAmount)) continue

    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          milestoneId: milestone.id,
          thresholdSnapshot: milestone.thresholdAmount,
          countSnapshot: inviteeIds.length,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}
```

- [ ] **Step 2: 添加 `checkAndIssueInvitationMilestoneBonuses` 函数**

在 `checkAndIssueMilestoneBonuses` 函数之后添加：

```typescript
/** Called at distributor registration — checks INVITATION milestones for the new user's inviter */
export async function checkAndIssueInvitationMilestoneBonuses(
  tx: Prisma.TransactionClient,
  newUserId: string,
): Promise<void> {
  const newUser = await tx.user.findUnique({
    where: { id: newUserId },
    select: { inviterId: true },
  })
  if (!newUser?.inviterId) return
  const inviterId = newUser.inviterId

  const inviter = await tx.user.findUnique({
    where: { id: inviterId },
    select: { role: true, disabledAt: true },
  })
  if (!inviter || inviter.role !== "DISTRIBUTOR" || inviter.disabledAt !== null) return

  const [milestones, triggered] = await Promise.all([
    tx.invitationMilestone.findMany({
      where: { type: "INVITATION" },
      orderBy: { thresholdCount: "asc" },
    }),
    tx.invitationMilestoneBonus.findMany({
      where: { inviterId },
      select: { milestoneId: true },
    }),
  ])
  if (milestones.length === 0) return
  const triggeredSet = new Set(triggered.map((b) => b.milestoneId))
  const untriggered = milestones.filter((m) => !triggeredSet.has(m.id))
  if (untriggered.length === 0) return

  const inviteeCount = await tx.user.count({
    where: { inviterId, role: "DISTRIBUTOR", disabledAt: null },
  })

  for (const milestone of untriggered) {
    if (inviteeCount < milestone.thresholdCount) continue
    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          milestoneId: milestone.id,
          thresholdSnapshot: 0,
          countSnapshot: inviteeCount,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}
```

- [ ] **Step 3: 导出新函数**

在 `lib/domains/distributors/index.ts` 中找到 `checkAndIssueMilestoneBonuses` 的导出行，在其后加：
```typescript
checkAndIssueInvitationMilestoneBonuses,
```

- [ ] **Step 4: 运行现有里程碑测试**

```bash
npx jest __tests__/lib/complete-pending-order-milestone.test.ts --no-coverage
```

若测试中 mock 的 `invitationMilestone.findMany` 没有按 `type` 过滤可能需要更新 mock。如果测试失败，在 mock 对象里给里程碑加 `type: "SALES"` 字段：

```typescript
// 在测试的 mock milestone 对象中加：
type: "SALES",
```

- [ ] **Step 5: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "milestone-service\|distributors/index" | head -10
```

预期：无错误。

- [ ] **Step 6: Commit**

```bash
git add lib/domains/distributors/milestone-service.ts lib/domains/distributors/index.ts
git commit -m "feat(milestone): split INVITATION/SALES trigger logic"
```

---

## Task 6: acceptInvite 加 INVITATION 触发点

**Files:**
- Modify: `lib/domains/distributors/service.ts`
- Test: `lib/domains/distributors/__tests__/service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `lib/domains/distributors/__tests__/service.test.ts` 找到 `acceptInvite` 相关测试块（或新建），加：

```typescript
describe("acceptInvite - invitation milestone check", () => {
  it("calls checkAndIssueInvitationMilestoneBonuses after successful registration when inviter exists", async () => {
    // 假设已有 mock setup，新增断言：
    // checkAndIssueInvitationMilestoneBonuses 需被调用一次，参数为新用户 id
    expect(checkInvitationMilestoneMock).toHaveBeenCalledTimes(1)
    expect(checkInvitationMilestoneMock).toHaveBeenCalledWith(
      expect.anything(), // tx
      expect.any(String), // new user id
    )
  })

  it("does NOT call checkAndIssueInvitationMilestoneBonuses when inviter is not DISTRIBUTOR", async () => {
    expect(checkInvitationMilestoneMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest "lib/domains/distributors/__tests__/service.test.ts" --no-coverage -t "invitation milestone"
```

预期：FAIL（函数还未被调用）。

- [ ] **Step 3: 在 `acceptInvite` 事务中加 INVITATION 触发**

在 `lib/domains/distributors/service.ts` 的 `acceptInvite` 函数内，找到事务块末尾的 `createAccountRecord` 调用后，加：

```typescript
// 确认文件顶部已导入：
import { checkAndIssueMilestoneBonuses, checkAndIssueInvitationMilestoneBonuses } from "./milestone-service"

// 在事务末尾 createAccountRecord 后加：
if (newUserInviterId) {
  await checkAndIssueInvitationMilestoneBonuses(
    tx as Prisma.TransactionClient,
    user.id,
  )
}
```

注意 `Prisma` 需要在文件顶部导入：`import type { Prisma } from "@prisma/client"`（若已有则跳过）。

- [ ] **Step 4: 运行测试**

```bash
npx jest "lib/domains/distributors/__tests__/service.test.ts" --no-coverage
```

预期：新测试通过，原有测试不破坏。

- [ ] **Step 5: Commit**

```bash
git add lib/domains/distributors/service.ts lib/domains/distributors/__tests__/service.test.ts
git commit -m "feat(milestone): trigger INVITATION check on distributor registration"
```

---

## Task 7: 里程碑配置页加 type 字段

**Files:**
- Modify: `app/admin/(main)/invitation-milestones/invitation-milestones-columns.tsx`
- Modify: `app/admin/(main)/invitation-milestones/add-milestone-dialog.tsx`
- Modify: `app/admin/(main)/invitation-milestones/edit-milestone-dialog.tsx`
- Modify: `app/admin/(main)/invitation-milestones/page.tsx`

- [ ] **Step 1: 更新 `MilestoneRow` 类型并加 type 列**

在 `invitation-milestones-columns.tsx` 中：

```typescript
export type MilestoneRow = {
  id: string
  type: "INVITATION" | "SALES"
  thresholdAmount: number
  thresholdCount: number
  bonusAmount: number
  sortOrder: number
  createdAt: string
}
```

在 `invitationMilestonesColumns` 数组最前面加一列：

```typescript
{
  accessorKey: "type",
  header: () => <div>类型</div>,
  cell: ({ row }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      row.original.type === "INVITATION"
        ? "bg-blue-50 text-blue-700"
        : "bg-purple-50 text-purple-700"
    }`}>
      {row.original.type === "INVITATION" ? "👥 邀请" : "💹 销售"}
    </span>
  ),
},
```

- [ ] **Step 2: 更新 `page.tsx` 传 type 给 data**

在 `invitation-milestones/page.tsx` 的 `data` 映射中加 `type`：

```typescript
const data: MilestoneRow[] = milestones.map((m) => ({
  id: m.id,
  type: m.type,
  thresholdAmount: m.thresholdAmount,
  thresholdCount: m.thresholdCount,
  bonusAmount: m.bonusAmount,
  sortOrder: m.sortOrder,
  createdAt: m.createdAt.toISOString(),
}))
```

- [ ] **Step 3: 更新 `add-milestone-dialog.tsx` 加 type RadioGroup**

将 `add-milestone-dialog.tsx` 的 schema 替换为：

```typescript
const schema = z.object({
  type: z.enum(["INVITATION", "SALES"]),
  thresholdCount: z.string().optional(),
  thresholdAmount: z.string().optional(),
  bonusAmount: z
    .string()
    .min(1, "请输入奖励金额")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "必须大于 0"),
}).superRefine((data, ctx) => {
  if (data.type === "INVITATION") {
    if (!data.thresholdCount || !Number.isInteger(Number(data.thresholdCount)) || Number(data.thresholdCount) < 1) {
      ctx.addIssue({ code: "custom", message: "邀请人数至少为 1（整数）", path: ["thresholdCount"] })
    }
  }
  if (data.type === "SALES") {
    if (!data.thresholdAmount || isNaN(Number(data.thresholdAmount)) || Number(data.thresholdAmount) <= 0) {
      ctx.addIssue({ code: "custom", message: "门槛金额必须大于 0", path: ["thresholdAmount"] })
    }
  }
})
type FormValues = z.infer<typeof schema>
```

defaultValues：
```typescript
defaultValues: { type: "INVITATION", thresholdCount: "", thresholdAmount: "", bonusAmount: "" },
```

在表单最上面加 type RadioGroup（需导入 `RadioGroup`、`RadioGroupItem` from `@/components/ui/radio-group`）：

```tsx
<FormField
  control={form.control}
  name="type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>里程碑类型</FormLabel>
      <FormControl>
        <RadioGroup
          value={field.value}
          onValueChange={field.onChange}
          className="flex gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="INVITATION" id="type-invitation" />
            <label htmlFor="type-invitation" className="text-sm cursor-pointer">👥 邀请里程碑</label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="SALES" id="type-sales" />
            <label htmlFor="type-sales" className="text-sm cursor-pointer">💹 销售里程碑</label>
          </div>
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

用 `watch("type")` 控制显示哪个门槛字段（在 `useForm` 后加 `const watchedType = form.watch("type")`）：
- type === "INVITATION"：显示"邀请人数"字段（thresholdCount），隐藏 thresholdAmount
- type === "SALES"：显示"累计销售额门槛"字段（thresholdAmount），隐藏 thresholdCount

onSubmit 中：
```typescript
body: JSON.stringify({
  type: values.type,
  thresholdCount: values.type === "INVITATION" ? parseInt(values.thresholdCount!) : 0,
  thresholdAmount: values.type === "SALES" ? parseFloat(values.thresholdAmount!) : 0,
  bonusAmount: parseFloat(values.bonusAmount),
}),
```

- [ ] **Step 4: 同样更新 `edit-milestone-dialog.tsx`**

参照 Step 3 的方式更新 edit 表单（schema 相同，defaultValues 从 props 读取，包含 `type: props.type`）。

`InvitationMilestoneRowActions` 的 props 也要加 `type: "INVITATION" | "SALES"` 并传给 edit dialog。

- [ ] **Step 5: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "invitation-milestone" | head -20
```

预期：无错误。

- [ ] **Step 6: Commit**

```bash
git add app/admin/\(main\)/invitation-milestones/
git commit -m "feat(admin): add type selector to milestone CRUD"
```

---

## Task 8: Sales Report API 加成本字段

**Files:**
- Modify: `app/api/admin/sales-report/route.ts`

- [ ] **Step 1: 更新返回类型**

将 `SalesReportProduct` 和 `SalesReportResponse` 类型更新：

```typescript
export type SalesReportProduct = {
  productId: string
  productName: string
  quantity: number
  avgPrice: number
  revenue: number
  commission: number
  cost: number          // sum(quantity × costSnapshot)，已排除 null
  profit: number        // revenue - commission - cost
  margin: number        // profit / revenue，0 if revenue === 0
  hasMissingCost: boolean  // true if any order for this product has null costSnapshot
}

export type SalesReportResponse = {
  summary: {
    orderCount: number
    totalQuantity: number
    revenue: number
    cost: number
    milestoneBonus: number
    profit: number
    hasMissingCost: boolean
  }
  products: SalesReportProduct[]
}
```

- [ ] **Step 2: 更新 order 查询加 `costSnapshot` 和 `quantity`**

在 `prisma.order.findMany` 的 select 中加：
```typescript
select: {
  id: true,
  productId: true,
  productNameSnapshot: true,
  quantity: true,
  amount: true,
  costSnapshot: true,   // 新增
  product: { select: { name: true } },
},
```

- [ ] **Step 3: 更新 productMap 聚合逻辑，计算 cost**

在 `productMap` 的聚合循环中，将现有逻辑改为：

```typescript
const productMap = new Map<
  string,
  { productName: string; quantity: number; revenue: number; commission: number; cost: number; hasMissingCost: boolean }
>()

for (const order of orders) {
  const existing = productMap.get(order.productId)
  const name = order.productNameSnapshot ?? order.product.name
  const revenue = Number(order.amount)
  const commission = commissionByOrder.get(order.id) ?? 0
  const orderCost = order.costSnapshot !== null
    ? Number(order.costSnapshot) * order.quantity
    : 0
  const orderHasMissingCost = order.costSnapshot === null

  if (existing) {
    existing.quantity += order.quantity
    existing.revenue += revenue
    existing.commission += commission
    existing.cost += orderCost
    if (orderHasMissingCost) existing.hasMissingCost = true
  } else {
    productMap.set(order.productId, {
      productName: name,
      quantity: order.quantity,
      revenue,
      commission,
      cost: orderCost,
      hasMissingCost: orderHasMissingCost,
    })
  }
}
```

- [ ] **Step 4: 更新 products 数组映射**

```typescript
const products: SalesReportProduct[] = Array.from(productMap.entries())
  .map(([productId, data]) => {
    const profit = data.revenue - data.commission - data.cost
    return {
      productId,
      productName: data.productName,
      quantity: data.quantity,
      avgPrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
      revenue: data.revenue,
      commission: data.commission,
      cost: data.cost,
      profit,
      margin: data.revenue > 0 ? profit / data.revenue : 0,
      hasMissingCost: data.hasMissingCost,
    }
  })
  .sort((a, b) => b.profit - a.profit)
```

- [ ] **Step 5: 更新 summary 返回值**

```typescript
const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
const totalCommission = products.reduce((s, p) => s + p.commission, 0)
const totalCost = products.reduce((s, p) => s + p.cost, 0)
const hasMissingCost = products.some((p) => p.hasMissingCost)

return NextResponse.json<SalesReportResponse>({
  summary: {
    orderCount: orders.length,
    totalQuantity: products.reduce((s, p) => s + p.quantity, 0),
    revenue: totalRevenue,
    cost: totalCost,
    milestoneBonus,
    profit: totalRevenue - totalCommission - totalCost - milestoneBonus,
    hasMissingCost,
  },
  products,
})
```

- [ ] **Step 6: 更新空订单的 early return**

```typescript
if (orders.length === 0) {
  return NextResponse.json<SalesReportResponse>({
    summary: { orderCount: 0, totalQuantity: 0, revenue: 0, cost: 0, milestoneBonus, profit: 0, hasMissingCost: false },
    products: [],
  })
}
```

- [ ] **Step 7: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "sales-report" | head -10
```

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/sales-report/route.ts
git commit -m "feat(api): add cost/margin fields to sales-report"
```

---

## Task 9: Milestone Report API（新端点）

**Files:**
- Create: `app/api/admin/milestone-report/route.ts`

- [ ] **Step 1: 创建文件，定义返回类型**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"

export type MilestoneTierStat = {
  id: string
  thresholdCount: number
  thresholdAmount: number
  bonusAmount: number
  triggeredCount: number  // 已触发该档位的人数
}

export type MilestoneLeaderboardEntry = {
  inviterId: string
  name: string | null
  email: string
  value: number           // INVITATION: invitee count; SALES: team revenue
  currentTierId: string | null
  nextTierId: string | null
  nextTierGap: number     // INVITATION: people needed; SALES: revenue needed
  isCapped: boolean       // already hit highest tier
}

export type MilestoneReportResponse = {
  global: {
    totalDistributors: number
    newThisMonth: number
    totalBonusPaid: number
    totalTriggerCount: number
  }
  invitation: {
    tiers: MilestoneTierStat[]
    leaderboard: MilestoneLeaderboardEntry[]
  }
  sales: {
    tiers: MilestoneTierStat[]
    leaderboard: MilestoneLeaderboardEntry[]
  }
  newDistributors: Array<{
    id: string
    name: string | null
    email: string
    inviterName: string | null
    inviterEmail: string | null
    createdAt: string
  }>
}
```

- [ ] **Step 2: 实现 GET handler**

```typescript
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const now = new Date()
  const monthStart = fromZonedTime(
    new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    HKT,
  )

  const [
    totalDistributors,
    newThisMonth,
    totalBonusRow,
    totalTriggerCount,
    invitationMilestones,
    salesMilestones,
    allBonuses,
    newDistributorRows,
    allDistributors,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
    prisma.user.count({ where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } } }),
    prisma.invitationMilestoneBonus.aggregate({ _sum: { amount: true } }),
    prisma.invitationMilestoneBonus.count(),
    prisma.invitationMilestone.findMany({ where: { type: "INVITATION" }, orderBy: { thresholdCount: "asc" } }),
    prisma.invitationMilestone.findMany({ where: { type: "SALES" }, orderBy: { thresholdAmount: "asc" } }),
    prisma.invitationMilestoneBonus.findMany({ select: { inviterId: true, milestoneId: true } }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, createdAt: true,
        inviter: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", disabledAt: null },
      select: { id: true, name: true, email: true, inviterId: true },
    }),
  ])

  // Build bonus lookup: inviterId → Set<milestoneId>
  const bonusByInviter = new Map<string, Set<string>>()
  for (const b of allBonuses) {
    if (!bonusByInviter.has(b.inviterId)) bonusByInviter.set(b.inviterId, new Set())
    bonusByInviter.get(b.inviterId)!.add(b.milestoneId)
  }

  // Build tier triggered counts
  const triggeredCountById = new Map<string, number>()
  for (const b of allBonuses) {
    triggeredCountById.set(b.milestoneId, (triggeredCountById.get(b.milestoneId) ?? 0) + 1)
  }

  const toTierStat = (m: { id: string; thresholdCount: number; thresholdAmount: unknown; bonusAmount: unknown }): MilestoneTierStat => ({
    id: m.id,
    thresholdCount: m.thresholdCount,
    thresholdAmount: Number(m.thresholdAmount),
    bonusAmount: Number(m.bonusAmount),
    triggeredCount: triggeredCountById.get(m.id) ?? 0,
  })

  // INVITATION leaderboard: count invitees per inviter
  const inviterIds = [...new Set(allDistributors.map(d => d.inviterId).filter(Boolean) as string[])]
  const inviteeCounts = await Promise.all(
    inviterIds.map(inviterId =>
      prisma.user.count({ where: { inviterId, role: "DISTRIBUTOR", disabledAt: null } })
        .then(count => ({ inviterId, count }))
    )
  )
  const inviteeCountMap = new Map(inviteeCounts.map(r => [r.inviterId, r.count]))

  const buildInvitationLeaderboard = (): MilestoneLeaderboardEntry[] => {
    if (invitationMilestones.length === 0) return []
    return inviterIds
      .map(inviterId => {
        const user = allDistributors.find(d => d.id === inviterId)
        if (!user) return null
        const count = inviteeCountMap.get(inviterId) ?? 0
        const triggered = bonusByInviter.get(inviterId) ?? new Set()
        const highest = [...invitationMilestones].reverse().find(m => triggered.has(m.id))
        const next = invitationMilestones.find(m => !triggered.has(m.id) && m.thresholdCount > count)
        const isCapped = invitationMilestones.every(m => triggered.has(m.id))
        return {
          inviterId,
          name: user.name,
          email: user.email ?? "",
          value: count,
          currentTierId: highest?.id ?? null,
          nextTierId: next?.id ?? null,
          nextTierGap: next ? next.thresholdCount - count : 0,
          isCapped,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.value - a!.value)
      .slice(0, 20) as MilestoneLeaderboardEntry[]
  }

  // SALES leaderboard: sum invitee orders per inviter
  const salesByInviter = await Promise.all(
    inviterIds.map(async inviterId => {
      const invitees = allDistributors.filter(d => d.inviterId === inviterId).map(d => d.id)
      if (invitees.length === 0) return { inviterId, revenue: 0 }
      // Use earliest SALES milestone createdAt as lower bound (or epoch if none)
      const minCreatedAt = salesMilestones[0]?.createdAt ?? new Date(0)
      const result = await prisma.order.aggregate({
        where: { distributorId: { in: invitees }, status: "COMPLETED", paidAt: { gte: minCreatedAt } },
        _sum: { amount: true },
      })
      return { inviterId, revenue: Number(result._sum.amount ?? 0) }
    })
  )
  const salesRevenueMap = new Map(salesByInviter.map(r => [r.inviterId, r.revenue]))

  const buildSalesLeaderboard = (): MilestoneLeaderboardEntry[] => {
    if (salesMilestones.length === 0) return []
    return inviterIds
      .map(inviterId => {
        const user = allDistributors.find(d => d.id === inviterId)
        if (!user) return null
        const revenue = salesRevenueMap.get(inviterId) ?? 0
        const triggered = bonusByInviter.get(inviterId) ?? new Set()
        const highest = [...salesMilestones].reverse().find(m => triggered.has(m.id))
        const next = salesMilestones.find(m => !triggered.has(m.id) && Number(m.thresholdAmount) > revenue)
        const isCapped = salesMilestones.every(m => triggered.has(m.id))
        return {
          inviterId,
          name: user.name,
          email: user.email ?? "",
          value: revenue,
          currentTierId: highest?.id ?? null,
          nextTierId: next?.id ?? null,
          nextTierGap: next ? Number(next.thresholdAmount) - revenue : 0,
          isCapped,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.value - a!.value)
      .slice(0, 20) as MilestoneLeaderboardEntry[]
  }

  return NextResponse.json<MilestoneReportResponse>({
    global: {
      totalDistributors,
      newThisMonth,
      totalBonusPaid: Number(totalBonusRow._sum.amount ?? 0),
      totalTriggerCount,
    },
    invitation: {
      tiers: invitationMilestones.map(toTierStat),
      leaderboard: buildInvitationLeaderboard(),
    },
    sales: {
      tiers: salesMilestones.map(toTierStat),
      leaderboard: buildSalesLeaderboard(),
    },
    newDistributors: newDistributorRows.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email ?? "",
      inviterName: d.inviter?.name ?? null,
      inviterEmail: d.inviter?.email ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  })
}

export const runtime = "nodejs"
```

- [ ] **Step 3: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "milestone-report" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/milestone-report/route.ts
git commit -m "feat(api): add milestone-report endpoint for dashboard"
```

---

## Task 10: 全局 KPI 头

**Files:**
- Modify: `app/admin/(main)/dashboard/dashboard-data.ts`
- Create: `app/admin/(main)/dashboard/dashboard-global-kpi.tsx`

- [ ] **Step 1: 在 `dashboard-data.ts` 加 `getGlobalKPI` 函数**

在文件末尾添加：

```typescript
export type GlobalKPI = {
  todayRevenue: number
  todayProfit: number
  todayOrders: number
  lowStockCount: number
  hasMissingCost: boolean
}

export async function getGlobalKPI(): Promise<GlobalKPI> {
  const now = new Date()
  const todayStart = getHKTDayStart(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const [orders, commissions, milestoneBonus, lowStock] = await Promise.all([
    prisma.order.findMany({
      where: { status: "COMPLETED", paidAt: { gte: todayStart, lt: tomorrowStart } },
      select: { amount: true, quantity: true, costSnapshot: true },
    }),
    prisma.commission.aggregate({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: todayStart, lt: tomorrowStart },
      },
      _sum: { amount: true },
    }),
    prisma.invitationMilestoneBonus.aggregate({
      where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      _sum: { amount: true },
    }),
    prisma.card.groupBy({
      by: ["productId"],
      where: { status: "UNSOLD" },
      _count: { id: true },
      having: { id: { _count: { lt: LOW_STOCK_THRESHOLD } } },
    }),
  ])

  const todayRevenue = orders.reduce((s, o) => s + Number(o.amount), 0)
  const todayCost = orders.reduce((s, o) =>
    o.costSnapshot !== null ? s + Number(o.costSnapshot) * o.quantity : s, 0
  )
  const hasMissingCost = orders.some(o => o.costSnapshot === null)
  const todayCommission = Number(commissions._sum.amount ?? 0)
  const todayMilestoneBonus = Number(milestoneBonus._sum.amount ?? 0)

  return {
    todayRevenue,
    todayProfit: todayRevenue - todayCost - todayCommission - todayMilestoneBonus,
    todayOrders: orders.length,
    lowStockCount: lowStock.length,
    hasMissingCost,
  }
}
```

- [ ] **Step 2: 创建 `dashboard-global-kpi.tsx`**

```tsx
import { formatCurrency } from "@/lib/utils"
import type { GlobalKPI } from "./dashboard-data"

export function DashboardGlobalKPI({ kpi }: { kpi: GlobalKPI }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">今日营收</p>
        <p className="mt-1 text-xl font-bold">{formatCurrency(kpi.todayRevenue)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          今日净利润
          {kpi.hasMissingCost && (
            <span title="部分商品未设成本，利润偏高" className="cursor-help">⚠</span>
          )}
        </p>
        <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(kpi.todayProfit)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">今日订单</p>
        <p className="mt-1 text-xl font-bold">{kpi.todayOrders}</p>
      </div>
      <div className={`rounded-lg border bg-card p-3 ${kpi.lowStockCount > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
        <p className="text-xs text-muted-foreground">库存预警</p>
        <p className={`mt-1 text-xl font-bold ${kpi.lowStockCount > 0 ? "text-red-500" : ""}`}>
          {kpi.lowStockCount > 0 ? `${kpi.lowStockCount} 款` : "正常"}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-global-kpi\|dashboard-data" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/dashboard/dashboard-data.ts app/admin/\(main\)/dashboard/dashboard-global-kpi.tsx
git commit -m "feat(dashboard): add global KPI header component"
```

---

## Task 11: Dashboard Page 重组（Tab 框架）

**Files:**
- Modify: `app/admin/(main)/dashboard/page.tsx`

- [ ] **Step 1: 将 `page.tsx` 重组为全局 KPI + Tab 框架**

用以下内容完整替换 `app/admin/(main)/dashboard/page.tsx`：

```tsx
import { Suspense } from "react"
import { config } from "@/lib/config"
import { PageHeader } from "@/app/admin/components"
import { getGlobalKPI } from "./dashboard-data"
import { DashboardGlobalKPI } from "./dashboard-global-kpi"
import { DashboardTabs } from "./dashboard-tabs"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const kpi = await getGlobalKPI()

  return (
    <div className="space-y-6">
      <PageHeader
        title="概览"
        description={`欢迎使用 ${config.siteName} ${config.adminPanelLabel}`}
      />
      <DashboardGlobalKPI kpi={kpi} />
      <Suspense>
        <DashboardTabs lowStockCount={kpi.lowStockCount} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `dashboard-tabs.tsx`（Tab 切换框架，Client Component）**

```tsx
"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { DashboardSalesTab } from "./dashboard-sales-tab"
import { DashboardProfitTab } from "./dashboard-profit-tab"
import { DashboardMilestoneTab } from "./dashboard-milestone-tab"

const TABS = [
  { key: "sales", label: "📊 销量" },
  { key: "profit", label: "💰 利润" },
  { key: "milestones", label: "🏅 里程碑" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function DashboardTabs({ lowStockCount }: { lowStockCount: number }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = (searchParams.get("view") ?? "sales") as TabKey

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "sales" && <DashboardSalesTab lowStockCount={lowStockCount} />}
      {activeTab === "profit" && <DashboardProfitTab />}
      {activeTab === "milestones" && <DashboardMilestoneTab />}
    </div>
  )
}
```

- [ ] **Step 3: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page\|dashboard-tabs" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/dashboard/page.tsx app/admin/\(main\)/dashboard/dashboard-tabs.tsx
git commit -m "feat(dashboard): restructure page with global KPI + tab framework"
```

---

## Task 12: 销量 Tab

**Files:**
- Create: `app/admin/(main)/dashboard/dashboard-sales-tab.tsx`

- [ ] **Step 1: 创建 `dashboard-sales-tab.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTimeShort } from "@/lib/utils"
import { DashboardTrendSection, DashboardTopProductsChart } from "./dashboard-charts"
import { DashboardInventoryAlerts } from "./dashboard-inventory-alerts"
import { DashboardRestockPending } from "./dashboard-restock-pending"
import { getDashboardTrend, getTopProductsByRevenue, getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"
import { todayHKT, offsetDaysHKT, firstDayOfMonthHKT, mondayOfCurrentWeekHKT } from "./dashboard-hkt"

// Note: trend/inventory/restock/recent orders are SSR-fetched in parent and passed as props
// Sales KPI panel fetches client-side via sales-report API

async function fetchSalesReport(from: string, to: string): Promise<SalesReportResponse> {
  const res = await fetch(`/api/admin/sales-report?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

// Compare period: same length shifted back
function getComparePeriod(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
  const cTo = new Date(fromDate); cTo.setDate(cTo.getDate() - 1)
  const cFrom = new Date(cTo); cFrom.setDate(cFrom.getDate() - days + 1)
  return {
    from: cFrom.toLocaleDateString("en-CA"),
    to: cTo.toLocaleDateString("en-CA"),
  }
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  )
}

export function DashboardSalesTab({ lowStockCount }: { lowStockCount: number }) {
  const today = todayHKT()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const presets = [
    { label: "今日", from: today, to: today },
    { label: "昨日", from: offsetDaysHKT(-1), to: offsetDaysHKT(-1) },
    { label: "本周", from: mondayOfCurrentWeekHKT(), to: today },
    { label: "本月", from: firstDayOfMonthHKT(), to: today },
  ]
  const selectedPreset = presets.find((p) => p.from === from && p.to === to)?.label ?? ""

  const compare = getComparePeriod(from, to)
  const rangeDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1

  const { data, isLoading, isError } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", from, to],
    queryFn: () => fetchSalesReport(from, to),
    staleTime: 30_000,
  })
  const { data: prevData } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", compare.from, compare.to],
    queryFn: () => fetchSalesReport(compare.from, compare.to),
    staleTime: 60_000,
    enabled: rangeDays <= 90,
  })

  const summary = data?.summary
  const products = data?.products ?? []
  const totalQty = products.reduce((s, p) => s + p.quantity, 0)

  const voidRate =
    summary && summary.orderCount + (data as any)?.closedCount > 0
      ? 0  // closedCount not yet in API; placeholder
      : 0

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={selectedPreset === preset.label ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setFrom(preset.from); setTo(preset.to) }}
          >
            {preset.label}
          </Button>
        ))}
        <input
          type="date" value={from} max={to}
          className="h-7 rounded-md border px-2 text-xs"
          onChange={(e) => { if (e.target.value <= to) setFrom(e.target.value) }}
        />
        <span className="text-xs text-muted-foreground">至</span>
        <input
          type="date" value={to} min={from} max={today}
          className="h-7 rounded-md border px-2 text-xs"
          onChange={(e) => { if (e.target.value >= from) setTo(e.target.value) }}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />) : (
          <>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">订单数</p>
              <p className="mt-1 text-xl font-bold">{summary?.orderCount ?? 0}</p>
              {prevData && <DeltaBadge current={summary?.orderCount ?? 0} prev={prevData.summary.orderCount} />}
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">卡密销量</p>
              <p className="mt-1 text-xl font-bold">{summary?.totalQuantity ?? 0}</p>
              {prevData && <DeltaBadge current={summary?.totalQuantity ?? 0} prev={prevData.summary.totalQuantity} />}
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">均单价</p>
              <p className="mt-1 text-xl font-bold">
                {summary && summary.orderCount > 0 ? formatCurrency(summary.revenue / summary.orderCount) : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">库存预警商品</p>
              <p className={`mt-1 text-xl font-bold ${lowStockCount > 0 ? "text-red-500" : ""}`}>
                {lowStockCount > 0 ? `${lowStockCount} 款` : "正常"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Trend + Top products charts (fixed 30-day, from dashboard-data SSR) */}
      {/* These use the existing chart components but fetch their own data client-side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">近 30 日订单趋势</CardTitle></CardHeader>
          <CardContent><SalesTrendChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">商品跑量排行（按销量）</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-1.5">
                {products.slice(0, 8).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]">{p.productName}</span>
                    <span className="font-semibold tabular-nums">{p.quantity} 张</span>
                  </div>
                ))}
                {products.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory + Restock side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">库存预警</CardTitle></CardHeader>
          <CardContent><InventorySection /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">催货记录</CardTitle></CardHeader>
          <CardContent><RestockSection /></CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">最近订单</CardTitle>
          <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">查看全部</Link>
        </CardHeader>
        <CardContent><RecentOrdersSection /></CardContent>
      </Card>
    </div>
  )
}

// Sub-components that fetch their own data
function SalesTrendChart() {
  const { data: trend30 } = useQuery({
    queryKey: ["dashboard-trend", 30],
    queryFn: () => import("./dashboard-data").then(m => m.getDashboardTrend(30)),
    staleTime: 60_000,
  })
  // Re-use existing DashboardTrendSection with 30-day data
  if (!trend30) return <Skeleton className="h-32 w-full" />
  return <DashboardTrendSection trend7={[]} trend30={trend30} defaultDays={30} />
}

function InventorySection() {
  const { data } = useQuery({
    queryKey: ["dashboard-inventory"],
    queryFn: () => import("./dashboard-data").then(m => m.getInventoryByProduct()),
    staleTime: 60_000,
  })
  if (!data) return <Skeleton className="h-24 w-full" />
  return <DashboardInventoryAlerts data={data} />
}

function RestockSection() {
  const { data } = useQuery({
    queryKey: ["dashboard-restock"],
    queryFn: () => import("./dashboard-data").then(m => m.getRestockPending()),
    staleTime: 60_000,
  })
  if (!data) return <Skeleton className="h-24 w-full" />
  return <DashboardRestockPending data={data} />
}

function RecentOrdersSection() {
  const { data } = useQuery({
    queryKey: ["dashboard-recent-orders"],
    queryFn: () => import("./dashboard-data").then(m => m.getRecentOrders()),
    staleTime: 30_000,
  })
  if (!data) return <Skeleton className="h-32 w-full" />
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50 text-xs text-muted-foreground">
          <th className="px-3 py-2 text-left">订单号</th>
          <th className="px-3 py-2 text-left">商品</th>
          <th className="px-3 py-2 text-right">金额</th>
          <th className="px-3 py-2 text-right">状态</th>
        </tr></thead>
        <tbody>
          {data.map(o => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs">{o.orderNo}</td>
              <td className="px-3 py-2 max-w-[160px] truncate">{o.productNameSnapshot ?? o.product.name}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(Number(o.amount))}</td>
              <td className="px-3 py-2 text-right">
                <Badge variant={o.status === "COMPLETED" ? "default" : o.status === "PENDING" ? "secondary" : "outline"}>
                  {o.status === "COMPLETED" ? "已完成" : o.status === "PENDING" ? "待支付" : "已关闭"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**注意**：`getDashboardTrend`、`getInventoryByProduct`、`getRestockPending`、`getRecentOrders` 是服务端函数，不能在客户端直接 import 执行（会报 Prisma 错误）。将销量 Tab 的这些数据改为通过新 API 路由获取，或在 `page.tsx` SSR 时同时获取并作为 props 传入。

**修正方案**（更简单）：将 inventory/restock/recent-orders 数据在 `page.tsx` SSR 时一并获取，通过 props 传给 `DashboardSalesTab`：

修改 `page.tsx`：
```tsx
import { getGlobalKPI, getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"

export default async function AdminDashboardPage() {
  const [kpi, inventory, restockPending, recentOrders] = await Promise.all([
    getGlobalKPI(),
    getInventoryByProduct(),
    getRestockPending(),
    getRecentOrders(),
  ])
  return (
    <div className="space-y-6">
      <PageHeader ... />
      <DashboardGlobalKPI kpi={kpi} />
      <Suspense>
        <DashboardTabs
          lowStockCount={kpi.lowStockCount}
          inventory={inventory}
          restockPending={restockPending}
          recentOrders={recentOrders}
        />
      </Suspense>
    </div>
  )
}
```

移除 `dashboard-sales-tab.tsx` 中的 `InventorySection`、`RestockSection`、`RecentOrdersSection` sub-components，改为接收 props。

- [ ] **Step 2: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-sales-tab\|dashboard/page" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/dashboard/dashboard-sales-tab.tsx app/admin/\(main\)/dashboard/page.tsx app/admin/\(main\)/dashboard/dashboard-tabs.tsx
git commit -m "feat(dashboard): implement sales tab"
```

---

## Task 13: 利润 Tab

**Files:**
- Create: `app/admin/(main)/dashboard/dashboard-profit-tab.tsx`

- [ ] **Step 1: 创建 `dashboard-profit-tab.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"
import type { DistributorReportResponse } from "@/app/api/admin/distributor-report/route"
import { todayHKT, offsetDaysHKT, firstDayOfMonthHKT, mondayOfCurrentWeekHKT } from "./dashboard-hkt"

async function fetchSalesReport(from: string, to: string): Promise<SalesReportResponse> {
  const res = await fetch(`/api/admin/sales-report?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

async function fetchDistributorReport(from: string, to: string): Promise<DistributorReportResponse> {
  const res = await fetch(`/api/admin/distributor-report?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

export function DashboardProfitTab() {
  const today = todayHKT()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const presets = [
    { label: "今日", from: today, to: today },
    { label: "昨日", from: offsetDaysHKT(-1), to: offsetDaysHKT(-1) },
    { label: "本周", from: mondayOfCurrentWeekHKT(), to: today },
    { label: "本月", from: firstDayOfMonthHKT(), to: today },
  ]
  const selectedPreset = presets.find((p) => p.from === from && p.to === to)?.label ?? ""

  const { data, isLoading } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", from, to],
    queryFn: () => fetchSalesReport(from, to),
    staleTime: 30_000,
  })
  const { data: distData } = useQuery<DistributorReportResponse>({
    queryKey: ["distributor-report", from, to],
    queryFn: () => fetchDistributorReport(from, to),
    staleTime: 30_000,
  })

  const s = data?.summary
  const products = data?.products ?? []
  const leaderboard = distData?.leaderboard ?? []
  const hasMissing = s?.hasMissingCost

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={selectedPreset === preset.label ? "default" : "outline"}
            size="sm" className="h-7 text-xs"
            onClick={() => { setFrom(preset.from); setTo(preset.to) }}
          >
            {preset.label}
          </Button>
        ))}
        <input type="date" value={from} max={to} className="h-7 rounded-md border px-2 text-xs"
          onChange={(e) => { if (e.target.value <= to) setFrom(e.target.value) }} />
        <span className="text-xs text-muted-foreground">至</span>
        <input type="date" value={to} min={from} max={today} className="h-7 rounded-md border px-2 text-xs"
          onChange={(e) => { if (e.target.value >= from) setTo(e.target.value) }} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />) : (
          <>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">总营收</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(s?.revenue ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                采购成本 {hasMissing && <span title="部分商品未设成本" className="cursor-help">⚠</span>}
              </p>
              <p className="mt-1 text-xl font-bold text-amber-600">
                {s?.cost ? formatCurrency(s.cost) : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">佣金支出</p>
              <p className="mt-1 text-xl font-bold text-amber-600">
                {formatCurrency(
                  (s?.revenue ?? 0) - (s?.profit ?? 0) - (s?.cost ?? 0) - (s?.milestoneBonus ?? 0)
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">里程碑奖金</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(s?.milestoneBonus ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 col-span-1">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                净利润 {hasMissing && <span title="部分商品未设成本，利润偏高" className="cursor-help">⚠</span>}
              </p>
              <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(s?.profit ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">利润率</p>
              <p className="mt-1 text-xl font-bold text-green-600">
                {s && s.revenue > 0 ? `${Math.round((s.profit / s.revenue) * 100)}%` : "—"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Waterfall */}
      {s && (
        <Card>
          <CardHeader><CardTitle className="text-base">利润构成</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {[
                { label: "营收", value: s.revenue, sign: "" },
                { label: "采购成本", value: s.cost, sign: "−", amber: true },
                { label: "佣金支出", value: s.revenue - s.profit - s.cost - s.milestoneBonus, sign: "−", amber: true },
                { label: "里程碑奖金", value: s.milestoneBonus, sign: "−", amber: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className={item.amber ? "text-amber-600" : ""}>{item.sign} {item.label}</span>
                  <span className={item.amber ? "text-amber-600" : "font-semibold"}>
                    {item.sign}{formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-1.5 flex justify-between font-semibold">
                <span className={hasMissing ? "flex items-center gap-1" : ""}>
                  净利润 {hasMissing && <span title="部分商品未设成本，利润偏高" className="cursor-help text-amber-500">⚠</span>}
                </span>
                <span className="text-green-600">{formatCurrency(s.profit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product profit table */}
      <Card>
        <CardHeader><CardTitle className="text-base">商品利润明细</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : products.length === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无数据</p>
            : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">商品</th>
                    <th className="px-3 py-2 text-right">营收</th>
                    <th className="px-3 py-2 text-right">成本</th>
                    <th className="px-3 py-2 text-right">佣金</th>
                    <th className="px-3 py-2 text-right">净利润</th>
                    <th className="px-3 py-2 text-right">利润率</th>
                  </tr></thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.productId} className="border-b last:border-0">
                        <td className="px-3 py-2 max-w-[160px] truncate">{p.productName}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(p.revenue)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">
                          {p.hasMissingCost ? <span title="部分订单无成本数据">—⚠</span> : formatCurrency(p.cost)}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-600">{formatCurrency(p.commission)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-600">{formatCurrency(p.profit)}</td>
                        <td className="px-3 py-2 text-right">{Math.round(p.margin * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Distributor leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">分销员贡献排行</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">分销员</th>
                  <th className="px-3 py-2 text-right">贡献营收</th>
                  <th className="px-3 py-2 text-right">期间佣金</th>
                </tr></thead>
                <tbody>
                  {leaderboard.map((d) => (
                    <tr key={d.distributorId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/distributors`} className="hover:underline">
                          {d.name ?? d.email}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.revenue)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{formatCurrency(d.periodCommission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending withdrawals banner */}
      <PendingWithdrawalsBanner />
    </div>
  )
}

function PendingWithdrawalsBanner() {
  const { data } = useQuery({
    queryKey: ["pending-withdrawals-count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals/count")
      if (!res.ok) return null
      return res.json() as Promise<{ count: number }>
    },
    staleTime: 30_000,
  })
  if (!data || data.count === 0) return null
  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span>⚠ 待处理提现 <strong>{data.count} 笔</strong>，请及时审核</span>
      <Link href="/admin/withdrawals" className="underline hover:no-underline">去处理</Link>
    </div>
  )
}
```

- [ ] **Step 2: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-profit-tab" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/dashboard/dashboard-profit-tab.tsx
git commit -m "feat(dashboard): implement profit tab"
```

---

## Task 14: 里程碑 Tab

**Files:**
- Create: `app/admin/(main)/dashboard/dashboard-milestone-tab.tsx`

- [ ] **Step 1: 创建 `dashboard-milestone-tab.tsx`**

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { MilestoneReportResponse, MilestoneTierStat, MilestoneLeaderboardEntry } from "@/app/api/admin/milestone-report/route"

async function fetchMilestoneReport(): Promise<MilestoneReportResponse> {
  const res = await fetch("/api/admin/milestone-report")
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

export function DashboardMilestoneTab() {
  const { data, isLoading, isError } = useQuery<MilestoneReportResponse>({
    queryKey: ["milestone-report"],
    queryFn: fetchMilestoneReport,
    staleTime: 60_000,
  })

  if (isError) return <p className="py-8 text-center text-sm text-muted-foreground">加载失败，请刷新重试</p>

  const g = data?.global

  return (
    <div className="space-y-6">
      {/* Global stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />) : (
          <>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">总分销员</p>
              <p className="mt-1 text-xl font-bold">{g?.totalDistributors ?? 0} 人</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">本月新增</p>
              <p className="mt-1 text-xl font-bold text-green-600">+{g?.newThisMonth ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">里程碑奖金累计</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(g?.totalBonusPaid ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">已触发次数</p>
              <p className="mt-1 text-xl font-bold">{g?.totalTriggerCount ?? 0} 次</p>
            </div>
          </>
        )}
      </div>

      {/* Invitation milestones section */}
      <MilestoneSectionCard
        title="👥 邀请里程碑"
        description="邀请 N 人即触发，与销售额无关"
        tiers={data?.invitation.tiers ?? []}
        leaderboard={data?.invitation.leaderboard ?? []}
        type="INVITATION"
        isLoading={isLoading}
      />

      {/* Sales milestones section */}
      <MilestoneSectionCard
        title="💹 销售里程碑"
        description="被邀团队累计销售额达到门槛即触发"
        tiers={data?.sales.tiers ?? []}
        leaderboard={data?.sales.leaderboard ?? []}
        type="SALES"
        isLoading={isLoading}
      />

      {/* New distributors feed */}
      <Card>
        <CardHeader><CardTitle className="text-base">本月新增分销员</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : !data?.newDistributors.length
            ? <p className="py-4 text-center text-sm text-muted-foreground">本月暂无新增</p>
            : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">分销员</th>
                    <th className="px-3 py-2 text-left">来自</th>
                    <th className="px-3 py-2 text-right">时间</th>
                  </tr></thead>
                  <tbody>
                    {data.newDistributors.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{d.name ?? d.email}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {d.inviterName ?? d.inviterEmail ?? <span className="italic">直接注册</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {new Date(d.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Hong_Kong", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}

function MilestoneSectionCard({
  title, description, tiers, leaderboard, type, isLoading
}: {
  title: string
  description: string
  tiers: MilestoneTierStat[]
  leaderboard: MilestoneLeaderboardEntry[]
  type: "INVITATION" | "SALES"
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Skeleton className="h-24 w-full" /> : tiers.length === 0
          ? <p className="text-sm text-muted-foreground">暂未配置该类型里程碑</p>
          : (
            <>
              {/* Tier overview */}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">门槛</th>
                    <th className="px-3 py-2 text-right">奖金</th>
                    <th className="px-3 py-2 text-right">已触发人数</th>
                  </tr></thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {type === "INVITATION" ? `邀请 ${t.thresholdCount} 人` : formatCurrency(t.thresholdAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600 font-medium">+{formatCurrency(t.bonusAmount)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{t.triggeredCount} 人</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leaderboard with progress */}
              {leaderboard.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {type === "INVITATION" ? "邀请排行榜" : "销售排行榜"} · 进度
                  </p>
                  <div className="space-y-2">
                    {leaderboard.map((entry) => (
                      <div key={entry.inviterId} className="flex items-center gap-3 text-sm">
                        <span className="w-28 truncate font-medium">{entry.name ?? entry.email}</span>
                        <span className="w-24 text-right tabular-nums">
                          {type === "INVITATION" ? `${entry.value} 人` : formatCurrency(entry.value)}
                        </span>
                        <div className="flex-1 min-w-[80px]">
                          {entry.isCapped ? (
                            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">已满档</span>
                          ) : entry.nextTierId ? (
                            <div className="space-y-0.5">
                              <div className="h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full bg-foreground"
                                  style={{
                                    width: `${Math.min(100, Math.round(
                                      (entry.value / (entry.value + entry.nextTierGap)) * 100
                                    ))}%`
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                差 {type === "INVITATION" ? `${entry.nextTierGap} 人` : formatCurrency(entry.nextTierGap)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {/* Near-trigger alert */}
                        {!entry.isCapped && entry.nextTierId && (
                          type === "INVITATION"
                            ? entry.nextTierGap <= 2 && <span className="text-xs text-amber-600 font-medium">⚡ 即将触发</span>
                            : entry.nextTierGap / (entry.value + entry.nextTierGap) <= 0.2 && (
                              <span className="text-xs text-amber-600 font-medium">⚡ 即将触发</span>
                            )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        }
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-milestone-tab" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/dashboard/dashboard-milestone-tab.tsx
git commit -m "feat(dashboard): implement milestone tab"
```

---

## Task 15: 清理旧组件 + 全量验证

**Files:**
- Delete: `dashboard-sales-panel.tsx`, `dashboard-distributor-panel.tsx`, `dashboard-pending-withdrawals.tsx`

- [ ] **Step 1: 删除旧组件**

```bash
rm app/admin/\(main\)/dashboard/dashboard-sales-panel.tsx
rm app/admin/\(main\)/dashboard/dashboard-distributor-panel.tsx
rm app/admin/\(main\)/dashboard/dashboard-pending-withdrawals.tsx
```

- [ ] **Step 2: 确认无 import 引用**

```bash
grep -rn "dashboard-sales-panel\|dashboard-distributor-panel\|dashboard-pending-withdrawals" app/ --include="*.tsx" --include="*.ts"
```

预期：无输出（没有文件还在引用）。

- [ ] **Step 3: 运行全量 typecheck**

```bash
npx tsc --noEmit
```

预期：0 errors。

- [ ] **Step 4: 运行所有测试**

```bash
npm test -- --no-coverage
```

预期：所有测试通过。

- [ ] **Step 5: 运行完整 build**

```bash
npm run build
```

预期：Build passed，无 TypeScript 或 ESLint 错误。

- [ ] **Step 6: 最终 commit**

```bash
git add -A
git commit -m "feat(dashboard): complete redesign - sales/profit/milestone tabs with cost tracking"
```

---

## Self-Review 检查清单

经过 spec 对比验证：

| Spec 要求 | 对应任务 | 状态 |
|-----------|---------|------|
| Product.costPerUnit schema | Task 1 | ✅ |
| Order.costSnapshot schema | Task 1 | ✅ |
| MilestoneType enum | Task 1 | ✅ |
| 成本字段加到商品表单 | Task 2 | ✅ |
| costSnapshot 在订单完成时写入 | Task 3 | ✅ |
| Milestone validators 加 type | Task 4 | ✅ |
| SALES 触发逻辑（订单完成时） | Task 5 | ✅ |
| INVITATION 触发逻辑（注册时） | Task 5+6 | ✅ |
| 里程碑配置页加 type CRUD | Task 7 | ✅ |
| sales-report API 加成本字段 | Task 8 | ✅ |
| milestone-report API 新建 | Task 9 | ✅ |
| 全局 KPI 头（SSR） | Task 10 | ✅ |
| Tab 框架（URL 状态同步） | Task 11 | ✅ |
| 销量 Tab | Task 12 | ✅ |
| 利润 Tab（含瀑布、利润率） | Task 13 | ✅ |
| 里程碑 Tab（两类 + 进度条） | Task 14 | ✅ |
| 旧组件清理 | Task 15 | ✅ |
| 测试更新 | Task 3+6 | ✅ |
