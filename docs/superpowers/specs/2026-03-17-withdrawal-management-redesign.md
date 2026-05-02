# 提现管理 UI/UX 重设计

**日期**：2026-03-17
**场景**：管理员在移动端处理分销员提现申请（查码 → 打款 → 确认）

---

## 问题

现有流程需要 3 次独立操作：

1. 列表页浏览（9 列 DataTable，移动端横向溢出）
2. 点「查看」收款码 → Dialog 弹出（仅有二维码，不知道转多少钱）→ 关闭
3. 点「标记已打款」→ 另一个 Dialog 弹出（余额明细 + 备注 + 确认）

核心痛点：看码和操作是割裂的两个弹窗；移动端列表不可用。

---

## 设计目标

- 移动端能快速扫码 + 确认金额 + 标记打款，一次操作完成
- 桌面端体验不退化
- 与项目已有 Sheet + AlertDialog 模式保持一致

---

## 改动范围

### 1. 移动端列表列精简

**触发条件**：视口宽度 `< md`（768px）

隐藏列（通过 `useMediaQuery("(max-width: 767px)")` 设置 TanStack Table `columnVisibility` 初始值）：

| 隐藏的列 | 原因 |
|---------|------|
| `amount`（申请金额） | 移动端改为显示实付金额，两列同时显示多余 |
| `currentBalance`（可提现余额） | 合并进 Sheet 展示 |
| `receipt`（收款码查看按钮） | 合并进 Sheet，独立入口废弃 |
| `createdAt`（申请时间） | 移动端次要信息 |
| `note`（备注） | 移动端次要信息 |

**保留列**：`distributor`（分销员）/ `actualAmount`（移动端 header 改为「打款金额」）/ `status`（状态）/ `actions`（操作）

桌面端所有列保持不变，`actualAmount` header 仍显示「实付金额」。

---

### 2. 「处理」入口

- 现有「标记已打款」+「拒绝」两个按钮合并为单一「处理」按钮
- 仅对 `PENDING` 状态行显示
- 移动端和桌面端统一使用此入口

---

### 3. 提现处理 Sheet（新建 `withdrawal-process-sheet.tsx`）

**组件位置**：`app/admin/(main)/withdrawals/withdrawal-process-sheet.tsx`

**触发**：点击「处理」按钮

**Sheet 配置**：`<SheetContent className="flex flex-col w-full sm:max-w-md">` — 移动端全屏，桌面端右侧 448px，与现有 `distributor-detail-sheet.tsx` 一致。

**Sheet 内容结构**（`SheetHeader` + 滚动内容区）：

```
SheetHeader (border-b pb-4 shrink-0)
  ├─ 分销员姓名  +  待处理 Badge
  └─ 邮箱 / 用户名  ·  申请时间

内容区 (flex-1 overflow-y-auto p-4 space-y-6)
  ├─ 金额 banner（打款金额大字 + 手续费明细）
  ├─ 收款码图片（居中，max-h-[40vh]）
  ├─ Separator
  ├─ 余额明细（KV 行，与 distributor-detail-sheet 风格一致）
  │    一级佣金（已结算）/ 二级佣金（已结算）
  │    已打款 / 提现中（含本次）/ 可提现余额（粗体）
  └─ 操作按钮行
       [✓ 已打款]  [✗ 拒绝]
```

**状态管理**：`withdrawal-process-sheet.tsx` 内持有：
- `action: "PAID" | "REJECTED" | null`（AlertDialog 打开状态）
- `note: string`（备注输入）
- `loading: boolean`（提交中）

AlertDialog 逻辑（提交 API、toast、关闭）全部在此组件内。

---

### 4. 确认 AlertDialog（复用现有模式）

点击「已打款」或「拒绝」后，在 Sheet **之上**弹出 AlertDialog：

```
AlertDialog
  ├─ Title：确认已打款 / 确认拒绝
  ├─ Description：王小明 申请提现 ¥188，实付 ¥176.72
  ├─ Input：备注（可选），placeholder 随 action 变化
  └─ Footer：[取消]  [确认已打款 / 确认拒绝]
```

- AlertDialog 内嵌备注 Input，与现有 `withdrawal-row-actions.tsx` 逻辑一致
- 确认后调用现有 `PATCH /api/admin/withdrawals/:id` 接口
- 成功后关闭 AlertDialog + Sheet，`router.refresh()`

---

### 5. 废弃 `receipt-cell.tsx` 独立查看入口

- `receipt` 列在移动端隐藏，桌面端保留（用户可能仍希望快速查码而不打开完整 Sheet）
- 上一次已给 `ReceiptCell` 加了金额 banner，桌面端保留此改动

---

### 6. `withdrawal-row-actions.tsx` 重构

现有组件包含「标记已打款」+「拒绝」两个按钮及各自的 Dialog。

重构后：
- 改为单一「处理」按钮，接收 `onProcess: (row: WithdrawalRow) => void` prop
- 点击时调用 `onProcess(row)`，由 DataTable 层控制 Sheet 开/关
- 移除组件内的两个 Dialog（逻辑移入新 Sheet 组件）

`withdrawalsColumns` 由静态数组改为工厂函数：

```ts
export function makeWithdrawalsColumns(
  onProcess: (row: WithdrawalRow) => void
): ColumnDef<WithdrawalRow>[]
```

DataTable 持有 `selectedRow` state，调用 `makeWithdrawalsColumns(row => setSelectedRow(row))` 生成列定义，`useMemo` 包裹避免重渲染。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `withdrawal-process-sheet.tsx` | **新建**，Sheet + AlertDialog 完整逻辑 |
| `withdrawal-row-actions.tsx` | **修改**，简化为单一「处理」按钮 + `onProcess` 回调 |
| `withdrawals-columns.tsx` | **修改**，静态数组改为 `makeWithdrawalsColumns(onProcess)` 工厂函数；`actualAmount` header 移动端显示「打款金额」 |
| `withdrawals-data-table.tsx` | **修改**，持有 `selectedRow` state；用 `useMediaQuery` 设置移动端 `columnVisibility` 初始值（隐藏 `amount` / `currentBalance` / `receipt` / `createdAt` / `note`）；渲染 `WithdrawalProcessSheet` |
| `receipt-cell.tsx` | **保留**，桌面端继续使用，不改动 |

---

## 不在本次范围内

- 列表筛选 / 搜索 / 分页逻辑
- 分销员端页面
- 桌面端列表布局调整
- 拒绝流程的额外通知（邮件/站内信）
