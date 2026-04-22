# 全局卡密模版设计文档

**日期**：2026-03-17  
**状态**：已审查

## 背景

当前卡密格式（`ProductCardFormat`）绑定到具体商品，每个商品独立管理。用户希望将其改为全局模版，在商品编辑页通过选择器选择（类似标签），实现复用。

---

## 数据模型

### 新增：`CardTemplate`（全局）

```prisma
model CardTemplate {
  id        String    @id @default(cuid())
  name      String
  template  String
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  products  Product[]

  @@index([sortOrder])
}
```

### 修改：`Product`

新增关联字段：`cardTemplates CardTemplate[]`

### 删除：`ProductCardFormat`

整个模型及其对应 Prisma 迁移。

---

## 数据迁移

用户手动执行以下 SQL（在 Prisma schema 迁移之后运行）：

```sql
-- 1. 将现有 ProductCardFormat 去重后写入 CardTemplate
INSERT INTO "CardTemplate" (id, name, template, "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  name,
  template,
  MIN("sortOrder"),
  NOW(),
  NOW()
FROM "ProductCardFormat"
GROUP BY name, template;

-- 2. 重建商品与模版的关联（Prisma 隐式多对多表名为 _CardTemplateToProduct）
INSERT INTO "_CardTemplateToProduct" ("A", "B")
SELECT DISTINCT ct.id, pcf."productId"
FROM "ProductCardFormat" pcf
JOIN "CardTemplate" ct
  ON ct.name = pcf.name AND ct.template = pcf.template;

-- 注：ProductCardFormat 表由 Prisma migration 的 DROP TABLE 删除，无需手动清理
```

> 迁移后验证：`SELECT COUNT(*) FROM "CardTemplate";` 应等于 `ProductCardFormat` 去重后的行数。

---

## API 路由

### 删除

- `GET/POST /api/products/[productId]/card-formats/`
- `PATCH/DELETE /api/products/[productId]/card-formats/[formatId]/`

### 新增

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/card-templates/` | 获取全局模版列表 |
| POST | `/api/admin/card-templates/` | 创建全局模版 |
| PATCH | `/api/admin/card-templates/[id]/` | 编辑模版 |
| DELETE | `/api/admin/card-templates/[id]/` | 删除模版 |

### 修改

商品更新 API（`PATCH /api/products/[productId]`）：新增 `cardTemplateIds: string[]` 字段，处理方式与现有 `tagIds` 完全一致（`set` 关联）。

`lib/validations/product.ts` 中的商品表单 schema 同步新增 `cardTemplateIds: z.array(z.string()).optional().default([])`。

`lib/validations/card-format.ts` 重命名为 `lib/validations/card-template.ts`，schema 名改为 `cardTemplateSchema`，逻辑不变。

---

## 管理后台页面

### 新增：`/admin/(main)/card-templates/`

全局模版管理页，客户端过滤模式（数量少），DataTable 四件套：

```
app/admin/(main)/card-templates/
├── page.tsx                          # 服务端全量查询
├── card-templates-columns.tsx        # ColumnDef
├── card-templates-data-table.tsx     # useReactTable + Toolbar
└── card-templates-row-actions.tsx    # 编辑 Dialog + 删除 AlertDialog
```

功能：列表展示（名称、模版字符串、字段数预览）、新建、编辑、删除。

删除约束：若模版已被商品使用，不允许删除（返回 400，提示需先解除关联）。

### 修改：商品编辑页

- 删除 `ProductCardFormats` 组件及其调用
- 新增 `ProductFormCardTemplateSelect`（复刻 `product-form-tag-select.tsx`）

**选择器行为**：
- 展示所有全局模版，Checkbox 勾选/取消
- 已选模版以 Badge 形式展示在下方
- 支持内联创建新模版（输入名称 + 模版字符串，`Enter` 或点击 `+` 创建）
- 创建后自动选中

---

## 消费端变更

`resolveCardFields(content, formats)` 函数签名不变，调用方更新：

| 文件 | 旧 | 新 |
|------|----|----|
| `app/orders/[orderNo]/success/page.tsx` | `order.product?.cardFormats` | `order.product?.cardTemplates` |

Prisma 查询中 `cardFormats: { select: {...} }` 改为 `cardTemplates: { select: {...} }`，`select` 字段不变（只需 `template`）。

---

## 侧边栏导航

在管理后台侧边栏新增"卡密模版"入口，位置在"卡密"附近。

---

## 不在范围内

- 模版排序（拖拽）
- 模版与商品关联的独立排序
- 分销员侧可见模版

---

## 测试要点

- 迁移后 `CardTemplate` 数量 = `ProductCardFormat` 去重行数
- 商品关联正确重建
- 删除已被使用的模版返回 400
- 订单成功页卡密字段正确解析
