# Account Mall

[![CI](https://github.com/marcus-kepler-92/account-mall/actions/workflows/ci.yml/badge.svg)](https://github.com/marcus-kepler-92/account-mall/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> 卡密自动发卡平台 · Self-hosted card-key auto-delivery platform

## About

Account Mall 是一个**自托管的卡密自动发卡平台**，即买即发，数据与流程完全由你自己掌控。适合销售数字商品、游戏卡密、会员激活码等，支持支付宝支付与邮件发卡，自带管理后台、限流与防刷能力。

## Features

- **前台**：商品目录、按标签筛选、商品详情、下单（邮箱 + 自定义查询密码）、订单查询（订单号 / 邮箱）
- **支付**：支付宝（可选，需配置 Alipay 应用与密钥）
- **发卡与通知**：购买成功后自动发卡；可选邮件通知（Resend）
- **AI 客服**：悬浮聊天 widget · DeepSeek V4 Flash（OpenAI 兼容直连）· admin 录入知识库 · 自动收集微信号 · 一键转人工生成咨询单 · 防滥用边界（BotID + 多键限流 + 日 token 闸）
- **安全与限流**：Cloudflare Turnstile（可选）、下单与查询的速率限制、单 IP 待支付订单数限制
- **后台**：管理员登录、仪表盘、商品 / 标签 / 卡密 / 订单管理、卡密批量导入、过期未支付订单自动关闭（Cron）、AI 客服知识库 / 咨询单 / 对话历史管理
- **其他**：缺货订阅（到货通知）

## Tech Stack

| Category | Choice | Description |
|----------|--------|-------------|
| Framework | Next.js 16 (App Router) | SSR + API Routes |
| Frontend | React 19 | Server Components + Client Components |
| Language | TypeScript 5 | Full-stack type safety |
| Styling | Tailwind CSS 4 | Atomic CSS |
| UI Library | shadcn/ui (New York) | Radix UI based, customizable |
| Database | PostgreSQL 17 | Docker deployment |
| ORM | Prisma 7 | Schema-first, type-safe queries |
| Auth | better-auth | Admin-only authentication |
| Validation | Zod | TypeScript-first schema validation |
| AI | DeepSeek V4 Flash · AI SDK v6 (OpenAI-compatible) | Customer service agent with tool calling + prompt caching |
| Chat UI | `@assistant-ui/react@0.14.x` | Headless chat primitives (wrapper-isolated in `app/components/agent-chat/chat-wrappers.tsx`) |
| Bot defense | Vercel BotID (Basic, free) | Invisible client challenge |
| Cache / rate-limit | Upstash Redis (Vercel Marketplace) | Distributed sliding-window limiters + daily token quota |
| Testing | Jest + Testing Library + Playwright | Unit / integration / E2E |
| Icons | Lucide React | Modern icon library |

## Prerequisites

- **Node.js** >= 18.18.0（推荐 20.x，生产环境建议使用 LTS）
- **Docker** & **Docker Compose** (for PostgreSQL)
- **pnpm** / **npm** / **yarn**

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd account-mall
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Required:** set `DATABASE_URL` and `BETTER_AUTH_SECRET` (at least 32 characters).  
**Production:** 务必设置 `BETTER_AUTH_URL`。过期订单关闭默认由**后台订单页「关闭过期订单」按钮**触发（`POST /api/admin/close-expired-orders`）；若需外部定时自动执行，设置 `CRON_SECRET` 并用外部 Cron 服务（如 cron-job.org）调用 `GET /api/cron/close-expired-orders`，携带 `Authorization: Bearer <CRON_SECRET>`。  
Full list and defaults: see [Environment variables](#environment-variables) below or [lib/config.ts](lib/config.ts).

### 3. Start Database

```bash
docker compose up -d
```

### 4. Run Migrations & Seed

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed initial data (admin user)
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the storefront.  
Admin panel is available at [http://localhost:3000/admin](http://localhost:3000/admin).

### Docker（一键启动数据库 + 应用）

若已配置 `.env`（至少 `DATABASE_URL`、`BETTER_AUTH_SECRET`），可在项目根目录执行：

```bash
docker compose up -d
```

将同时启动 PostgreSQL（`db`）与 Next.js 应用（`app`），访问 http://localhost:3000。  
**首次部署**需在应用容器内执行迁移与种子数据：

```bash
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

仅需数据库时，可只启动 `db`：`docker compose up -d db`。

## Environment variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `BETTER_AUTH_SECRET` | Secret key (min 32 characters) | Yes | - |
| `BETTER_AUTH_URL` | Site URL (recommended in production) | No | Inferred from `VERCEL_URL` or `http://localhost:3000` |
| `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_TAGLINE`, `SITE_SUBTITLE`, `ADMIN_PANEL_LABEL` | Site copy and admin label | No | See [lib/config.ts](lib/config.ts) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery (Resend) | No | - |
| `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY` | Alipay payment | No | - |
| `CRON_SECRET` | Vercel Cron / 外部定时服务的 Bearer 鉴权密钥（≥16 字符，强制要求；用于 `/api/cron/close-expired-orders` 与 `/api/cron/agent-cleanup`）。生成：`openssl rand -hex 32` | Yes | - |
| `PENDING_ORDER_TIMEOUT_MS`, `ORDER_RATE_LIMIT_POINTS`, `ORDER_QUERY_RATE_LIMIT_POINTS`, `MAX_PENDING_ORDERS_PER_IP` | Order timeout and rate limits | No | See [lib/config.ts](lib/config.ts) |
| `ORDER_SUCCESS_TOKEN_SECRET` | 订单成功页 token 签名（≥16 位；不设则用 BETTER_AUTH_SECRET，开发环境有默认） | No | - |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile | No | - |
| `WECHAT_QR_URL`, `WECHAT_ID` | 客服企微 QR 图 URL + 微信号（AI 客服 fallback / escalate 兜底） | Yes（启用 AI 客服）| - |
| `AGENT_TOKEN_BUDGET`, `DAILY_INPUT_CAP`, `DAILY_OUTPUT_CAP` | 单会话 / 单日 token 预算（防滥用） | No | 2000 / 3_000_000 / 800_000 |
| `AGENT_CHAT_TIMEOUT_MS`, `AGENT_SESSION_TTL_DAYS` | 单次请求超时 / 会话保留天数 | No | 15_000 / 90 |
| `ESCALATE_WEBHOOK_URL` | HIGH urgency Lead 推送 webhook（Bark / 企微群机器人 / Slack incoming） | No | - |
| `BUSINESS_HOURS_START`, `BUSINESS_HOURS_END`, `BUSINESS_HOURS_TIMEZONE` | 工作时间窗口（escalate 文案动态拼接） | No | 9 / 22 / Asia/Shanghai |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash（Vercel Marketplace 装 Upstash Redis 后自动注入；本地开发若未配置则限流/配额跳过） | Yes（生产） | - |
| `DEEPSEEK_API_KEY` | DeepSeek API 主调用（OpenAI 兼容直连） | Yes（必填） | - |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Seed admin (db:seed) | No | See [lib/config.ts](lib/config.ts) |

Complete list and semantics: [lib/config.ts](lib/config.ts).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client & build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Seed database with initial data |
| `SEED_E2E=1 npm run db:seed` | Seed + E2E 用商品与卡密（跑 E2E 前需执行一次） |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests（需先 migrate 且 `SEED_E2E=1 npm run db:seed`；完整支付流程需配置 ZPAY_*） |
| `npm run audit` | Check dependencies for high/critical vulnerabilities |

## Project Structure

```
account-mall/
├── app/                        # Next.js App Router
│   ├── admin/                  # Admin panel
│   │   ├── (main)/             # Dashboard, products, orders, cards, ...
│   │   │   └── agent/          # AI 客服：knowledge / leads / conversations
│   │   └── login/              # Admin login
│   ├── api/                    # API routes
│   │   ├── auth/               # better-auth
│   │   ├── orders/, products/, tags/, cards/  # CRUD & lookup
│   │   ├── payment/, cron/     # Alipay, close-expired-orders, agent-cleanup
│   │   ├── agent/              # AI 客服：chat / session/start / message-feedback
│   │   ├── admin/              # Admin-only APIs (incl. agent/knowledge|leads)
│   │   └── restock-subscriptions/
│   ├── components/             # App-level components
│   │   └── agent-chat/         # ChatPanel + assistant-ui wrappers + fallback views
│   ├── generated/              # Prisma generated client (output)
│   ├── layout.tsx, page.tsx   # Root layout & storefront
│   └── globals.css
├── components/ui/              # shadcn/ui
├── e2e/                        # Playwright E2E tests (incl. agent-* specs)
├── hooks/
├── lib/                        # Shared utilities
│   ├── agent-anti-abuse.ts     # applyAntiAbuse + reserve/commit/rollbackTokens + fingerprint
│   ├── agent-cs.ts             # buildCSPrompt + buildCSTools (6 tools)
│   ├── agent-persistence.ts    # fetchPublishedKnowledge (cached) + persist*Message
│   ├── agent-rate-limit.ts     # Upstash 4 sliding-window limiters
│   ├── agent-utils.ts          # extractTextParts (shared between anti-abuse + persistence)
│   ├── business-hours.ts       # isInBusinessHours (escalate copy)
│   ├── api-response.ts         # API error response helpers
│   ├── auth.ts, auth-client.ts # better-auth config
│   ├── config.ts               # Env & app config
│   ├── prisma.ts               # Prisma client
│   ├── validations/            # Zod schemas (incl. agent-knowledge / agent-lead)
│   └── utils.ts
├── prisma/
│   ├── schema.prisma           # Includes AgentSession/Message/Lead/Knowledge
│   ├── migrations/
│   └── seed.ts
├── __tests__/                  # Jest unit & API tests
├── docs/superpowers/           # spec + plan for major features
├── docker-compose.yml
├── components.json             # shadcn/ui
├── vercel.json                 # crons (close-expired-orders, agent-cleanup)
└── package.json
```

## Database Schema

- **User / Session / Account / Verification** — Admin auth (better-auth)
- **Product** — Name, slug, price, description, status; many-to-many **Tag**
- **Card** — Card-keys per product (UNSOLD → RESERVED → SOLD)
- **Order** — Orders with email, query password hash, quantity, amount, status
- **RestockSubscription** — Email subscriptions for out-of-stock products (到货通知)
- **AgentSession** — 匿名访客与 AI 客服的会话（客户端 ULID / fingerprintHash / tokenBudget / expiresAt 90 天自动删除）
- **AgentMessage** — 完整对话历史（role / parts JSON / citations / feedback / inputTokens / outputTokens）
- **AgentLead** — 咨询单（status: PENDING_CONTACT 主动留微信 / NEW AI 转人工 / CONTACTED / RESOLVED / DROPPED）
- **AgentKnowledge** — admin 录入的 FAQ / 规则 / 避雷点（DRAFT → PUBLISHED → ARCHIVED；tags GIN 索引；embedding 字段预留）

## Customer Service Agent

AI 客服 agent 把"加微信问客服"拆成两步：访客先在网页内与 AI 对话（DeepSeek V4 Flash），AI 答不了或检测到退款/投诉/连续不满时调用 `escalateToHuman` 工具返回企微 QR 并生成咨询单。

详细设计：[`docs/superpowers/specs/2026-05-19-customer-service-agent-design.md`](docs/superpowers/specs/2026-05-19-customer-service-agent-design.md)

### 数据流概览

```
浏览器 ChatPanel (assistant-ui)
  ↓ same-origin SSE
/api/agent/chat (Vercel Function, Node)
  1. applyAntiAbuse: BotID + 4KB cap + IP/session/fp 限流
  2. reserveTokens: Redis pipeline 原子预扣（daily-cap 检查）
  3. persistUserMessage → AgentMessage (USER)
  4. fetchPublishedKnowledge + fetchActiveProducts (unstable_cache, tags: agent-knowledge / products)
  5. streamText: deepseek/deepseek-v4-flash + 6 tools（system prompt 注入 ACTIVE 商品索引，LLM 自行语义匹配 id）
  6. onStepFinish → persistToolStep (TOOL rows + citations 收集)
  7. onFinish → commitUsage 补差 + persistAssistantMessage
  ↓
DeepSeek API（OpenAI 兼容，prompt caching 自动按前缀命中）
```

### 6 个工具

| Tool | 行为 |
|---|---|
| `lookupProduct` | 按 `productId` 查 ACTIVE 商品实时库存 + URL（`_count.cards { status: UNSOLD }`）。productId 由 LLM 从 system prompt 注入的商品索引中语义匹配得到 |
| `lookupOrder` | 按订单号查脱敏状态；找不到返回 `{ found: false }`（永远固定文案，防订单枚举） |
| `getAnnouncements` | 最近 5 条 CUSTOMER/ALL 受众公告 |
| `lookupKnowledge` | 检索 PUBLISHED 知识库（ILIKE + tags hasSome）；返回 id+excerpt，前端持久化为 citations |
| `collectWechat` | 用户主动留微信号 → upsert Lead 为 `PENDING_CONTACT`（不进主待办） |
| `escalateToHuman` | AI 转人工 → 事务 upsert Lead 为 `NEW` + `session.escalated=true`；HIGH urgency 触发 webhook；返回工作时间感知文案 + QR |

### 部署前必做（生产）

> 不做的话生产环境会直接抛错或裸奔。**全部都不可省。**

1. **Marketplace 装 Upstash Redis**：Vercel Dashboard → Storage → Marketplace → Upstash Redis → Add → 免费档 → 绑定到本项目。装好后 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（或 `KV_REST_API_*`）自动注入。  
   **没装的影响**：`lib/agent-rate-limit.ts` 的 `redis`/`limiters` 退化为 `null`；防滥用层（多键限流 + 日 token 闸）全部跳过 → 单 IP 就能耗干你的 LLM 额度。

2. **配置 DEEPSEEK_API_KEY**: 去 https://platform.deepseek.com/api_keys 生成 key, 加到 Vercel project env (Production + Preview)。  
   **没配的影响**：`lib/config.ts` 启动校验直接抛错（`z.string().min(1)`），构建/启动失败。

3. **配置 env**（`.env.example` 已列出，复制到 Vercel project env）：
   ```bash
   WECHAT_QR_URL=https://your-cdn.com/contact-qr.png    # 企微客服二维码
   WECHAT_ID=void_mall                                  # 微信 ID
   CRON_SECRET=$(openssl rand -hex 32)                  # ≥16 字符
   # 选填：HIGH urgency Lead 推 Bark / 企微群机器人
   # ESCALATE_WEBHOOK_URL=https://api.day.app/<key>/
   ```

4. **公开 `/contact-qr.png`**：放到 `public/contact-qr.png`，前台 ChatWidget 的 `<FallbackQR>` 和 `<HandoffCard>` 引用此路径。

### Admin 后台使用

部署后访问 `/admin/agent/` 三个子菜单：

| 页面 | 用途 |
|---|---|
| `/admin/agent/knowledge` | 知识库 CRUD：写 FAQ / 规则 / 避雷点 → 状态置为 PUBLISHED → 数秒内 agent 即按新规则答（`revalidateTag("agent-knowledge")`） |
| `/admin/agent/leads` | 咨询单：默认只显示主待办（NEW + CONTACTED）；筛选 PENDING_CONTACT 可见所有主动留微信号的会话；详情页有状态流转 + 备注 + 跳转完整对话 |
| `/admin/agent/conversations` | 全部会话审计：按时间 / escalated 标记 / contentText ILIKE 搜索；详情页时间线（含 tool call 折叠 + token usage + feedback） |

### 监控

- **Vercel Observability → AI**：每次 `streamText` invocation 的 trace / 输入输出 token / 延迟 / cost
- **Vercel Cron Logs**：daily 03:00 UTC `/api/cron/agent-cleanup` 执行结果（删除过期 session 数量）
- **Upstash Console**：限流命中率 + 每日 token 计数（key 模式：`agent:chat:ip/*`、`quota:day:in:{YYYYMMDD}` 等）

### 防滥用兜底机制

| 触发 | HTTP | 用户看到 |
|---|---|---|
| 日 token 闸打顶（`DAILY_INPUT_CAP` / `DAILY_OUTPUT_CAP`） | 503 | "AI 客服暂时下班" + QR |
| 单次请求 15s 超时 | 504 | 同上 |
| 单会话 tokenBudget 耗尽 | 423 | "今日免费咨询次数已达上限" + QR |
| 限流命中（20/min IP · 30/h session · 200/day fp） | 429 | "请稍后再试" 文案 |

被恶意脚本打满日 token 闸的**最坏成本约 ¥5/天**（DeepSeek V4 Flash 单价 + 3M input + 800K output cap）。

### 部署后手动验收（13 项 checklist）

完整列表在 [`docs/superpowers/plans/2026-05-19-customer-service-agent.md`](docs/superpowers/plans/2026-05-19-customer-service-agent.md) Task 6.4。核心 5 项：

1. 首页右下 fab → 点开 → 看到 4 个建议问题 chip
2. 点 chip "这个商品永久使用吗？" → 1-2 秒内开始流式回答
3. 输入 "我要退款" → 几秒后出现 QR + "已转接人工客服"；admin 后台咨询单出现 status=NEW
4. admin 后台知识库新建条目 → 发布 → 数秒后访客问相关问题时 AI 已知道（看 assistant 消息底部 `[来源: 标题]`）
5. `curl GET /api/cron/agent-cleanup` 不带 Authorization → 401；带 `Authorization: Bearer ${CRON_SECRET}` → `{deleted: N}`

### E2E 测试

`e2e/agent-*.spec.ts` 4 个 spec 默认 `skip`，环境变量启用：

```bash
E2E_AGENT_ENABLED=1 npm run test:e2e
```

需要 `WECHAT_QR_URL` / `WECHAT_ID` / `UPSTASH_*` / `DEEPSEEK_API_KEY` 全配齐，且 dev server 跑在 3000 端口。

## Contributing

欢迎提交 Issue 和 Pull Request。如有较大改动，建议先开 Issue 讨论。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Security

若发现安全问题，请通过仓库的 **Issues** 私下说明或联系维护者，请勿公开披露未修复的漏洞。

## License

本项目采用 [MIT](LICENSE) 许可证，详见 [LICENSE](LICENSE)。
