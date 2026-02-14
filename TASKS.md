# Account Mall - 开发任务清单

> 基于 Next.js 16 + Prisma 7 + PostgreSQL + better-auth + Tailwind CSS 4 的卡密自动发卡平台

## 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | SSR + API Routes |
| 前端 | React 19 | Server Components + Client Components |
| 语言 | TypeScript 5 | 全栈类型安全 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| UI 组件库 | shadcn/ui | 基于 Radix UI，可定制，Tailwind 原生搭配 |
| 数据库 | PostgreSQL 17 | Docker 部署 |
| ORM | Prisma 7 | Schema-first，类型安全查询 |
| 认证 | better-auth | 仅管理员后台登录 |
| 表单验证 | Zod | TypeScript-first，Server Actions 集成 |
| 支付 | alipay-sdk | 支付宝官方 Node.js SDK，RSA2 签名 |
| 邮件发送 | Resend | 现代邮件 API，免费 100 封/天 |
| 邮件模板 | React Email | React 组件编写邮件模板 |
| 密码哈希 | @node-rs/argon2 | Rust 实现的 Argon2，Vercel 兼容 |
| 限流 | rate-limiter-flexible | 成熟限流库，支持多种存储后端 |
| 定时任务 | Vercel Cron Jobs | vercel.json 配置定时触发 API Route |
| 部署 | Vercel | Serverless 部署 |

---

## P0 - 数据基础（最高优先级，所有功能的前置条件）

- [x] **1. 重构 Prisma Schema：新增 Product / Card / Order / Tag 模型**
  - 路由：无（数据库层）
  - 说明：
    - 新增 `Product` 模型：id, name, slug, description, price, maxQuantity (单笔最大购买数量，默认 10), status (ACTIVE/INACTIVE), createdAt, updatedAt
    - 新增 `Tag` 模型：id, name, slug, createdAt, updatedAt
    - 新增 `Card` 模型：id, productId, content, status (UNSOLD/RESERVED/SOLD), orderId (nullable), createdAt, updatedAt
    - 新增 `Order` 模型：id, orderNo, productId, email, passwordHash, quantity, amount, status (PENDING/COMPLETED/CLOSED), paidAt, createdAt, updatedAt
    - 关系：Product N:N Tag（多对多，通过隐式中间表），Product 1:N Card，Product 1:N Order，**Order 1:N Card**（一笔订单可对应多条卡密）
  - 技术：Prisma Schema 设计，`prisma migrate dev`

- [x] **2. 重构认证系统：改为仅管理员使用**
  - 路由：`POST /api/auth/*`、`GET /admin/login`
  - 说明：
    - 保留 better-auth 仅用于管理员登录
    - 移除公开注册功能（前台买家无需账号）
    - 现有 `/login` 页面迁移到 `/admin/login`
    - 移除 `/register` 页面
  - 技术：better-auth 配置调整，路由重组

- [x] **3. 重构 Middleware：区分前台公开路由和后台保护路由**
  - 路由：全部路由
  - 说明：
    - 公开路由（无需认证）：`/`、`/products/*`、`/orders/*`、`/api/orders/by-email`、`/api/orders/lookup`、`/api/payment/*`、`/api/products`（仅 GET）
    - 保护路由（需管理员认证）：`/admin/*`、`/api/products`（POST/PUT/DELETE）、`/api/orders`（管理端接口）、`/api/cards/*`
  - 技术：Next.js middleware，路由匹配模式

---

## P1 - 后台管理（第二优先级，管理商品和卡密的基础）

- [x] **4. 后台布局与导航**
  - 路由：`/admin/*`
  - 说明：
    - 创建后台管理布局，包含侧边栏导航（仪表盘、商品管理、订单管理）
    - 响应式侧边栏，可折叠菜单
    - 顶部栏显示管理员信息和退出按钮
  - 技术：Next.js App Router layout，React Server Components

- [x] **5. 商品 CRUD 管理（含 Tag 管理）**
  - 路由：`GET /admin/products`、`GET /admin/products/new`、`GET /admin/products/{productId}`
  - API：`GET/POST /api/products`、`GET/PUT/DELETE /api/products/{productId}`、`GET/POST/DELETE /api/tags`
  - 说明：
    - 商品列表页，支持按状态筛选（上架/下架/全部），支持按 Tag 筛选
    - 创建商品表单：名称、slug（根据名称自动生成）、价格、描述、状态、单笔最大购买数量（maxQuantity）、Tag 选择（多选，支持新建 Tag）
    - 编辑商品表单，预填现有值及已关联的 Tag
    - 软删除（设置状态为下架 INACTIVE）
    - 前台商品列表仅展示上架商品
    - Tag 管理：在商品表单中内联创建/选择 Tag，后台提供 Tag 列表查看和删除
  - 技术：Server Actions 或 API Routes，表单验证，Prisma CRUD，多对多关系操作

- [x] **6. 卡密管理**
  - 路由：`GET /admin/products/{productId}/cards`
  - API：`GET /api/products/{productId}/cards`、`POST /api/products/{productId}/cards`（批量导入）、`DELETE /api/cards/{cardId}`
  - 说明：
    - 按商品查看所有卡密：内容（明文）、状态（未售/预占中/已售）、关联订单号（已售时）
    - 批量导入：文本框输入，每行一条卡密
    - 仅允许删除未售卡密
    - 显示库存统计（未售 / 预占中 / 已售）
  - 技术：Prisma 批量插入，文本解析

- [x] **7. 订单管理**
  - 路由：`GET /admin/orders`、`GET /admin/orders/{orderId}`
  - API：`GET /api/orders`、`GET /api/orders/{orderId}`
  - 说明：
    - 订单列表：订单号、商品名、邮箱、数量、金额、状态、创建/支付时间
    - 筛选：按状态、邮箱、时间范围
    - 订单详情：完整订单信息 + 卡密明文
  - 技术：Prisma 查询与筛选，分页

- [x] **8. 管理仪表盘**
  - 路由：`GET /admin/dashboard`
  - 说明：
    - 总营收（已完成订单金额汇总）
    - 各状态订单数量（待支付 / 已完成 / 已关闭）
    - 商品总数、卡密库存概览
    - 最近订单列表
  - 技术：Prisma 聚合查询

---

## P2 - 前台商品展示（第三优先级，面向买家的核心页面）

- [x] **9. 商品列表首页（SSR，支持按 Tag 分类）**
  - 路由：`GET /`、`GET /?tag={slug}`
  - 说明：
    - 以响应式网格/列表展示所有上架商品
    - 每个商品卡片显示：名称、价格、简短描述、所属 Tag 标签
    - 页面顶部展示 Tag 分类导航栏，点击 Tag 筛选对应分类商品
    - 链接到商品详情页，使用 SEO 友好的 URL
  - 技术：React Server Components，SSR，响应式 CSS，URL searchParams 筛选

- [x] **10. 商品详情页（SSR + SEO）**
  - 路由：`GET /products/{id}-{slug}`
  - 说明：
    - 商品信息：名称、价格、完整描述
    - 库存状态指示（是否有未售卡密）
    - 下单表单：邮箱输入、订单密码输入、购买数量选择（1 ~ maxQuantity）、「立即购买」按钮
    - 动态 `<meta>` 标签：title、description、Open Graph
    - URL 格式示例：`/products/123-chatgpt-plus-account`
  - 技术：Next.js `generateMetadata`，动态路由，SSR

- [x] **11. SEO 基础设施**
  - 路由：`/sitemap.xml`、`/robots.txt`
  - 说明：
    - 自动生成 sitemap.xml，包含所有上架商品页面
    - robots.txt 允许搜索引擎抓取公开页面，禁止抓取 `/admin/*`
    - 商品页 JSON-LD 结构化数据（Product Schema）
  - 技术：Next.js `sitemap.ts`、`robots.ts`、JSON-LD

---

## P3 - 订单与支付流程（核心业务逻辑）

- [x] **12. 创建订单 API（含卡密预占，支持多数量）**
  - API：`POST /api/orders`
  - 请求体：`{ productId, email, orderPassword, quantity }`
  - 说明：
    - 校验商品存在且为上架状态
    - 校验 quantity：`1 <= quantity <= product.maxQuantity`
    - 检查该商品可用（未售）卡密数量 >= quantity
    - 在单个事务中完成：
      - 生成唯一订单号（格式：`FAK{YYYYMMDD}{NNNN}`）
      - 对 orderPassword 进行 bcrypt 哈希
      - 计算总金额：`amount = price × quantity`
      - 创建订单（状态：PENDING，记录 quantity）
      - 预占 N 条未售卡密（状态改为 RESERVED，关联到该订单）
    - 返回：订单号、总金额、支付链接
    - 防恶意下单（详见任务 22）
  - 技术：Prisma `$transaction`，@node-rs/argon2，Zod 校验，批量原子化卡密预占

- [x] **13. 支付宝支付集成**
  - API：`POST /api/payment/alipay/create`
  - 说明：
    - 根据订单信息创建支付宝支付请求
    - 支持 PC 端（电脑网站支付）和移动端（手机网站支付）
    - 跳转用户到支付宝支付页面
    - 配置同步返回地址（return_url）和异步通知地址（notify_url）
  - 技术：alipay-sdk，RSA2 签名

- [x] **14. 支付宝异步回调处理**
  - API：`POST /api/payment/alipay/notify`
  - 说明：
    - 验证支付宝回调签名（RSA2 公钥验签）
    - 校验 `out_trade_no` 与本地订单匹配
    - 校验 `total_amount` 与订单金额一致
    - 幂等处理：若订单已为 COMPLETED，返回 "success" 不重复处理
    - 验证通过时：
      - 更新订单状态：PENDING → COMPLETED
      - 批量更新该订单关联的所有卡密状态：RESERVED → SOLD
      - 设置 paidAt 时间戳
      - 触发邮件通知
    - 验证失败时：记录日志，不更新订单
    - 返回纯文本 "success" 或 "failure" 给支付宝
  - 技术：支付宝签名验证，数据库事务，幂等处理

- [x] **15. 订单状态机**
  - 说明：
    - 仅允许合法状态流转：`null → PENDING`、`PENDING → COMPLETED`、`PENDING → CLOSED`
    - 禁止其他流转（如 COMPLETED → CLOSED 不合法）
    - 实现为工具函数，供订单创建、支付回调、超时处理调用
  - 技术：状态机模式，TypeScript 枚举

- [x] **16. 订单超时机制（15 分钟自动关闭）**
  - 说明：
    - 处于 PENDING 状态超过 15 分钟的订单自动关闭
    - 关闭时：订单状态设为 CLOSED，释放该订单预占的所有卡密（RESERVED → UNSOLD）
    - 实现方案：
      - 定时任务：周期性扫描过期订单（如每分钟执行一次）
      - 或访问时检查：查询 PENDING 订单时判断是否过期
    - 超时时长可配置（默认 15 分钟）
  - 技术：Vercel Cron Jobs（vercel.json 配置定时触发 API Route），Prisma 批量更新

---

## P4 - 卡密交付（支付成功后的关键路径）

- [x] **17. 支付成功页**
  - 路由：`GET /orders/{orderNo}/success`
  - 说明：
    - 展示：商品名称、订单号、购买数量、所有卡密内容列表（明文）
    - 提供一键复制全部卡密按钮（多条卡密换行拼接复制）
    - 提示用户保存订单号和订单密码
    - 提示用户查看邮箱获取备份
    - 仅已完成（COMPLETED）订单可访问
    - 需要订单密码验证（通过会话或查询参数 token）
  - 技术：客户端组件实现复制功能，条件渲染

- [x] **18. 邮件通知**
  - 说明：
    - 支付成功后触发发送
    - 收件人：买家邮箱（来自订单记录）
    - 内容：商品名称、订单号、购买数量、所有卡密内容列表（明文）
    - 简洁模板，无营销内容
    - 优雅的失败处理（邮件发送失败不阻塞支付确认流程）
  - 技术：Resend API + React Email 模板，异步发送

---

## P5 - 订单查询与安全（买家自助服务）

- [x] **19. 按邮箱查看订单列表**
  - 路由：`GET /orders/lookup`（邮箱+密码模式）、API `GET /api/orders/by-email?email=xxx`
  - API：`GET /api/orders/by-email?email=xxx`、`POST /api/orders/lookup-by-email`
  - 说明：
    - 输入表单：邮箱地址
    - 返回该邮箱下的订单列表（仅概要）：订单号、商品名、金额、状态、创建时间
    - 不展示卡密内容（防止邮箱泄露导致卡密泄露）
  - 技术：服务端查询，表单提交

- [x] **20. 按订单号 + 订单密码查看卡密**
  - 路由：`GET /orders/lookup`
  - API：`POST /api/orders/lookup`（请求体：`{ orderNo, password }`）
  - 说明：
    - 输入表单：订单号 + 订单密码
    - 校验订单密码与存储的 argon2 哈希值
    - 成功：重定向到 `/orders/{orderNo}/success` 并附带会话/token
    - 失败：显示错误信息
    - 作为邮箱填错时的备用找回机制
  - 技术：@node-rs/argon2 比对，会话 token 或短期 JWT

- [x] **21. 本地订单历史（浏览器 localStorage）**
  - 路由：`GET /orders/my`（我的订单详情页）
  - 说明：
    - 订单创建/完成时写入 localStorage：订单号、商品名、金额、创建时间、状态
    - 「我的订单」使用一个详情页：左侧订单列表、右侧当前订单详情（订单号、商品、金额、创建时间、状态）
    - 未支付且未超时（15 分钟内）的订单展示「继续支付」按钮，跳转支付宝
    - 已超时的待支付订单提示「订单已超时关闭」
    - 查看卡密需在「订单查询」输入密码，本页仅展示本地概要
    - 不存储敏感信息（无卡密内容、无密码）
  - 技术：localStorage API，React 客户端组件，`POST /api/payment/alipay/create` 获取支付链接

---

## P6 - 防刷与风控（上线前必须完成）

- [x] **22. 订单创建频率限制与防恶意下单**
  - API：`POST /api/orders`
  - 说明：
    - 同一 IP 每分钟最多创建 5 笔订单（可配置）
    - 同一 IP 同时处于 PENDING 状态的订单不超过 3 笔（可配置），防止恶意占用库存
    - 单笔购买数量上限由商品的 `maxQuantity` 字段控制（默认 10）
    - 超出限制返回 429 Too Many Requests 或 400 Bad Request
  - 技术：rate-limiter-flexible，数据库查询 PENDING 订单数

- [x] **23. 查询接口限流**
  - API：`/api/orders/by-email`、`/api/orders/lookup`、`/api/orders/lookup-by-email`
  - 说明：
    - 同一 IP 每分钟最多调用 5 次（可配置）
    - 防止暴力破解订单密码和邮箱枚举攻击
    - 超出限制返回 429 Too Many Requests
  - 技术：rate-limiter-flexible 共享限流工具函数，从请求头提取 IP
