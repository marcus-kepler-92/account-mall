# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Account Mall — AI 编码指南

> 卡密自动发卡平台。Next.js 16 App Router + React 19 + TypeScript + Prisma + PostgreSQL。

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建（prisma generate + next build）
npm run lint             # ESLint 检查
npm run lint:fix         # ESLint 自动修复

# 数据库
npm run db:migrate       # 创建并运行迁移（开发）
npm run db:generate      # 仅生成 Prisma Client
npm run db:push          # 推送 schema 变更（无迁移文件，适合原型）
npm run db:studio        # 打开 Prisma Studio
npm run db:seed          # 运行 seed 脚本

# 测试
npm test                 # 运行所有 Jest 单元测试
npm run test:watch       # Jest watch 模式
npm run test:coverage    # Jest 覆盖率报告
npx jest path/to/test    # 运行单个测试文件
npm run test:e2e         # 运行 Playwright E2E 测试
```

## 技术栈速查

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router, `proxy.ts` 替代 middleware) |
| 前端 | React 19 (RSC + Client Components) |
| UI | shadcn/ui (New York) + Tailwind CSS 4 + `@tailwindcss/typography`（prose 类依赖） |
| 数据库 | PostgreSQL 17 + Prisma 6 |
| 认证 | better-auth（邮箱+密码, 角色: ADMIN / DISTRIBUTOR） |
| 校验 | Zod (表单 + API) |
| 表单 | react-hook-form + @hookform/resolvers |
| 数据请求 | TanStack Query（服务端数据缓存） |
| 客户端状态 | Zustand（UI 状态） |
| 测试 | Jest + Testing Library (单元) / Playwright (E2E) |
| 部署 | Vercel / Docker |

## 目录结构与约定

```
account-mall/
├── app/                          # 路由 + 页面 + 就近放置的组件
│   ├── (routes)/                 # 各路由段
│   ├── api/                      # API 路由
│   ├── components/               # 应用级共享组件
│   ├── hooks/                    # 应用级 hooks
│   ├── emails/                   # React Email 模板
│   └── layout.tsx, page.tsx, globals.css
├── components/
│   └── ui/                       # shadcn/ui 原子组件（由 CLI 管理，勿手动改）
├── lib/                          # 业务逻辑 + 工具函数 + 服务端逻辑
│   ├── validations/              # Zod schema（按领域拆文件）
│   └── stores/                   # Zustand stores
├── hooks/                        # 全局通用 hooks
├── types/                        # 全局类型声明
├── prisma/                       # Schema + 迁移 + seed
├── __tests__/                    # Jest 测试（镜像 app/ 与 lib/ 结构）
├── e2e/                          # Playwright E2E 测试
├── automation/                   # 外部自动化脚本
├── docs/                         # 设计文档 / 调研报告
├── scripts/                      # 运维脚本
├── public/                       # 静态资源
├── proxy.ts                      # Next.js 16 网络中间件（路由守卫 + 鉴权）
└── 配置文件 (next.config.ts, tsconfig.json, jest.config.ts, ...)
```

### 核心原则

1. **就近放置 (Colocation)**：路由专用的组件、类型、常量放在对应路由文件夹内，不要提升到全局。
2. **共享上提**：被 ≥2 个路由使用的组件放 `app/components/`；被整个项目使用的 hook 放 `hooks/`。
3. **app/ 只放路由相关代码**：纯业务逻辑、工具函数、第三方服务封装放 `lib/`。
4. **shadcn/ui 组件不手改**：`components/ui/` 由 CLI 生成，自定义行为通过包装组件实现。

## 路由组织

```
app/
├── page.tsx                          # 首页（店铺）
├── products/[productIdSlug]/         # 商品详情
├── orders/                           # 订单（lookup, my, [orderNo], pay-return）
├── admin/
│   ├── login/                        # 管理后台登录
│   ├── (main)/                       # Route Group — 管理后台主布局
│   │   ├── layout.tsx                # 侧边栏 + auth-guard
│   │   ├── dashboard/
│   │   ├── products/, cards/, orders/, distributors/, ...
│   │   └── withdrawals/
│   └── components/                   # 后台专用组件（DataTable 系列）
├── distributor/
│   ├── login/, register/
│   └── (main)/                       # 分销员中心主布局
│       ├── commissions/, orders/, withdrawals/, guide/
│       └── layout.tsx
└── api/                              # API 路由
    ├── auth/[...all]/                # better-auth 全量处理
    ├── products/, orders/, cards/, tags/  # CRUD
    ├── payment/                      # 支付宝/z-pay 回调
    ├── admin/                        # Admin-only API
    ├── distributor/                  # 分销员 API
    └── cron/                         # 定时任务
```

**约定**：
- Route Group `(main)` 用于隔离需认证的布局，不影响 URL。
- 每个路由段可包含 `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`。
- 路由专用组件命名：`{route}-{purpose}.tsx`，如 `dashboard-charts.tsx`、`cards-columns.tsx`。

## 组件分层

| 位置 | 用途 | 示例 |
|------|------|------|
| `components/ui/` | shadcn/ui 原子组件 | Button, Dialog, Table, Form, RadioGroup |
| `app/components/` | 应用级业务组件（≥2 路由复用） | ProductCatalog, ProductCard, SiteHeader |
| `app/admin/(main)/{route}/` | 路由专用组件（就近放置） | `*-columns.tsx`, `*-data-table.tsx`, `*-row-actions.tsx` |
| `app/{route}/` | 路由专用组件（非 admin） | `register-form.tsx`, `restock-reminder-form.tsx` |

**命名**：组件文件 kebab-case（`product-card.tsx`），组件导出 PascalCase（`ProductCard`）。

**大型业务组件拆分**：单文件超 ~200 行时，按 UI 区块拆为 `{component}-{section}.tsx`（如 `product-catalog-filters.tsx`, `product-catalog-grid.tsx`），主文件只做状态管理和组合。

## lib/ 组织

按**功能职责**拆分，每个文件做一件事：

| 文件/目录 | 职责 |
|-----------|------|
| `prisma.ts` | Prisma 客户端单例 |
| `auth.ts` / `auth-client.ts` / `auth-guard.ts` | 认证配置 / 客户端实例 / 服务端守卫 |
| `config.ts` / `config-client.ts` | 服务端环境变量（Zod 校验） / 客户端安全配置 |
| `api-response.ts` | API 响应辅助函数（badRequest, validationError, ...） |
| `validations/*.ts` | Zod schema（按领域：order, product, card, announcement, ...） |
| `stores/*.ts` | Zustand store |
| `alipay.ts` / `zpay.ts` / `get-payment-url.ts` | 支付集成 |
| `rate-limit.ts` / `turnstile.ts` | 安全与限流 |
| `utils.ts` | 通用工具函数（cn, generateSlug） |
| `form-utils.ts` | 表单错误映射（applyFieldErrors） |

**约定**：
- 服务端专用代码（数据库、环境变量）不要在 `"use client"` 文件中导入。
- `config.ts` 仅服务端使用；客户端用 `config-client.ts`。

## 编码约定

### 路径别名

```typescript
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
```

`@/` 映射到项目根目录（tsconfig paths）。

### API 路由模式

```typescript
// app/api/products/route.ts
import { apiResponse } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { productSchema } from "@/lib/validations/product"

export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) {
  // 1. 鉴权（需要时）
  // 2. 解析 & Zod 校验 body
  // 3. 业务逻辑（Prisma 操作）
  // 4. 返回统一格式响应
}
```

### 表单模式

```typescript
// 1. Zod schema 在 lib/validations/ 定义
// 2. 组件用 useForm + zodResolver
// 3. 服务端校验失败时用 applyFieldErrors 映射到表单
const form = useForm({ resolver: zodResolver(schema) })
```

**字段渲染**：用 shadcn `<FormField>` 包装所有字段，自动绑定错误信息。

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>标签</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**大型表单拆分**：超过约 200 行的表单拆为子组件，子组件用 `useFormContext()` 读取 form 状态，无需 prop drilling。

```tsx
// 子组件
import { useFormContext } from "react-hook-form"
export function ProductFormBasicFields() {
  const { control } = useFormContext()
  // 渲染 FormField...
}

// 父表单
const form = useForm(...)
return <FormProvider {...form}><ProductFormBasicFields /></FormProvider>
```

### 后台列表页模式（DataTable 四件套）

后台 CRUD 列表统一使用 `DataTable` 组件（基于 TanStack Table），每个列表页标准文件结构：

```
app/admin/(main)/{resource}/
├── page.tsx                    # 服务端数据获取 + 页面布局
├── {resource}-columns.tsx      # 列定义（ColumnDef[]）+ Row 类型导出
├── {resource}-data-table.tsx   # useReactTable + Toolbar + Pagination
├── {resource}-row-actions.tsx  # 行操作（DropdownMenu + 确认弹窗）
├── {resource}-filters.ts       # （服务端分页时）URL 参数解析
└── loading.tsx                 # 加载骨架
```

**两种数据模式**（按数据量选择）：
- **客户端过滤**（数据量 <100，如 products/announcements/guides/commission-tiers）：`page.tsx` 全量查询，DataTable 用 `getFilteredRowModel()` + `getSortedRowModel()`
- **服务端分页**（数据量可增长，如 cards/orders/distributors/withdrawals）：`page.tsx` 接收 `searchParams` 解析筛选/分页，DataTable 用 `manualPagination: true` + `manualFiltering: true`

**`*-columns.tsx` 规范**：
- 只放 `ColumnDef` 定义 + `Row` 类型导出，不放有状态的组件
- `import type { ColumnDef }` (type-only import)
- 从 barrel 导入：`from "@/app/admin/components"`
- 始终设置 `getRowId: (row) => row.id`
- 货币用 `formatCurrency()` from `@/lib/utils`，日期用 `formatDateTime()`

**`*-row-actions.tsx` 规范**：
- 始终独立文件，不在 columns 中内联有状态组件
- 触发按钮：`<Button variant="ghost" size="icon" className="size-8">`，图标 `size-4`
- 破坏性操作用 `AlertDialog`（state-controlled open），非破坏性用 `Dialog`
- 操作后 `router.refresh()` 刷新数据

**`*-data-table.tsx` 规范**：
- 服务端分页页面：`DataTableToolbar` + `DataTableFacetedFilter` + `DataTablePagination`（均从 `@/app/admin/components` 导入）
- 客户端过滤页面：`DataTable` + `DataTableViewOptions`（可手工搭配 Input + Badge 筛选）
- 批量操作用 `DataTableSelectionBar`
- 服务端分页时 `DataTablePagination` 从 `useSearchParams()` 读 page/pageSize，**不**从 `table.getState().pagination` 读；`useReactTable` 设 `manualPagination: true` 但不传 `pagination` state

**Next 16 `searchParams` 是 Promise**：RSC `page.tsx` 接收的 `searchParams` 类型为 `Promise<{...}>`，必须先 `await` 再解析：
```typescript
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const filters = parseFilters(params)
  // ...
}
```

**批量操作 API 约定**：
- 路由：`POST /api/{resource}/batch`
- Body：`{ action: "DELETE" | "DISABLE" | "ENABLE", ids: string[] }`
- 响应：`{ success: number, skipped?: number, errors?: string[] }`
- 按业务规则限制允许的状态（如只有 UNSOLD 的卡密可删除）

**代码风格**：
- 不用分号（ASI）
- 图标 `size-4`（Tailwind 4 shorthand），不用 `h-4 w-4`

### URL 状态同步

以 URL 为单一数据源，不用 useState 复制 URL 参数。适用于列表筛选、分类、分页等可分享链接场景。

- 用 `useSearchParams()` 读 query，展示值直接从 URL 派生，**不**用 `useState` 存同含义的数据。
- 仅在**事件处理函数**里 `router.replace(pathname + '?' + newQuery, { scroll: false })`，**不**用 `useEffect` 写 URL（易死循环）。
- 依赖 URL 的 effect 用**稳定原始类型**（如 `searchParams.get("tag") ?? ""`）做依赖，不用解析后的引用类型（如数组），否则每次渲染新引用 → effect 无限触发。
- 实现参考：`app/components/product-catalog.tsx`。
- 复杂 query 可考虑 [nuqs](https://github.com/47ng/nuqs)。

**若必须双向同步（不推荐）**：URL → state 时，仅当 URL 中**确有该参数**才覆盖 state，URL 为空时不清空 state（防止 `router.replace` 未生效前的短暂空 URL 导致振荡）；state → URL 时，仅当新旧参数字符串**不相等**才 `router.replace`。

## 认证与授权

- **proxy.ts**：网络边界，检查 cookie 做粗粒度路由守卫（公开 vs 需登录）。
- **layout auth-guard**：`admin/(main)/layout.tsx` 和 `distributor/(main)/layout.tsx` 调用 `getAdminSession()` / `getDistributorSession()` 做角色校验。
- **API 路由**：受保护 API 在 handler 内调用 auth-guard 校验 session + 角色。

## 测试约定

- **单元/集成测试**（Jest）：放 `__tests__/`，目录结构镜像源码。
- **E2E 测试**（Playwright）：放 `e2e/`，按用户流程命名（`home.spec.ts`、`payment-flow.spec.ts`）。
- **Mock**：`__mocks__/` 放全局 mock（如 `prisma.ts`）。

## Prisma 迁移与 Vercel 部署

Vercel 构建命令（`vercel-build`）会自动执行 `prisma migrate deploy`，无需手动干预。

**不要在部署前手动执行迁移 SQL**。Prisma 自己会在构建时跑，手动跑会导致迁移重复执行，触发 P3018（列已存在）→ P3009（有失败迁移记录）的连锁错误。

唯一需要手动操作数据库的场景：迁移文件包含 Prisma 无法自动处理的操作（如某些 DDL 约束），此时用 `prisma migrate resolve --applied <migration_name>` 标记已手动完成，而不是直接跑 SQL。

## 环境变量

- 所有环境变量在 `lib/config.ts` 用 Zod 集中校验，带默认值和类型。
- 客户端可用变量以 `NEXT_PUBLIC_` 前缀标识，在 `lib/config-client.ts` 管理。
- `.env.example` 是模板，实际值在 `.env`（已 gitignore）。

## 写代码前须知

1. **先读再改**：修改文件前必须先读取当前内容。
2. **遵循就近原则**：新组件优先放路由文件夹内，确认被复用后再提升。
3. **保持一致性**：新增文件的命名、导出、结构参考同层级已有文件。
4. **校验贯穿全栈**：前端 Zod + 后端 Zod，共享 schema。
5. **类型安全**：充分利用 Prisma 生成的类型和 Zod infer 类型，避免手写重复类型。
6. **不引入新依赖**前先检查现有工具是否能解决问题。
7. **shadcn 组件优先**：所有表单元素用 shadcn Form + FormField；单选用 RadioGroup；勿用原生 `<input type="radio">`。
8. **useSearchParams 必须包 Suspense**：凡是调用 `useSearchParams()` 的客户端组件，其父级 `page.tsx` 必须用 `<Suspense>` 包裹。
9. **外部 mutable store 用 `useSyncExternalStore`**：读取 `localStorage`、`sessionStorage` 等外部可变存储时，使用 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`，不要用 `useState` + `useEffect` 同步（会触发 SSR hydration mismatch 且违反 lint 规则）。`getServerSnapshot` 返回固定值以保证 SSR 一致性。参考实现：`app/components/theme-toggle.tsx`。
