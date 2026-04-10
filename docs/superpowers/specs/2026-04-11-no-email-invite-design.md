# 无邮箱分销员邀请设计文档

**日期**：2026-04-11
**状态**：已确认，待实现

## 背景

当前邀请分销员的流程强依赖邮箱：邀请人填写被邀请人邮箱 → 系统发送含链接的邮件 → 被邀请人点击链接注册。这使得没有邮箱的用户（如仅用微信/手机的用户）无法被邀请。

## 目标

支持管理员和分销员通过"生成邀请链接"的方式邀请没有邮箱的用户，被邀请人使用用户名 + 密码注册和登录。

## 范围

- 邀请入口：Admin 后台 + 分销员中心均支持
- 被邀请人：真正没有邮箱的用户，登录标识为用户名
- 链接形式：一次性，有效期与现有邮箱邀请一致（7 天）
- 不在范围内：手机号注册、找回密码、密码重置

---

## 数据模型

### `User` 表

| 变更 | 说明 |
|------|------|
| `email String` → `email String?` | 无邮箱用户为 null |
| 新增 `username String? @unique` | 无邮箱用户的唯一登录标识，有邮箱用户为 null |

两者互斥：有邮箱用户 `username = null`，无邮箱用户 `email = null`。应用层保证"至少有其一"，不加 DB 约束。

### `DistributorInvitation` 表

| 变更 | 说明 |
|------|------|
| `email String` → `email String?` | 无邮箱邀请时为 null |

不添加 `type` 字段，通过 `email IS NULL` 推断邀请类型。

---

## Auth 层

### better-auth username plugin

在 `lib/auth.ts` 启用官方 `username()` plugin，支持 `signIn.username({ username, password })` 登录方式。

### 登录表单（仅分销员侧）

- 原"邮箱"输入框改为"账号"输入框，placeholder 改为"邮箱或用户名"
- 提交时前端自动判断：含 `@` → `signIn.email()`；否则 → `signIn.username()`
- 对用户无感，无需手动切换
- Admin 登录不变（管理员都有邮箱）

---

## 邀请入口 UI

Admin 后台（`invite-distributor-button-client.tsx`）和分销员中心（`invite-sub-distributor-button.tsx`）改动方式相同。

### 两个并排按钮

```
[邮箱邀请]   [生成邀请链接]
```

**邮箱邀请**（现有逻辑不变）
- 点击 → 打开现有邮箱输入对话框
- 填写邮箱 → 发送邀请邮件

**生成邀请链接**（新增）
- 点击 → 直接调 API，无需填写任何内容
- API 成功后弹出展示对话框：
  - 邀请链接（只读输入框）
  - 「复制链接」按钮
  - 说明文字："将此链接发给对方，链接 7 天内有效，仅限一人使用"

### API 变更

`POST /api/distributor/invite` 和 `POST /api/admin/distributors/invite`：

- `email` 字段改为可选
- 有 `email` → 现有逻辑（创建 invitation + 发邮件）
- 无 `email` → 创建 `DistributorInvitation { email: null, ... }`，返回 `{ link: string }`，不发邮件

---

## 接受邀请页面

`/distributor/accept-invite?token=xxx` 根据 invitation 是否有邮箱渲染不同表单。

### 有邮箱（现有，不变）

- 邮箱（只读展示）
- 昵称（输入）
- 密码（输入）

### 无邮箱（新增）

- 页面说明文字："请设置用户名和密码以完成注册，用户名将作为您的登录账号"
- 用户名（输入）：6-30 位，仅限字母、数字、下划线，注册时校验唯一性
- 昵称（输入）
- 密码（输入）

### API `POST /api/distributor/accept-invite` 变更

共有字段：`token`、`name`、`password`

- 有邮箱 invitation → 现有逻辑，创建 `{ email, username: null }` 账号
- 无邮箱 invitation → 接收 `username`，创建 `{ email: null, username }` 账号

用户名唯一性冲突（P2002）返回 `conflict("用户名已被使用，请换一个")`。

---

## 文件改动清单

| 文件 | 改动类型 |
|------|---------|
| `prisma/schema.prisma` | User.email nullable, User.username 新增, DistributorInvitation.email nullable |
| `lib/auth.ts` | 添加 username plugin |
| `lib/validations/distributor-invite.ts` | email 可选，新增无邮箱 schema（username + name + password） |
| `lib/send-distributor-invitation.ts` | email 参数可选，无邮箱时跳过发邮件 |
| `app/api/distributor/invite/route.ts` | 支持无邮箱请求 |
| `app/api/admin/distributors/invite/route.ts` | 支持无邮箱请求 |
| `app/api/distributor/accept-invite/route.ts` | 处理无邮箱 invitation |
| `app/distributor/(main)/invite-sub-distributor-button.tsx` | 拆为两个按钮 |
| `app/admin/(main)/distributors/invite-distributor-dialog.tsx` | 拆为两个按钮 |
| `app/distributor/accept-invite/accept-invite-form.tsx` | 根据 invitation 类型渲染不同表单 |
| `app/distributor/accept-invite/page.tsx` | 传递 invitation 类型给 form |
| `app/distributor/login/page.tsx` (或 login form) | 账号输入框支持邮箱或用户名 |
