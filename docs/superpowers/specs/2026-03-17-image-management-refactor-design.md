# Image Management Refactor Design

**Date:** 2026-03-17  
**Scope:** 商品图片选择功能 + 图片管理逻辑重构

## Problem

1. 商品创建/编辑时只能上传新图片，无法复用已上传的图片
2. 上传逻辑散落在多处组件，维护成本高
3. `/admin/files` 页面的状态管理全部内联在 `page.tsx`，代码臃肿

## Solution Overview

抽出一个 `MediaLibrary` 共享组件，通过 `mode` prop 区分「管理」和「选择器」两种行为。

- `/admin/files` 页面直接渲染 `<MediaLibrary mode="manage" />`
- 商品表单通过 `ImagePickerDialog`（内嵌 `<MediaLibrary mode="picker" />`）选择已有图片

## Components

### `app/admin/components/media-library.tsx`

**Props:**
```ts
type MediaLibraryProps =
  | { mode: "manage" }
  | { mode: "picker"; onSelect: (url: string) => void }
```

**功能（两种模式共有）：**
- Tab 切换：products / guides / announcements / receipts
- 图片网格（5列，aspect-ratio 1:1）
- 游标分页（`/api/admin/files?prefix=&cursor=&limit=20`）
- 点击图片高亮选中

**manage 模式专有：**
- Grid / List 视图切换
- 拖拽/点击上传（调用 `/api/upload/image`）
- 单张删除（AlertDialog 确认）
- 批量选择 + 批量删除
- 复制 URL 到剪贴板

**picker 模式专有：**
- 单选高亮（点击即选中，再点取消）
- 隐藏删除、批量操作、复制按钮
- 底部「确认选择」按钮，调用 `onSelect(url)` 后关闭 Dialog

### `app/admin/components/image-picker-dialog.tsx`

```ts
interface ImagePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
}
```

- shadcn `Dialog`，宽度 `max-w-3xl`
- 内部渲染 `<MediaLibrary mode="picker" onSelect={...} />`
- `onSelect` 触发后自动调用 `onOpenChange(false)` 关闭

### `app/components/product-form-basic-fields.tsx`（修改）

**无图片时：**
- 保持现有拖拽上传区
- 区域内增加「从图库选择」次要按钮（`variant="outline"`）

**有图片时：**
- 保持现有缩略图预览 + 删除按钮
- 增加「更换」下拉或并列按钮：「重新上传」和「从图库选择」

图库选中后与上传成功走相同路径：`form.setValue("image", url)`

### `app/admin/(main)/files/page.tsx`（简化）

删除所有内联状态（tabs、view mode、pagination、selection、upload）——这些全部迁移进 `MediaLibrary`。页面只剩页头 + `<MediaLibrary mode="manage" />`。

## API（不变）

| 端点 | 用途 |
|------|------|
| `GET /api/admin/files?prefix=&cursor=&limit=` | 列举文件 |
| `DELETE /api/admin/files` body: `{ urls[] }` | 批量删除 |
| `POST /api/upload/image` | 上传文件 |

## Data Flow

```
picker 模式:
  用户点击「从图库选择」
  → ImagePickerDialog open=true
  → MediaLibrary 加载当前 tab 的图片列表
  → 用户点击图片 → 高亮
  → 点击「确认选择」→ onSelect(url) → form.setValue("image", url)
  → Dialog 关闭

manage 模式:
  /admin/files 渲染 MediaLibrary
  → 与现有行为一致（上传、删除、分页、复制）
```

## Out of Scope

- 提现表单的收款凭证上传（逻辑不同，不纳入）
- 多图选择（商品只需一张图）
- 图片搜索/过滤
- Prisma schema 变更
