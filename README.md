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
- **安全与限流**：Cloudflare Turnstile（可选）、下单与查询的速率限制、单 IP 待支付订单数限制
- **后台**：管理员登录、仪表盘、商品 / 标签 / 卡密 / 订单管理、卡密批量导入、过期未支付订单自动关闭（Cron）
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
| Testing | Jest + Testing Library | Unit & integration tests |
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
**Production:** 务必设置 `CRON_SECRET`（保护 `/api/cron/close-expired-orders`）和 `BETTER_AUTH_URL`；Cron 请求需带 `Authorization: Bearer <CRON_SECRET>`。  
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
| `CRON_SECRET` | API secret for cron (close expired orders) | No | - |
| `PENDING_ORDER_TIMEOUT_MS`, `ORDER_RATE_LIMIT_POINTS`, `ORDER_QUERY_RATE_LIMIT_POINTS`, `MAX_PENDING_ORDERS_PER_IP` | Order timeout and rate limits | No | See [lib/config.ts](lib/config.ts) |
| `ORDER_SUCCESS_TOKEN_SECRET` | Token for order success page | No | - |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile | No | - |
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
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run audit` | Check dependencies for high/critical vulnerabilities |

## Project Structure

```
account-mall/
├── app/                        # Next.js App Router
│   ├── admin/                  # Admin panel
│   │   ├── (main)/             # Dashboard, products, orders, cards, layout
│   │   └── login/              # Admin login
│   ├── api/                    # API routes
│   │   ├── auth/               # better-auth
│   │   ├── orders/, products/, tags/, cards/  # CRUD & lookup
│   │   ├── payment/, cron/     # Alipay, close-expired-orders
│   │   └── restock-subscriptions/
│   ├── components/             # App-level components
│   ├── generated/              # Prisma generated client (output)
│   ├── layout.tsx, page.tsx   # Root layout & storefront
│   └── globals.css
├── components/ui/              # shadcn/ui
├── e2e/                        # Playwright E2E tests
├── hooks/
├── lib/                        # Shared utilities
│   ├── api-response.ts         # API error response helpers
│   ├── auth.ts, auth-client.ts # better-auth config
│   ├── config.ts               # Env & app config
│   ├── prisma.ts               # Prisma client
│   ├── validations/            # Zod schemas
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── __tests__/                  # Jest unit & API tests
├── docker-compose.yml
├── components.json             # shadcn/ui
└── package.json
```

## Database Schema

- **User / Session / Account / Verification** — Admin auth (better-auth)
- **Product** — Name, slug, price, description, status; many-to-many **Tag**
- **Card** — Card-keys per product (UNSOLD → RESERVED → SOLD)
- **Order** — Orders with email, query password hash, quantity, amount, status
- **RestockSubscription** — Email subscriptions for out-of-stock products (到货通知)

## Contributing

欢迎提交 Issue 和 Pull Request。如有较大改动，建议先开 Issue 讨论。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Security

若发现安全问题，请通过仓库的 **Issues** 私下说明或联系维护者，请勿公开披露未修复的漏洞。

## License

本项目采用 [MIT](LICENSE) 许可证，详见 [LICENSE](LICENSE)。
