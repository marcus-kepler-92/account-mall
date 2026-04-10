# 佣金阶梯编辑功能设计

**日期：** 2026-04-10
**状态：** 已确认

## 背景

佣金阶梯页面（`/admin/commission-tiers`）目前支持新增和删除档位，缺少编辑功能。PATCH API 已存在且完整，只需补充前端 UI。

## 目标

在档位列表每行的操作区新增"编辑"入口，允许管理员修改已有档位的销售额区间和佣金比例。

## 方案

方案 A（已确认）：新建独立 `edit-tier-dialog.tsx`，与 `add-tier-dialog.tsx` 对称。

## 涉及文件

### 新建：`app/admin/(main)/commission-tiers/edit-tier-dialog.tsx`

- Props：`tier: { id: string; minAmount: number; maxAmount: number; ratePercent: number }`
- 复用 `add-tier-dialog.tsx` 的 Zod schema（下限 < 上限，比例 0-100）
- `defaultValues` 预填当前值（number → string 转换）
- 提交：`PATCH /api/admin/commission-tiers/{id}`，body 传三个字段
- 成功：toast.success + 关闭 dialog + `router.refresh()`
- 失败：toast.error

### 修改：`app/admin/(main)/commission-tiers/commission-tier-row-actions.tsx`

- Props 从 `{ id: string }` 扩展为 `{ id: string; minAmount: number; maxAmount: number; ratePercent: number }`
- 新增"编辑"按钮（Pencil 图标），点击打开 `EditTierDialog`
- 删除按钮保持不变

### 修改：`app/admin/(main)/commission-tiers/commission-tiers-columns.tsx`

- `actions` cell：从只传 `id` 改为传完整 row 数据给 `CommissionTierRowActions`

## 不变范围

- API 无需改动（`PATCH /api/admin/commission-tiers/[id]` 已完整实现）
- `sortOrder` 字段不纳入编辑表单（由其他排序机制管理）
- 无新依赖引入

## 验收标准

1. 点击编辑按钮，dialog 打开且三个字段预填当前值
2. 修改后提交，数据正确更新，列表刷新
3. 校验生效：下限 ≥ 上限时提示错误，比例超 100 时提示错误
4. 取消或关闭 dialog，表单重置为当前值（不保留未提交的修改）
