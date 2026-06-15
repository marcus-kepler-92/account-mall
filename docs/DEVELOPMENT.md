# Account Mall — Developer Handbook

> 写任何功能前必读。

## 全局规范（适用所有 Next.js 项目）

参考 `~/.claude/handbook/nextjs-best-practices.md`

涵盖：架构原则、React 组件、表单、状态管理、API Route、RSC、认证、测试、常见反模式。

---

## 本项目专项约定

以下内容是 account-mall 特有的约定，是对全局手册的补充，不是替代。

### 领域模块架构

本项目采用 FSD 函数式领域模块，完整设计见：

> `docs/superpowers/specs/2026-04-16-domain-architecture-design.md`

**规则速查：**
- 所有新业务逻辑 → `lib/domains/{domain}/service.ts`
- 所有新 Prisma 查询 → `lib/domains/{domain}/repository.ts`
- 外部消费者只 import `lib/domains/{domain}/index.ts`
- 多步写操作必须用 `prisma.$transaction`
- Route handler ≤ 20 行，零业务逻辑

**当前已迁移的领域：**
- `cards`（试点）

**待迁移（仍在 `lib/` 平铺）：** orders、products、payments、distributors、…

---

### 后台列表页（DataTable 四件套）

每个 admin 列表页标准文件结构：

```
app/admin/(main)/{resource}/
├── page.tsx                    # 服务端数据获取 + 页面布局
├── {resource}-columns.tsx      # ColumnDef[] + Row 类型
├── {resource}-data-table.tsx   # useReactTable + Toolbar + Pagination
├── {resource}-row-actions.tsx  # DropdownMenu + 确认弹窗
├── {resource}-filters.ts       # URL 参数解析（服务端分页时）
└── loading.tsx
```

**数据模式选择：**

| 场景 | 模式 |
|------|------|
| 数据量 <100（products、announcements） | 客户端过滤：`getFilteredRowModel()` |
| 数据量可增长（cards、orders、distributors） | 服务端分页：`manualPagination: true` |

**columns.tsx 规范：**
- 只放 `ColumnDef` + `Row` 类型，不放有状态组件
- `getRowId: (row) => row.id`
- 货币用 `formatCurrency()`，日期用 `formatDateTime()`（来自 `@/lib/utils`）
- 从 `@/app/admin/components` 导入公共组件

**row-actions.tsx 规范：**
- 触发按钮：`<Button variant="ghost" size="icon" className="size-8">`，图标 `className="size-4"`
- 破坏性操作用 `AlertDialog`，非破坏性用 `Dialog`
- 操作后 `router.refresh()`

**服务端分页时：**
- `DataTablePagination` 从 `useSearchParams()` 读 page/pageSize，不从 `table.getState().pagination` 读
- `searchParams` 在 RSC 里必须先 `await`（Next.js 16）

---

### 认证角色

| 角色 | Guard 函数 | 可访问范围 |
|------|-----------|-----------|
| SUPER_ADMIN | `getSuperAdminSession()` | 全部功能 |
| SYSTEM_OPS | `getAdminSession()` | 部分功能（见 admin-role-config.ts） |
| DISTRIBUTOR | `getDistributorSession()` | 分销员中心 |

破坏性操作（永久删除、批量删除、关闭过期订单）仅 SUPER_ADMIN。

---

### 支付集成

- `lib/alipay.ts`：支付宝官方 SDK
- `lib/zpay.ts`：z-pay聚合
- `lib/get-payment-url.ts`：统一入口，根据 `PaymentChannel` 路由到对应实现
- 回调处理：`app/api/payment/`

新增支付渠道只需扩展 `get-payment-url.ts`，不改回调逻辑。

---

### 环境变量

- 服务端变量：`lib/config.ts`（Zod 校验，带默认值）
- 客户端变量：`lib/config-client.ts`（只放 `NEXT_PUBLIC_` 前缀）
- `.env.example` 是模板，实际值在 `.env`（已 gitignore）

**Client Component 只能 import `config-client.ts`，不能 import `config.ts`。**
