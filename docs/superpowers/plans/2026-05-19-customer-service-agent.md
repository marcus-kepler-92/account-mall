# Customer Service Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 客服 agent（DeepSeek V4 Flash via Vercel AI Gateway）嵌入 account-mall 前台，覆盖匿名访客咨询、admin 知识录入、企微人工兜底、防滥用边界。

**Architecture:** Next.js Route Handler `/api/agent/chat` 用 `streamText` 流式响应 + 6 个 tool 同进程查 Prisma；前台用 `@assistant-ui/react@0.14.x` 组合 widget；Vercel BotID + Upstash Redis 滑动窗口 + 日 token 闸做防滥用。

**Tech Stack:** Next.js 16 App Router · AI SDK v6 (`ai` + `@ai-sdk/react`) · DeepSeek V4 Flash via Vercel AI Gateway · `@assistant-ui/react@0.14.x` · Vercel BotID (`botid`) · `@upstash/ratelimit` + `@upstash/redis` · Prisma 6 · Zod · shadcn/ui · Jest · Playwright

**Spec:** [`docs/superpowers/specs/2026-05-19-customer-service-agent-design.md`](../specs/2026-05-19-customer-service-agent-design.md)

---

## File Structure

### Phase 1 · 基础设施

| 文件 | 职责 |
|---|---|
| `prisma/schema.prisma` (修改) | 加 4 个 model + 5 个 enum |
| `prisma/migrations/<ts>_add_agent_tables/migration.sql` | DB 迁移 |
| `lib/business-hours.ts` (新) | `isInBusinessHours()`, 读 config 工作时间窗口 |
| `lib/agent-rate-limit.ts` (新) | 4 个 Upstash Ratelimit 实例 + redis export |
| `lib/agent-anti-abuse.ts` (新) | `applyAntiAbuse` / `reserveTokens` / `commitUsage` / `rollbackTokens` / `estimateTokens` |
| `lib/config.ts` (修改) | 加 agent 相关 env Zod schema |
| `.env.example` (修改) | 同步新 env 示例 |
| `__tests__/lib/business-hours.test.ts` (新) | 工作时间边界 |
| `__tests__/lib/agent-anti-abuse.test.ts` (新) | 预扣 / 补差 / 回滚 |

### Phase 2 · Agent 核心

| 文件 | 职责 |
|---|---|
| `lib/agent-persistence.ts` (新) | `fetchPublishedKnowledge` (Runtime Cache) + 三个 persist 函数 |
| `lib/agent-cs.ts` (新) | `buildCSPrompt` + `buildCSTools`（6 个 tool） |
| `app/api/agent/chat/route.ts` (新) | 主 POST + streamText + 防滥用 + 持久化 |
| `__tests__/lib/agent-cs.test.ts` (新) | 6 个 tool 的 execute 行为 |
| `__tests__/lib/agent-persistence.test.ts` (新) | 持久化 + 缓存命中 |

### Phase 3 · 前台 ChatWidget

| 文件 | 职责 |
|---|---|
| `package.json` (修改) | 装 `@assistant-ui/react@0.14.x` / `@assistant-ui/react-ai-sdk@0.14.x` / `botid` / `ulid` |
| `next.config.ts` (修改) | 启用 `cacheComponents: true` |
| `app/components/agent-chat/chat-wrappers.tsx` (新) | 唯一直接 import assistant-ui 原语的文件 |
| `app/components/agent-chat/welcome-chips.tsx` (新) | 开场气泡 + 4 个建议问题 chip |
| `app/components/agent-chat/escalate-button.tsx` (新) | "找人工" 触发器 |
| `app/components/agent-chat/fallback-qr.tsx` (新) | 503/504/423 降级视图 |
| `app/components/agent-chat/handoff-card.tsx` (新) | escalate 成功后视图 |
| `app/components/agent-chat/chat-panel.tsx` (新) | 容器，组合上述 |
| `app/components/customer-service-fab.tsx` (修改) | popover 内容换 ChatPanel |
| `app/api/agent/session/start/route.ts` (新) | BotID 校验 + lazy 登记 AgentSession |
| `app/api/agent/message-feedback/route.ts` (新) | 写 `AgentMessage.feedback` |

### Phase 4 · 知识库 admin

| 文件 | 职责 |
|---|---|
| `lib/validations/agent-knowledge.ts` (新) | Zod schema |
| `app/admin/(main)/agent/knowledge/knowledge-columns.tsx` (新) | ColumnDef + Row 类型 |
| `app/admin/(main)/agent/knowledge/knowledge-row-actions.tsx` (新) | 行操作 DropdownMenu |
| `app/admin/(main)/agent/knowledge/knowledge-form.tsx` (新) | Form (markdown + tags + product) |
| `app/admin/(main)/agent/knowledge/knowledge-data-table.tsx` (新) | DataTable 容器 |
| `app/admin/(main)/agent/knowledge/page.tsx` + `loading.tsx` (新) | 页面入口 |
| `app/admin/(main)/agent/knowledge/new/page.tsx` (新) | 新建 |
| `app/admin/(main)/agent/knowledge/[id]/page.tsx` (新) | 编辑 |
| `app/api/admin/agent/knowledge/route.ts` (新) | GET 列表 + POST 创建 |
| `app/api/admin/agent/knowledge/[id]/route.ts` (新) | PATCH + DELETE + revalidateTag |
| `app/components/admin-sidebar.tsx` (修改) | 加 "客服 agent" 菜单 |

### Phase 5 · Lead + 对话审计

| 文件 | 职责 |
|---|---|
| `lib/validations/agent-lead.ts` (新) | Zod schema |
| `app/admin/(main)/agent/leads/leads-columns.tsx` (新) | |
| `app/admin/(main)/agent/leads/leads-row-actions.tsx` (新) | |
| `app/admin/(main)/agent/leads/leads-data-table.tsx` (新) | |
| `app/admin/(main)/agent/leads/leads-filters.ts` (新) | searchParams 解析 |
| `app/admin/(main)/agent/leads/page.tsx` + `loading.tsx` (新) | 服务端分页 |
| `app/admin/(main)/agent/leads/[id]/page.tsx` (新) | 详情 + 状态流转 |
| `app/api/admin/agent/leads/[id]/route.ts` (新) | PATCH 状态流转 |
| `app/admin/(main)/agent/conversations/conversations-columns.tsx` (新) | |
| `app/admin/(main)/agent/conversations/conversations-data-table.tsx` (新) | |
| `app/admin/(main)/agent/conversations/conversations-filters.ts` (新) | searchParams |
| `app/admin/(main)/agent/conversations/page.tsx` + `loading.tsx` (新) | |
| `app/admin/(main)/agent/conversations/[sessionId]/page.tsx` (新) | 完整对话 |

### Phase 6 · Cron + 验收

| 文件 | 职责 |
|---|---|
| `app/api/cron/agent-cleanup/route.ts` (新) | daily expiresAt < now() 删 |
| `vercel.json` (修改) | 注册 Cron schedule |
| `e2e/agent-chat-happy.spec.ts` (新) | E2E |
| `e2e/agent-chat-budget.spec.ts` (新) | |
| `e2e/agent-escalate.spec.ts` (新) | |
| `e2e/agent-collect-wechat.spec.ts` (新) | |
| `e2e/agent-fallback.spec.ts` (新) | |

---

# Phase 1 · 基础设施

## Task 1.1: Prisma migration — 4 张表 + 5 个 enum

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_agent_tables/migration.sql` (由 prisma migrate dev 自动生成)

- [ ] **Step 1: 把以下 model 和 enum 追加到 `prisma/schema.prisma` 末尾**

```prisma
model AgentSession {
  id                      String         @id          // 客户端 ULID
  fingerprintHash         String                      // SHA256(IP + UA).slice(0, 32)
  startedAt               DateTime       @default(now())
  endedAt                 DateTime?
  tokenBudget             Int            @default(2000)
  tokensUsed              Int            @default(0)
  escalated               Boolean        @default(false)
  expiresAt               DateTime
  messages                AgentMessage[]
  lead                    AgentLead?
  @@index([expiresAt])
}

model AgentMessage {
  id           String          @id @default(cuid())
  sessionId    String
  session      AgentSession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role         MessageRole
  parts        Json
  contentText  String          @db.Text
  toolName     String?
  citations    Json?
  feedback     MessageFeedback?
  inputTokens  Int             @default(0)
  outputTokens Int             @default(0)
  createdAt    DateTime        @default(now())
  @@index([sessionId, createdAt])
  @@index([feedback])
}

enum MessageRole     { USER ASSISTANT TOOL SYSTEM }
enum MessageFeedback { POSITIVE NEGATIVE }

model AgentLead {
  id                   String       @id @default(cuid())
  sessionId            String       @unique
  session              AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  wechatId             String?
  orderNo              String?
  reason               String
  urgency              LeadUrgency  @default(MED)
  status               LeadStatus   @default(NEW)
  contactedBy          String?
  contactedAt          DateTime?
  notes                String?      @db.Text
  conversationSnapshot Json
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
  @@index([status, createdAt])
}

enum LeadStatus  { PENDING_CONTACT NEW CONTACTED RESOLVED DROPPED }
enum LeadUrgency { LOW MED HIGH }

model AgentKnowledge {
  id          String          @id @default(cuid())
  title       String
  content     String          @db.Text
  tags        String[]
  productId   String?
  product     Product?        @relation(fields: [productId], references: [id])
  status      KnowledgeStatus @default(DRAFT)
  authorId    String
  author      User            @relation(fields: [authorId], references: [id])
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  publishedAt DateTime?
  embedding   Float[]?
  @@index([status, productId])
  @@index([tags])
}

enum KnowledgeStatus { DRAFT PUBLISHED ARCHIVED }
```

并在既有 `model Product` 与 `model User` 上添加反向关系字段：

```prisma
model Product {
  // ... 既有字段
  agentKnowledge AgentKnowledge[]
}

model User {
  // ... 既有字段
  agentKnowledge AgentKnowledge[]
}
```

- [ ] **Step 2: 运行 migration**

```bash
npm run db:migrate
```

prompt 名字时输入 `add_agent_tables`。

Expected: 4 张新表创建成功，无错误。

- [ ] **Step 3: 验证 Prisma Client 类型生成**

```bash
npx tsc --noEmit
```

Expected: 0 errors。`AgentSession` / `AgentMessage` / `AgentLead` / `AgentKnowledge` 在 `@prisma/client` 中可见。

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add agent tables (session/message/lead/knowledge)"
```

---

## Task 1.2: `lib/business-hours.ts` — 工作时间判断

**Files:**
- Create: `lib/business-hours.ts`
- Test: `__tests__/lib/business-hours.test.ts`

- [ ] **Step 1: 写失败测试**

`__tests__/lib/business-hours.test.ts`:

```ts
import { isInBusinessHours } from "@/lib/business-hours"

const ORIGINAL_TZ = process.env.TZ

afterAll(() => { process.env.TZ = ORIGINAL_TZ })

function freezeNow(iso: string) {
  jest.useFakeTimers().setSystemTime(new Date(iso))
}

describe("isInBusinessHours", () => {
  it("returns true at 10:00 Shanghai (default 9-22)", () => {
    freezeNow("2026-05-19T02:00:00Z")  // Shanghai 10:00
    expect(isInBusinessHours()).toBe(true)
  })

  it("returns false at 23:00 Shanghai", () => {
    freezeNow("2026-05-19T15:00:00Z")  // Shanghai 23:00
    expect(isInBusinessHours()).toBe(false)
  })

  it("returns false at 05:00 Shanghai", () => {
    freezeNow("2026-05-18T21:00:00Z")  // Shanghai 05:00
    expect(isInBusinessHours()).toBe(false)
  })

  it("returns true at 09:00 Shanghai (boundary, inclusive)", () => {
    freezeNow("2026-05-19T01:00:00Z")  // Shanghai 09:00
    expect(isInBusinessHours()).toBe(true)
  })

  it("returns false at 22:00 Shanghai (boundary, exclusive)", () => {
    freezeNow("2026-05-19T14:00:00Z")  // Shanghai 22:00
    expect(isInBusinessHours()).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx jest __tests__/lib/business-hours.test.ts
```

Expected: FAIL — Cannot find module `@/lib/business-hours`。

- [ ] **Step 3: 实现 `lib/business-hours.ts`**

```ts
import { config } from "@/lib/config"

export function isInBusinessHours(now: Date = new Date()): boolean {
  // 取 Asia/Shanghai (或 config 指定时区) 下的小时
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: config.businessHoursTimezone,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  )
  return hour >= config.businessHoursStart && hour < config.businessHoursEnd
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx jest __tests__/lib/business-hours.test.ts
```

Expected: 5 passed。

- [ ] **Step 5: 提交**

```bash
git add lib/business-hours.ts __tests__/lib/business-hours.test.ts
git commit -m "feat(lib): add isInBusinessHours with timezone support"
```

---

## Task 1.3: `lib/config.ts` 加 agent / business-hours / cron / upstash env

**Files:**
- Modify: `lib/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: 在 `lib/config.ts` 的 Zod schema 中追加以下字段**

```ts
// 客服 agent
agentChatTimeoutMs:    z.coerce.number().int().positive().default(15_000),
agentSessionTtlDays:   z.coerce.number().int().positive().default(90),
agentTokenBudget:      z.coerce.number().int().positive().default(2000),
dailyInputCap:         z.coerce.number().int().positive().default(3_000_000),
dailyOutputCap:        z.coerce.number().int().positive().default(800_000),
wechatQrUrl:           z.string().url(),
wechatId:              z.string(),

// HIGH urgency 通知 webhook
escalateWebhookUrl:    z.string().url().optional(),

// 工作时间
businessHoursStart:    z.coerce.number().int().min(0).max(23).default(9),
businessHoursEnd:      z.coerce.number().int().min(0).max(23).default(22),
businessHoursTimezone: z.string().default("Asia/Shanghai"),

// Upstash (Marketplace 自动注入, fallback 两种命名)
upstashRedisRestUrl: z
  .string()
  .url()
  .default(
    process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      "",
  ),
upstashRedisRestToken: z
  .string()
  .default(
    process.env.UPSTASH_REDIS_REST_TOKEN ??
      process.env.KV_REST_API_TOKEN ??
      "",
  ),

// Provider 兜底直连 (Gateway 优先)
deepseekApiKey: z.string().optional(),

// Vercel Cron 鉴权
cronSecret: z.string().min(16),
```

并把对应字段名映射到 `parsed.x` 输出对象。

- [ ] **Step 2: `.env.example` 追加**

```bash
# 客服 agent
WECHAT_QR_URL=https://your-cdn.com/contact-qr.png
WECHAT_ID=void_mall
AGENT_TOKEN_BUDGET=2000
DAILY_INPUT_CAP=3000000
DAILY_OUTPUT_CAP=800000
AGENT_SESSION_TTL_DAYS=90

# HIGH urgency Lead 推送 (Bark / 企微群机器人 / Slack webhook), 选填
# ESCALATE_WEBHOOK_URL=https://api.day.app/xxx/

# 工作时间
BUSINESS_HOURS_START=9
BUSINESS_HOURS_END=22
BUSINESS_HOURS_TIMEZONE=Asia/Shanghai

# Upstash (Marketplace 装 Upstash Redis 后自动注入, 此处仅占位)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# DeepSeek 兜底直连 (Gateway 不可用时), 选填
# DEEPSEEK_API_KEY=sk-xxx

# Vercel Cron 鉴权
CRON_SECRET=<random-32-bytes-hex>
```

- [ ] **Step 3: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 4: 提交**

```bash
git add lib/config.ts .env.example
git commit -m "feat(config): add agent + business-hours + upstash + cron env"
```

---

## Task 1.4: 装 Upstash 包 + `lib/agent-rate-limit.ts`

**Files:**
- Modify: `package.json`
- Create: `lib/agent-rate-limit.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm i @upstash/ratelimit @upstash/redis
```

Expected: 安装成功，无 peer warning。

- [ ] **Step 2: 创建 `lib/agent-rate-limit.ts`**

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN!,
})

export const limiters = {
  chatIp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "agent:chat:ip",
    analytics: true,
  }),
  chatSession: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    prefix: "agent:chat:session",
    analytics: true,
  }),
  chatFp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1 d"),
    prefix: "agent:chat:fp",
    analytics: true,
  }),
  csReverse: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "cs:reverse:ip",
    analytics: true,
  }),
}

export { redis }
```

- [ ] **Step 3: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json lib/agent-rate-limit.ts
git commit -m "feat(agent): add Upstash rate limiters (4 sliding windows)"
```

---

## Task 1.5: `lib/agent-anti-abuse.ts` — token 预扣 / 补差 / 回滚

**Files:**
- Create: `lib/agent-anti-abuse.ts`
- Test: `__tests__/lib/agent-anti-abuse.test.ts`

- [ ] **Step 1: 写失败测试**

`__tests__/lib/agent-anti-abuse.test.ts`:

```ts
import { reserveTokens, commitUsage, rollbackTokens } from "@/lib/agent-anti-abuse"
import { redis } from "@/lib/agent-rate-limit"

jest.mock("@/lib/agent-rate-limit", () => {
  const pipe = {
    incrby: jest.fn().mockReturnThis(),
    decrby: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  }
  return {
    redis: {
      pipeline: jest.fn(() => pipe),
      __pipe: pipe,
    },
  }
})

jest.mock("@/lib/prisma", () => ({
  prisma: { agentSession: { update: jest.fn() } },
}))

jest.mock("@/lib/config", () => ({
  config: { dailyInputCap: 1000, dailyOutputCap: 500 },
}))

const pipe = (redis as unknown as { __pipe: { exec: jest.Mock } }).__pipe

beforeEach(() => jest.clearAllMocks())

describe("reserveTokens", () => {
  it("returns ok when under cap", async () => {
    pipe.exec.mockResolvedValueOnce([100, 50, 150])
    const result = await reserveTokens("s1", { input: 100, output: 50 })
    expect(result.ok).toBe(true)
  })

  it("returns daily-cap when input over cap", async () => {
    pipe.exec.mockResolvedValueOnce([1100, 50, 1150])
    // exec is called twice: once for INCR, once for DECR rollback
    pipe.exec.mockResolvedValueOnce([0, 0, 0])
    const result = await reserveTokens("s1", { input: 1100, output: 50 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("daily-cap")
  })
})

describe("rollbackTokens", () => {
  it("decrements all three counters", async () => {
    pipe.exec.mockResolvedValueOnce([0, 0, 0])
    await rollbackTokens("s1", { input: 100, output: 50 })
    expect(pipe.decrby).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx jest __tests__/lib/agent-anti-abuse.test.ts
```

Expected: FAIL — Cannot find module。

- [ ] **Step 3: 实现 `lib/agent-anti-abuse.ts`**

```ts
import { type UIMessage } from "ai"
import { createHash } from "node:crypto"
import { redis, limiters } from "@/lib/agent-rate-limit"
import { config } from "@/lib/config"
import { prisma } from "@/lib/prisma"

// Sentinels that could be used to attempt prompt injection.
const STRIP_PATTERNS = [/<\|im_start\|>/g, /<\|im_end\|>/g, /<\|system\|>/g]

const MAX_USER_MESSAGE_BYTES = 4 * 1024

export interface GuardOk {
  ok: true
  fingerprintHash: string
  fallbackResponse: (reason: "daily-cap" | "budget" | "timeout") => Response
}
export type GuardFail = { ok: false; response: Response }

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

function fingerprint(req: Request): string {
  const ip = getClientIp(req)
  const ua = req.headers.get("user-agent") ?? ""
  return createHash("sha256").update(ip + "|" + ua).digest("hex").slice(0, 32)
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "")
}

function extractLastUserText(messages: UIMessage[]): string {
  const last = messages.at(-1)
  if (!last || last.role !== "user") return ""
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function stripSentinels(text: string): string {
  let cleaned = text
  for (const p of STRIP_PATTERNS) cleaned = cleaned.replace(p, "")
  return cleaned
}

function fallback(reason: "daily-cap" | "budget" | "timeout"): Response {
  const status = reason === "budget" ? 423 : reason === "timeout" ? 504 : 503
  return Response.json(
    { error: "service-unavailable", reason, qrUrl: config.wechatQrUrl, wechatId: config.wechatId },
    { status },
  )
}

export async function applyAntiAbuse(
  req: Request,
  sessionId: string,
  messages: UIMessage[],
): Promise<GuardOk | GuardFail> {
  // 1. message 长度
  const text = stripSentinels(extractLastUserText(messages))
  if (new TextEncoder().encode(text).byteLength > MAX_USER_MESSAGE_BYTES) {
    return { ok: false, response: Response.json({ error: "message-too-large" }, { status: 400 }) }
  }

  // 2. session 有效性
  const session = await prisma.agentSession.findUnique({ where: { id: sessionId } })
  if (!session || session.expiresAt < new Date()) {
    return { ok: false, response: Response.json({ error: "session-expired" }, { status: 410 }) }
  }
  if (session.tokensUsed >= session.tokenBudget) {
    return { ok: false, response: fallback("budget") }
  }

  // 3. 限流三键
  const ip = getClientIp(req)
  const fp = session.fingerprintHash
  const [ipR, sessR, fpR] = await Promise.all([
    limiters.chatIp.limit(ip),
    limiters.chatSession.limit(sessionId),
    limiters.chatFp.limit(fp),
  ])
  if (!ipR.success || !sessR.success || !fpR.success) {
    return { ok: false, response: Response.json({ error: "rate-limited" }, { status: 429 }) }
  }

  return {
    ok: true,
    fingerprintHash: fp,
    fallbackResponse: fallback,
  }
}

export function estimateTokens(messages: UIMessage[]): { input: number; output: number } {
  // 简化估算: 总字符数 / 4 + system prompt 估值 500
  const chars = JSON.stringify(messages).length
  return { input: Math.ceil(chars / 4) + 500, output: 500 }
}

export async function reserveTokens(
  sessionId: string,
  est: { input: number; output: number },
): Promise<{ ok: true } | { ok: false; reason: "daily-cap" }> {
  const day = todayKey()
  const pipe = redis.pipeline()
  pipe.incrby(`quota:day:in:${day}`, est.input)
  pipe.incrby(`quota:day:out:${day}`, est.output)
  pipe.incrby(`session:${sessionId}:tokens`, est.input + est.output)
  const result = (await pipe["exec"]()) as [number, number, number]
  const [dayIn, dayOut] = result

  if (dayIn > config.dailyInputCap || dayOut > config.dailyOutputCap) {
    await rollbackTokens(sessionId, est)
    return { ok: false, reason: "daily-cap" }
  }
  return { ok: true }
}

export async function commitUsage(
  sessionId: string,
  est: { input: number; output: number },
  actual: { promptTokens?: number; completionTokens?: number },
): Promise<void> {
  const realIn = actual.promptTokens ?? est.input
  const realOut = actual.completionTokens ?? est.output
  const diffIn = realIn - est.input
  const diffOut = realOut - est.output
  const day = todayKey()

  const pipe = redis.pipeline()
  if (diffIn !== 0) pipe.incrby(`quota:day:in:${day}`, diffIn)
  if (diffOut !== 0) pipe.incrby(`quota:day:out:${day}`, diffOut)
  pipe.incrby(`session:${sessionId}:tokens`, diffIn + diffOut)
  await pipe["exec"]()

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { tokensUsed: { increment: realIn + realOut } },
  })
}

export async function rollbackTokens(
  sessionId: string,
  est: { input: number; output: number },
): Promise<void> {
  const day = todayKey()
  const pipe = redis.pipeline()
  pipe.decrby(`quota:day:in:${day}`, est.input)
  pipe.decrby(`quota:day:out:${day}`, est.output)
  pipe.decrby(`session:${sessionId}:tokens`, est.input + est.output)
  await pipe["exec"]()
}

export { fingerprint }
```

- [ ] **Step 4: 运行测试通过**

```bash
npx jest __tests__/lib/agent-anti-abuse.test.ts
```

Expected: 3 passed。

- [ ] **Step 5: 提交**

```bash
git add lib/agent-anti-abuse.ts __tests__/lib/agent-anti-abuse.test.ts
git commit -m "feat(agent): reserve/commit/rollback token quota with redis pipeline"
```

---

# Phase 2 · Agent 核心

## Task 2.1: `lib/agent-persistence.ts` — knowledge 缓存 + 消息持久化

**Files:**
- Create: `lib/agent-persistence.ts`
- Test: `__tests__/lib/agent-persistence.test.ts`

- [ ] **Step 1: 启用 cacheComponents**

修改 `next.config.ts`：

```ts
const nextConfig: NextConfig = {
  // ... existing
  cacheComponents: true,
}
```

- [ ] **Step 2: 写失败测试**

`__tests__/lib/agent-persistence.test.ts`:

```ts
import {
  persistUserMessage,
  persistAssistantMessage,
} from "@/lib/agent-persistence"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: { agentMessage: { create: jest.fn() } },
}))

describe("persistUserMessage", () => {
  it("creates a USER message with extracted text", async () => {
    const msg = {
      id: "m1",
      role: "user" as const,
      parts: [{ type: "text", text: "hi" }],
    }
    await persistUserMessage("s1", msg as never)
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "s1",
        role: "USER",
        contentText: "hi",
      }),
    })
  })
})

describe("persistAssistantMessage", () => {
  it("creates ASSISTANT row with usage tokens", async () => {
    const msgs = [
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
    ]
    await persistAssistantMessage("s1", msgs as never, {
      promptTokens: 100,
      completionTokens: 50,
    })
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "ASSISTANT",
        inputTokens: 100,
        outputTokens: 50,
      }),
    })
  })
})
```

- [ ] **Step 3: 运行确认失败**

```bash
npx jest __tests__/lib/agent-persistence.test.ts
```

Expected: FAIL.

- [ ] **Step 4: 实现**

`lib/agent-persistence.ts`:

```ts
import { cacheTag, cacheLife } from "next/cache"
import { type UIMessage } from "ai"
import { prisma } from "@/lib/prisma"

export async function fetchPublishedKnowledge() {
  "use cache: remote"
  cacheTag("agent-knowledge")
  cacheLife({ expire: 3600 })
  return prisma.agentKnowledge.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      productId: true,
    },
  })
}

function extractText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export async function persistUserMessage(
  sessionId: string,
  message: UIMessage,
): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "USER",
      parts: message.parts as never,
      contentText: extractText(message.parts),
    },
  })
}

export async function persistToolStep(
  sessionId: string,
  step: { toolCalls?: Array<{ toolName: string }> },
): Promise<void> {
  if (!step.toolCalls?.length) return
  for (const call of step.toolCalls) {
    await prisma.agentMessage.create({
      data: {
        sessionId,
        role: "TOOL",
        toolName: call.toolName,
        parts: call as never,
        contentText: `[tool: ${call.toolName}]`,
      },
    })
  }
}

export async function persistAssistantMessage(
  sessionId: string,
  responseMessages: Array<{ role: string; content: unknown }>,
  usage: { promptTokens?: number; completionTokens?: number },
  citations?: string[],
): Promise<void> {
  // AI SDK v6 onFinish 给 response.messages — 取最后一条 assistant
  const assistant = responseMessages.findLast((m) => m.role === "assistant")
  if (!assistant) return

  const contentArr = Array.isArray(assistant.content) ? assistant.content : []
  const text = contentArr
    .filter((p: unknown): p is { type: "text"; text: string } => {
      return (p as { type?: string }).type === "text"
    })
    .map((p) => p.text)
    .join("")

  await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "ASSISTANT",
      parts: assistant.content as never,
      contentText: text,
      citations: citations?.length ? (citations as never) : undefined,
      inputTokens: usage.promptTokens ?? 0,
      outputTokens: usage.completionTokens ?? 0,
    },
  })
}
```

- [ ] **Step 5: 测试通过**

```bash
npx jest __tests__/lib/agent-persistence.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: 提交**

```bash
git add lib/agent-persistence.ts __tests__/lib/agent-persistence.test.ts next.config.ts
git commit -m "feat(agent): persist messages + cached knowledge fetch"
```

---

## Task 2.2: `lib/agent-cs.ts` — buildCSPrompt + system prompt

**Files:**
- Create: `lib/agent-cs.ts`

- [ ] **Step 1: 创建 `lib/agent-cs.ts` 框架 + buildCSPrompt**

```ts
import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { isInBusinessHours } from "@/lib/business-hours"

interface KnowledgeItem {
  id: string
  title: string
  content: string
  tags: string[]
  productId: string | null
}

export function buildCSPrompt(input: {
  knowledge: KnowledgeItem[]
  siteName: string
  siteUrl: string
}): string {
  const { knowledge, siteName, siteUrl } = input

  const knowledgeText = knowledge.length === 0
    ? "暂无知识库条目"
    : knowledge
        .map((k) => `### ${k.title}${k.tags.length ? ` [${k.tags.join("/")}]` : ""}\n${k.content}`)
        .join("\n\n")

  return `你是 ${siteName} 平台的前台 AI 客服。访客可能是已购用户或潜在买家。

## 平台信息
- 站点：${siteUrl}
- 你的职责：解答商品 / 订单 / 平台规则相关咨询；不能执行交易写操作

## 已加载的知识库（PUBLISHED）
${knowledgeText}

## 工具使用规则
- 用户问商品 → 调 lookup_product
- 用户给订单号 → 调 lookup_order（脱敏：永远不告诉用户卡密内容）
- 用户问平台公告 → 调 get_announcements
- 用户问知识库未覆盖的细节 → 调 lookup_knowledge
- 用户主动给微信号 → 调 collect_wechat
- 用户要求人工 / 退款 / 投诉 / 连续 2 轮不满 → 调 escalate_to_human

## 引用规范
当回答内容来自 lookup_knowledge 时，在末尾以 \`[来源: 标题]\` 标注。

## 严禁
- 编造商品、价格、订单状态
- 透露卡密内容（lookup_order 返回的 \`found:false\` 时只说"未找到该订单"，不解释原因）
- 承诺退款 / 改价 / 改订单（这些必须 escalate_to_human）

## 风格
- 中文，简洁友好
- 用户表达情绪时主动 escalate_to_human，不要硬答`
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: 提交**

```bash
git add lib/agent-cs.ts
git commit -m "feat(agent): add buildCSPrompt system prompt builder"
```

---

## Task 2.3: `lib/agent-cs.ts` — lookupProduct tool

**Files:**
- Modify: `lib/agent-cs.ts`
- Test: `__tests__/lib/agent-cs.test.ts`

- [ ] **Step 1: 写失败测试**

`__tests__/lib/agent-cs.test.ts`:

```ts
import { buildCSTools } from "@/lib/agent-cs"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: jest.fn() },
  },
}))

jest.mock("@/lib/config", () => ({
  config: { siteUrl: "https://example.com", wechatQrUrl: "https://x/qr.png", wechatId: "id" },
}))

describe("lookupProduct tool", () => {
  it("filters ACTIVE products and maps result", async () => {
    ;(prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "p1",
        name: "iCloud 200G",
        slug: "icloud-200g",
        summary: "Apple iCloud",
        price: 29.9,
        productType: "MANUAL",
        tags: [{ name: "苹果" }],
        _count: { cards: { _all: 5 } } as never,  // placeholder; see below
      },
    ])
    // Adjust the mock to match the actual select shape
    ;(prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "p1",
        name: "iCloud 200G",
        slug: "icloud-200g",
        summary: "Apple iCloud",
        price: 29.9,
        productType: "MANUAL",
        tags: [{ name: "苹果" }],
        _count: { cards: 5 },
      },
    ])
    const tools = buildCSTools("session1")
    const result = await tools.lookupProduct.execute(
      { query: "icloud" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(result).toEqual([
      expect.objectContaining({
        id: "p1",
        name: "iCloud 200G",
        inStock: true,
        url: "https://example.com/products/icloud-200g",
      }),
    ])
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx jest __tests__/lib/agent-cs.test.ts
```

Expected: FAIL — buildCSTools is not exported。

- [ ] **Step 3: 在 `lib/agent-cs.ts` 文件末追加 buildCSTools + lookupProduct**

```ts
export function buildCSTools(sessionId: string) {
  return {
    lookupProduct: tool({
      description: "按关键词查在售商品，最多 5 条",
      inputSchema: z.object({
        query: z.string().min(1).max(50).optional(),
        productId: z.string().optional(),
      }),
      execute: async ({ query, productId }) => {
        const products = await prisma.product.findMany({
          where: {
            status: "ACTIVE",
            ...(productId && { id: productId }),
            ...(query && { name: { contains: query, mode: "insensitive" } }),
          },
          take: 5,
          select: {
            id: true,
            name: true,
            slug: true,
            summary: true,
            price: true,
            productType: true,
            tags: { select: { name: true } },
            _count: { select: { cards: { where: { status: "UNSOLD" } } } },
          },
        })
        return products.map((p) => ({
          id: p.id,
          name: p.name,
          summary: p.summary,
          price: Number(p.price).toFixed(2),
          inStock: p.productType === "AUTO_FETCH" || p._count.cards > 0,
          tags: p.tags.map((t) => t.name),
          url: `${config.siteUrl}/products/${p.slug}`,
        }))
      },
    }),
    // 其他 tool 在后续 task 追加
  }
}
```

- [ ] **Step 4: 运行测试通过**

```bash
npx jest __tests__/lib/agent-cs.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: 提交**

```bash
git add lib/agent-cs.ts __tests__/lib/agent-cs.test.ts
git commit -m "feat(agent): add lookupProduct tool"
```

---

## Task 2.4: lookupOrder tool（脱敏 + 固定 found:false）

**Files:**
- Modify: `lib/agent-cs.ts` (扩展 buildCSTools)
- Modify: `__tests__/lib/agent-cs.test.ts`

- [ ] **Step 1: 加测试**

在 `__tests__/lib/agent-cs.test.ts` 追加：

```ts
describe("lookupOrder tool", () => {
  it("returns found:false (no detail) when order missing", async () => {
    ;(prisma as unknown as { order: { findFirst: jest.Mock } }).order = {
      findFirst: jest.fn().mockResolvedValueOnce(null),
    }
    const tools = buildCSTools("s1")
    const r = await tools.lookupOrder.execute(
      { orderNo: "NOTEXIST" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(r).toEqual({ found: false })
  })

  it("returns sanitized order without card content", async () => {
    ;(prisma as unknown as { order: { findFirst: jest.Mock } }).order = {
      findFirst: jest.fn().mockResolvedValueOnce({
        orderNo: "OD123",
        status: "COMPLETED",
        amount: 29.9,
        productNameSnapshot: "iCloud 200G",
        paidAt: new Date("2026-05-18T00:00:00Z"),
        createdAt: new Date("2026-05-18T00:00:00Z"),
      }),
    }
    const tools = buildCSTools("s1")
    const r = await tools.lookupOrder.execute(
      { orderNo: "OD123" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(r).toEqual({
      found: true,
      orderNo: "OD123",
      status: "COMPLETED",
      amount: "29.90",
      product: "iCloud 200G",
      paidAt: "2026-05-18",
      createdAt: "2026-05-18",
    })
    expect(JSON.stringify(r)).not.toMatch(/card|cardCode|password/i)
  })
})
```

- [ ] **Step 2: 运行测试失败**

```bash
npx jest __tests__/lib/agent-cs.test.ts
```

Expected: lookupOrder undefined。

- [ ] **Step 3: 在 buildCSTools 返回对象中追加 lookupOrder**

```ts
lookupOrder: tool({
  description: "按订单号查订单状态。不返回卡密内容。",
  inputSchema: z.object({ orderNo: z.string().min(6).max(40) }),
  execute: async ({ orderNo }) => {
    const order = await prisma.order.findFirst({
      where: { orderNo },
      select: {
        orderNo: true,
        status: true,
        amount: true,
        productNameSnapshot: true,
        paidAt: true,
        createdAt: true,
      },
    })
    if (!order) return { found: false } as const
    return {
      found: true as const,
      orderNo: order.orderNo,
      status: order.status,
      amount: Number(order.amount).toFixed(2),
      product: order.productNameSnapshot,
      paidAt: order.paidAt?.toISOString().slice(0, 10) ?? null,
      createdAt: order.createdAt.toISOString().slice(0, 10),
    }
  },
}),
```

- [ ] **Step 4: 测试通过**

```bash
npx jest __tests__/lib/agent-cs.test.ts
```

Expected: 3 passed (含上一 task)。

- [ ] **Step 5: 提交**

```bash
git add lib/agent-cs.ts __tests__/lib/agent-cs.test.ts
git commit -m "feat(agent): add lookupOrder tool with sanitization"
```

---

## Task 2.5: getAnnouncements + lookupKnowledge tools

**Files:** Modify `lib/agent-cs.ts`、`__tests__/lib/agent-cs.test.ts`

- [ ] **Step 1: 加测试**

```ts
describe("getAnnouncements", () => {
  it("filters PUBLISHED CUSTOMER/ALL audience", async () => {
    ;(prisma as unknown as { announcement: { findMany: jest.Mock } }).announcement = {
      findMany: jest.fn().mockResolvedValueOnce([
        { title: "维护", content: "周一", publishedAt: new Date("2026-05-15Z") },
      ]),
    }
    const tools = buildCSTools("s1")
    const r = await tools.getAnnouncements.execute({}, { toolCallId: "1", messages: [] } as never)
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", audience: { in: ["CUSTOMER", "ALL"] } },
        take: 5,
      }),
    )
    expect(r).toHaveLength(1)
  })
})

describe("lookupKnowledge", () => {
  it("returns only PUBLISHED with id + excerpt", async () => {
    ;(prisma as unknown as { agentKnowledge: { findMany: jest.Mock } }).agentKnowledge = {
      findMany: jest.fn().mockResolvedValueOnce([
        { id: "k1", title: "失效补单", content: "6 个月内…", tags: ["refund"] },
      ]),
    }
    const tools = buildCSTools("s1")
    const r = await tools.lookupKnowledge.execute(
      { query: "失效" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(prisma.agentKnowledge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    )
    expect(r[0]).toEqual({
      id: "k1",
      title: "失效补单",
      tags: ["refund"],
      excerpt: "6 个月内…",
    })
  })
})
```

- [ ] **Step 2: 运行失败**

Expected: undefined。

- [ ] **Step 3: 在 buildCSTools 追加**

```ts
getAnnouncements: tool({
  description: "查最近 5 条 CUSTOMER/ALL 受众的公告",
  inputSchema: z.object({}),
  execute: async () => {
    const rows = await prisma.announcement.findMany({
      where: {
        status: "PUBLISHED",
        audience: { in: ["CUSTOMER", "ALL"] },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { title: true, content: true, publishedAt: true },
    })
    return rows.map((a) => ({
      title: a.title,
      content: a.content,
      publishedAt: a.publishedAt?.toISOString().slice(0, 10) ?? null,
    }))
  },
}),

lookupKnowledge: tool({
  description: "检索 admin 录入的知识库（FAQ、规则、避雷点）",
  inputSchema: z.object({
    query: z.string().min(1).max(100),
    productId: z.string().optional(),
    tags: z.array(z.string()).max(5).optional(),
  }),
  execute: async ({ query, productId, tags }) => {
    const rows = await prisma.agentKnowledge.findMany({
      where: {
        status: "PUBLISHED",
        ...(productId && { productId }),
        ...(tags?.length && { tags: { hasSome: tags } }),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, title: true, content: true, tags: true },
    })
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      excerpt: r.content.slice(0, 200),
    }))
  },
}),
```

- [ ] **Step 4: 测试通过**

```bash
npx jest __tests__/lib/agent-cs.test.ts
```

Expected: 5 passed。

- [ ] **Step 5: 提交**

```bash
git add lib/agent-cs.ts __tests__/lib/agent-cs.test.ts
git commit -m "feat(agent): add getAnnouncements + lookupKnowledge tools"
```

---

## Task 2.6: collectWechat tool（PENDING_CONTACT + QR）

**Files:** Modify `lib/agent-cs.ts`、`__tests__/lib/agent-cs.test.ts`

- [ ] **Step 1: 加测试**

```ts
describe("collectWechat", () => {
  it("upserts Lead with status=PENDING_CONTACT and returns QR", async () => {
    const upsert = jest.fn().mockResolvedValueOnce({ id: "l1" })
    ;(prisma as unknown as { agentLead: { upsert: jest.Mock } }).agentLead = { upsert }
    const tools = buildCSTools("s1")
    const r = await tools.collectWechat.execute(
      { wechatId: "validId123" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "PENDING_CONTACT",
          wechatId: "validId123",
          reason: "用户主动提供",
        }),
        update: { wechatId: "validId123" },
      }),
    )
    expect(r).toMatchObject({
      ok: true,
      qrUrl: expect.any(String),
      wechatId: expect.any(String),
    })
  })

  it("rejects invalid wechatId format via Zod", async () => {
    const tools = buildCSTools("s1")
    const result = tools.collectWechat.inputSchema.safeParse({ wechatId: "1invalid" })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: 失败 → 实现**

```ts
collectWechat: tool({
  description: "用户主动提供微信号时调用",
  inputSchema: z.object({
    wechatId: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/, "微信号格式不符"),
  }),
  execute: async ({ wechatId }) => {
    await prisma.agentLead.upsert({
      where: { sessionId },
      create: {
        sessionId,
        wechatId,
        reason: "用户主动提供",
        status: "PENDING_CONTACT",
        conversationSnapshot: {},
      },
      update: { wechatId },
    })
    return {
      ok: true,
      qrUrl: config.wechatQrUrl,
      wechatId: config.wechatId,
      message: "已记录，客服会主动加您。如需快速联系也可以扫码加我们的企微。",
    }
  },
}),
```

- [ ] **Step 3: 通过 + 提交**

```bash
npx jest __tests__/lib/agent-cs.test.ts && \
git add lib/agent-cs.ts __tests__/lib/agent-cs.test.ts && \
git commit -m "feat(agent): add collectWechat tool with PENDING_CONTACT status"
```

---

## Task 2.7: escalateToHuman tool（事务 + webhook + 文案）

**Files:** Modify `lib/agent-cs.ts`、`__tests__/lib/agent-cs.test.ts`

- [ ] **Step 1: 加测试**

```ts
describe("escalateToHuman", () => {
  beforeEach(() => {
    ;(prisma as unknown as { agentMessage: { findMany: jest.Mock } }).agentMessage = {
      findMany: jest.fn().mockResolvedValueOnce([
        { role: "USER", contentText: "我要退款", toolName: null, createdAt: new Date() },
      ]),
    }
    ;(prisma as unknown as { $transaction: jest.Mock }).$transaction = jest
      .fn()
      .mockResolvedValueOnce([])
  })

  it("upserts Lead with NEW status and snapshot, marks session.escalated", async () => {
    const tools = buildCSTools("s1")
    const r = await tools.escalateToHuman.execute(
      { reason: "退款诉求", urgency: "MED" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(r).toMatchObject({ qrUrl: expect.any(String), message: expect.any(String) })
  })

  it("triggers webhook fetch when urgency=HIGH and webhook url set", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))
    jest.doMock("@/lib/config", () => ({
      config: {
        wechatQrUrl: "https://q",
        wechatId: "id",
        siteUrl: "https://s",
        escalateWebhookUrl: "https://bark.example/x",
        businessHoursStart: 9,
        businessHoursEnd: 22,
      },
    }))
    // Re-import for fresh mock
    jest.resetModules()
    const { buildCSTools: rebuilt } = await import("@/lib/agent-cs")
    const tools = rebuilt("s1")
    await tools.escalateToHuman.execute(
      { reason: "卡密失效", urgency: "HIGH" },
      { toolCallId: "1", messages: [] } as never,
    )
    expect(fetch).toHaveBeenCalledWith(
      "https://bark.example/x",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
```

- [ ] **Step 2: 失败 → 实现**

```ts
escalateToHuman: tool({
  description: "需要人工接手时调用，返回企微 QR",
  inputSchema: z.object({
    reason: z.string().min(2).max(200),
    urgency: z.enum(["LOW", "MED", "HIGH"]).default("MED"),
  }),
  execute: async ({ reason, urgency }) => {
    const recent = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        role: true,
        contentText: true,
        toolName: true,
        createdAt: true,
      },
    })
    const snapshot = recent.reverse()

    await prisma.$transaction([
      prisma.agentLead.upsert({
        where: { sessionId },
        create: {
          sessionId,
          reason,
          urgency,
          status: "NEW",
          conversationSnapshot: snapshot,
        },
        update: {
          reason,
          urgency,
          status: "NEW",
          conversationSnapshot: snapshot,
        },
      }),
      prisma.agentSession.update({
        where: { id: sessionId },
        data: { escalated: true },
      }),
    ])

    if (urgency === "HIGH" && config.escalateWebhookUrl) {
      fetch(config.escalateWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🆘 客服紧急 Lead\n原因: ${reason}\n会话: ${sessionId.slice(0, 8)}\n查看: ${config.siteUrl}/admin/agent/leads`,
        }),
      }).catch(() => {})
    }

    const inHours = isInBusinessHours()
    const { businessHoursStart: s, businessHoursEnd: e } = config
    const pad = (n: number) => String(n).padStart(2, "0")
    const message = inHours
      ? "已为你转接人工客服，扫码加企微即可，订单号或微信号可直接发给客服。"
      : `已为你转接人工客服，当前 ${pad(e)}:00–${pad(s)}:00 客服休息时间，扫码加企微，我们 ${pad(s)}:00 上线后第一时间回复。`

    return {
      qrUrl: config.wechatQrUrl,
      wechatId: config.wechatId,
      message,
    }
  },
}),
```

- [ ] **Step 3: 通过 + 提交**

```bash
npx jest __tests__/lib/agent-cs.test.ts && \
git add lib/agent-cs.ts __tests__/lib/agent-cs.test.ts && \
git commit -m "feat(agent): add escalateToHuman tool with webhook + business-hour copy"
```

---

## Task 2.8: `app/api/agent/chat/route.ts` 主接口

**Files:** Create `app/api/agent/chat/route.ts`

- [ ] **Step 1: 创建 route**

```ts
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai"
import {
  applyAntiAbuse,
  reserveTokens,
  commitUsage,
  rollbackTokens,
  estimateTokens,
} from "@/lib/agent-anti-abuse"
import { buildCSPrompt, buildCSTools } from "@/lib/agent-cs"
import {
  persistUserMessage,
  persistToolStep,
  persistAssistantMessage,
  fetchPublishedKnowledge,
} from "@/lib/agent-persistence"
import { config } from "@/lib/config"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { messages, sessionId } = (await req.json()) as {
    messages: UIMessage[]
    sessionId: string
  }

  const guard = await applyAntiAbuse(req, sessionId, messages)
  if (!guard.ok) return guard.response

  const estimated = estimateTokens(messages)
  const reserved = await reserveTokens(sessionId, estimated)
  if (!reserved.ok) return guard.fallbackResponse(reserved.reason)

  await persistUserMessage(sessionId, messages.at(-1)!)

  const knowledge = await fetchPublishedKnowledge()

  const citations: string[] = []

  const result = streamText({
    model: "deepseek/deepseek-v4-flash",
    system: buildCSPrompt({
      knowledge,
      siteName: config.siteName,
      siteUrl: config.siteUrl,
    }),
    messages: convertToModelMessages(messages),
    tools: buildCSTools(sessionId),
    stopWhen: stepCountIs(5),
    abortSignal: AbortSignal.timeout(config.agentChatTimeoutMs),
    experimental_telemetry: { isEnabled: true, functionId: "agent-cs-chat" },
    providerOptions: { gateway: { caching: "auto" } },
    onStepFinish: async (step) => {
      // 抓 lookupKnowledge 命中, 留作 citations
      const knowledgeCalls = step.toolResults?.filter(
        (r): r is typeof r & { toolName: "lookupKnowledge" } =>
          r.toolName === "lookupKnowledge",
      )
      for (const call of knowledgeCalls ?? []) {
        const items = call.output as Array<{ id: string }>
        for (const it of items) citations.push(it.id)
      }
      await persistToolStep(sessionId, step)
    },
    onFinish: async ({ usage, response }) => {
      await commitUsage(sessionId, estimated, usage)
      await persistAssistantMessage(
        sessionId,
        response.messages as never,
        usage,
        citations,
      )
    },
    onError: async () => {
      await rollbackTokens(sessionId, estimated)
    },
  })

  return result.toUIMessageStreamResponse()
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: 提交**

```bash
git add app/api/agent/chat/route.ts
git commit -m "feat(api): add /api/agent/chat with streamText + tools + anti-abuse"
```

---

# Phase 3 · 前台 ChatWidget

## Task 3.1: 装 assistant-ui + BotID + ulid

**Files:** Modify `package.json`

- [ ] **Step 1: pin minor 版本安装**

```bash
npm i --save-exact @assistant-ui/react@0.14 @assistant-ui/react-ai-sdk@0.14
npm i botid ulid
```

修改 `package.json`，把 `@assistant-ui/react` 与 `@assistant-ui/react-ai-sdk` 改为 `"0.14.x"`（防自动升次版本）。

- [ ] **Step 2: 验证安装**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "deps: add @assistant-ui/react@0.14.x + botid + ulid"
```

---

## Task 3.2: BotID 客户端引导（layout）

**Files:** Modify `app/layout.tsx`

- [ ] **Step 1: 在 layout 加入 BotID Script**

在 `<head>` 内添加：

```tsx
import Script from "next/script"

// 在 <html><body> 内顶部
<Script
  src="/_vercel/botid"
  strategy="beforeInteractive"
/>
```

或按 `botid` 官方文档（`import { initBotId } from "botid/client"` 然后 `useEffect`）。

- [ ] **Step 2: 验证 build**

```bash
npm run build
```

Expected: build 成功，新增 script 加载。

- [ ] **Step 3: 提交**

```bash
git add app/layout.tsx
git commit -m "feat(botid): inject BotID client script in root layout"
```

---

## Task 3.3: `app/api/agent/session/start/route.ts`

**Files:** Create `app/api/agent/session/start/route.ts`

- [ ] **Step 1: 创建 route**

```ts
import { checkBotId } from "botid/server"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { fingerprint } from "@/lib/agent-anti-abuse"
import { z } from "zod"

const schema = z.object({ sessionId: z.string().min(20).max(40) })

export async function POST(req: Request) {
  const botCheck = await checkBotId()
  if (botCheck.isBot) {
    return Response.json({ error: "bot-detected" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "bad-request" }, { status: 400 })
  }
  const { sessionId } = parsed.data
  const fp = fingerprint(req)

  const existing = await prisma.agentSession.findUnique({ where: { id: sessionId } })
  if (existing) {
    return Response.json({
      sessionId: existing.id,
      tokenBudget: existing.tokenBudget,
      tokensUsed: existing.tokensUsed,
    })
  }

  const expiresAt = new Date(Date.now() + config.agentSessionTtlDays * 86_400_000)
  const created = await prisma.agentSession.create({
    data: {
      id: sessionId,
      fingerprintHash: fp,
      tokenBudget: config.agentTokenBudget,
      expiresAt,
    },
  })

  return Response.json({
    sessionId: created.id,
    tokenBudget: created.tokenBudget,
    tokensUsed: created.tokensUsed,
  })
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: 提交**

```bash
git add app/api/agent/session/start/route.ts
git commit -m "feat(api): add session/start with BotID + fingerprint"
```

---

## Task 3.4: `app/api/agent/message-feedback/route.ts`

**Files:** Create `app/api/agent/message-feedback/route.ts`

- [ ] **Step 1: 创建**

```ts
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  messageId: z.string().min(1),
  value: z.enum(["up", "down"]),
})

const MAP = { up: "POSITIVE", down: "NEGATIVE" } as const

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  await prisma.agentMessage.update({
    where: { id: parsed.data.messageId },
    data: { feedback: MAP[parsed.data.value] },
  })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: typecheck + 提交**

```bash
npx tsc --noEmit && \
git add app/api/agent/message-feedback/route.ts && \
git commit -m "feat(api): add message-feedback writeback"
```

---

## Task 3.5: `chat-wrappers.tsx` — assistant-ui 隔离层

**Files:** Create `app/components/agent-chat/chat-wrappers.tsx`

- [ ] **Step 1: 创建**

> assistant-ui v0.14 实际 API 与下面片段不完全一致时，**仅改本文件**（wrapper 隔离原则）。

```tsx
"use client"
import {
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react"
import { Send, Square, Copy, ThumbsUp, ThumbsDown } from "lucide-react"
import { EscalateButton } from "./escalate-button"

export function ChatBubble() {
  return (
    <MessagePrimitive.Root className="group flex flex-col gap-1 py-2">
      <MessagePrimitive.Content
        components={{
          ToolCall: ({ toolName }: { toolName: string }) => (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              正在调用 <code>{toolName}</code>…
            </div>
          ),
        }}
      />
      <MessagePrimitive.If assistant>
        <ActionBarPrimitive.Root className="flex gap-1 opacity-0 group-hover:opacity-100">
          <ActionBarPrimitive.Copy>
            <Copy className="size-3.5" />
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.FeedbackPositive
            onFeedback={(msgId: string) => recordFeedback(msgId, "up")}
          >
            <ThumbsUp className="size-3.5" />
          </ActionBarPrimitive.FeedbackPositive>
          <ActionBarPrimitive.FeedbackNegative
            onFeedback={(msgId: string) => recordFeedback(msgId, "down")}
          >
            <ThumbsDown className="size-3.5" />
          </ActionBarPrimitive.FeedbackNegative>
        </ActionBarPrimitive.Root>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  )
}

export function ComposerBar() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t p-2">
      <ComposerPrimitive.Input
        className="flex-1 resize-none bg-transparent outline-none text-sm"
        placeholder="输入您的问题…"
      />
      <EscalateButton />
      <ComposerPrimitive.Send className="rounded-full bg-primary p-2 text-primary-foreground">
        <Send className="size-4" />
      </ComposerPrimitive.Send>
      <ComposerPrimitive.Cancel className="rounded-full bg-muted p-2">
        <Square className="size-4" />
      </ComposerPrimitive.Cancel>
    </ComposerPrimitive.Root>
  )
}

async function recordFeedback(msgId: string, value: "up" | "down") {
  await fetch("/api/agent/message-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId: msgId, value }),
  })
}
```

- [ ] **Step 2: typecheck + 提交**

```bash
npx tsc --noEmit && \
git add app/components/agent-chat/chat-wrappers.tsx && \
git commit -m "feat(chat): add assistant-ui wrappers (ChatBubble + ComposerBar)"
```

---

## Task 3.6: `welcome-chips.tsx`

**Files:** Create `app/components/agent-chat/welcome-chips.tsx`

- [ ] **Step 1: 创建**

```tsx
"use client"
import { useComposer } from "@assistant-ui/react"

const SUGGESTED = [
  "这个商品永久使用吗？",
  "我的订单到哪了？",
  "卡密失效怎么办？",
  "想找人工客服",
]

export function WelcomeChips() {
  const composer = useComposer()
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6">
      <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
        你好！我是 AI 客服，可以帮你查商品 / 订单 / 处理常见问题。下面是一些常问的：
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              composer.setText(q)
              composer.send()
            }}
            className="rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add app/components/agent-chat/welcome-chips.tsx && \
git commit -m "feat(chat): add welcome chips with suggested questions"
```

---

## Task 3.7: `escalate-button.tsx` + `fallback-qr.tsx` + `handoff-card.tsx`

**Files:** Create 3 components

- [ ] **Step 1: `escalate-button.tsx`**

```tsx
"use client"
import { Headset } from "lucide-react"
import { useThread } from "@assistant-ui/react"

export function EscalateButton() {
  const thread = useThread()
  return (
    <button
      type="button"
      title="找人工客服"
      onClick={() =>
        thread.append({
          role: "user",
          content: [{ type: "text", text: "我想找人工客服" }],
        })
      }
      className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Headset className="size-4" />
    </button>
  )
}
```

- [ ] **Step 2: `fallback-qr.tsx`**

```tsx
"use client"
import Image from "next/image"
import { CopyButtonClient } from "@/app/components/copy-promo-button"

const WECHAT_ID = "void_mall"

const COPY: Record<"daily-cap" | "timeout" | "budget", string> = {
  "daily-cap": "AI 客服暂时下班，请扫码加企微人工跟进。",
  timeout: "AI 客服暂时无法响应，请扫码加企微人工跟进。",
  budget: "今日免费咨询次数已达上限，请扫码加企微继续。",
}

export function FallbackQR({ reason }: { reason: "daily-cap" | "timeout" | "budget" }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-center text-sm text-muted-foreground">{COPY[reason]}</p>
      <Image src="/contact-qr.png" alt="客服二维码" width={168} height={168} className="rounded" />
      <div className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5">
        <span className="text-xs">
          <span className="text-muted-foreground">微信：</span>
          <span className="font-mono">{WECHAT_ID}</span>
        </span>
        <CopyButtonClient text={WECHAT_ID} size="icon" variant="ghost" className="size-6" successMessage="微信号已复制" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `handoff-card.tsx`**

```tsx
"use client"
import Image from "next/image"
import { CopyButtonClient } from "@/app/components/copy-promo-button"

const WECHAT_ID = "void_mall"

export function HandoffCard() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-center text-sm">
        已转接人工客服，请扫码加企微，您的对话记录已同步给客服。
      </p>
      <Image src="/contact-qr.png" alt="客服二维码" width={168} height={168} className="rounded" />
      <div className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5">
        <span className="text-xs">
          <span className="text-muted-foreground">微信：</span>
          <span className="font-mono">{WECHAT_ID}</span>
        </span>
        <CopyButtonClient text={WECHAT_ID} size="icon" variant="ghost" className="size-6" successMessage="微信号已复制" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add app/components/agent-chat/{escalate-button,fallback-qr,handoff-card}.tsx && \
git commit -m "feat(chat): add escalate button + fallback + handoff views"
```

---

## Task 3.8: `chat-panel.tsx` 主容器

**Files:** Create `app/components/agent-chat/chat-panel.tsx`

- [ ] **Step 1: 创建**

```tsx
"use client"
import { useEffect, useState } from "react"
import { ulid } from "ulid"
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
} from "@assistant-ui/react"
import { useChatRuntime } from "@assistant-ui/react-ai-sdk"
import { ChatBubble, ComposerBar } from "./chat-wrappers"
import { WelcomeChips } from "./welcome-chips"
import { FallbackQR } from "./fallback-qr"
import { HandoffCard } from "./handoff-card"

type FallbackReason = "daily-cap" | "timeout" | "budget"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("agent_session_id")
  if (!id) {
    id = ulid()
    localStorage.setItem("agent_session_id", id)
  }
  return id
}

export function ChatPanel() {
  const [sessionId] = useState(getOrCreateSessionId)
  const [handoff, setHandoff] = useState(false)
  const [fallback, setFallback] = useState<FallbackReason | null>(null)

  useEffect(() => {
    if (!sessionId) return
    fetch("/api/agent/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {})
  }, [sessionId])

  const runtime = useChatRuntime({
    api: "/api/agent/chat",
    body: { sessionId },
    onResponse: (res: Response) => {
      if (res.status === 423) setFallback("budget")
      if (res.status === 503) setFallback("daily-cap")
      if (res.status === 504) setFallback("timeout")
    },
    onToolCall: ({ toolCall }: { toolCall: { toolName: string } }) => {
      if (toolCall.toolName === "escalateToHuman") setHandoff(true)
    },
  })

  if (fallback) return <FallbackQR reason={fallback} />
  if (handoff) return <HandoffCard />

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full flex-col">
        <ThreadPrimitive.Empty>
          <WelcomeChips />
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Viewport autoScroll className="flex-1 overflow-y-auto p-2">
          <ThreadPrimitive.Messages components={{ Message: ChatBubble }} />
        </ThreadPrimitive.Viewport>
        <ComposerBar />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
```

- [ ] **Step 2: 提交**

```bash
npx tsc --noEmit && \
git add app/components/agent-chat/chat-panel.tsx && \
git commit -m "feat(chat): assemble ChatPanel with assistant-ui runtime"
```

---

## Task 3.9: 改造 `customer-service-fab.tsx`

**Files:** Modify `app/components/customer-service-fab.tsx`

- [ ] **Step 1: 把既有 popover 内容替换为 ChatPanel**

在导入区加：
```tsx
import { ChatPanel } from "./agent-chat/chat-panel"
```

把 `<PopoverContent ...>` 改为：

```tsx
<PopoverContent
  side="top"
  align="end"
  className="h-[80vh] w-screen p-0 md:h-[600px] md:w-[380px]"
>
  <ChatPanel />
</PopoverContent>
```

（保留 BTN / 拖拽 / 动画 / `pathname.startsWith("/admin")` 隐藏等既有逻辑）

- [ ] **Step 2: dev 起服务手动验证**

```bash
npm run dev
```

打开首页 → 点 fab → 应看到 WelcomeChips；点一个 chip → 应该开始流式响应（DeepSeek 已配 key 的话）。

- [ ] **Step 3: 提交**

```bash
git add app/components/customer-service-fab.tsx && \
git commit -m "feat(fab): swap QR popover content for ChatPanel"
```

---

# Phase 4 · 知识库 Admin

## Task 4.1: Zod schema

**Files:** Create `lib/validations/agent-knowledge.ts`

- [ ] **Step 1: 创建**

```ts
import { z } from "zod"

export const knowledgeSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string().min(1).max(30)).max(10),
  productId: z.string().optional().nullable(),
})

export const knowledgePatchSchema = knowledgeSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
})

export type KnowledgeInput = z.infer<typeof knowledgeSchema>
```

- [ ] **Step 2: 提交**

```bash
git add lib/validations/agent-knowledge.ts && \
git commit -m "feat(validations): add agent-knowledge Zod schema"
```

---

## Task 4.2: API routes `/api/admin/agent/knowledge/*`

**Files:** Create `app/api/admin/agent/knowledge/route.ts` 和 `app/api/admin/agent/knowledge/[id]/route.ts`

- [ ] **Step 1: 列表 + 创建**

`app/api/admin/agent/knowledge/route.ts`:

```ts
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { knowledgeSchema } from "@/lib/validations/agent-knowledge"
import { revalidateTag } from "next/cache"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.agentKnowledge.findMany({
    orderBy: { updatedAt: "desc" },
    include: { product: { select: { id: true, name: true } } },
  })
  return Response.json({ data: rows })
}

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = knowledgeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const created = await prisma.agentKnowledge.create({
    data: {
      ...parsed.data,
      authorId: session.user.id,
    },
  })
  revalidateTag("agent-knowledge")
  return Response.json({ data: created }, { status: 201 })
}
```

- [ ] **Step 2: 详情 / PATCH / DELETE**

`app/api/admin/agent/knowledge/[id]/route.ts`:

```ts
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { knowledgePatchSchema } from "@/lib/validations/agent-knowledge"
import { revalidateTag } from "next/cache"

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const row = await prisma.agentKnowledge.findUnique({ where: { id } })
  if (!row) return Response.json({ error: "Not Found" }, { status: 404 })
  return Response.json({ data: row })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const parsed = knowledgePatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === "PUBLISHED") data.publishedAt = new Date()

  const updated = await prisma.agentKnowledge.update({ where: { id }, data })
  revalidateTag("agent-knowledge")
  return Response.json({ data: updated })
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  await prisma.agentKnowledge.delete({ where: { id } })
  revalidateTag("agent-knowledge")
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: typecheck + 提交**

```bash
npx tsc --noEmit && \
git add app/api/admin/agent/knowledge && \
git commit -m "feat(api): admin knowledge CRUD with revalidateTag"
```

---

## Task 4.3: knowledge-columns.tsx + row-actions.tsx + form.tsx

**Files:** Create 三个文件（遵循 `app/admin/(main)/announcements/` 模式）

- [ ] **Step 1: `knowledge-columns.tsx`**

```tsx
"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type KnowledgeRow = {
  id: string
  title: string
  tags: string[]
  productId: string | null
  product?: { id: string; name: string } | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  updatedAt: string
}

const STATUS_VARIANT = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "outline",
} as const

export const columns: ColumnDef<KnowledgeRow>[] = [
  { accessorKey: "title", header: "标题", cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
  {
    accessorKey: "tags",
    header: "标签",
    cell: ({ row }) =>
      row.original.tags.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.tags.map((t) => (
            <Badge key={t} variant="outline">{t}</Badge>
          ))}
        </div>
      ),
  },
  {
    accessorKey: "product",
    header: "关联商品",
    cell: ({ row }) => row.original.product?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
  },
  { accessorKey: "updatedAt", header: "更新时间", cell: ({ row }) => formatDateTime(new Date(row.original.updatedAt)) },
]
```

- [ ] **Step 2: `knowledge-row-actions.tsx`**

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Edit, CheckCircle, XCircle, Archive, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { KnowledgeRow } from "./knowledge-columns"

export function KnowledgeRowActions({ row }: { row: KnowledgeRow }) {
  const router = useRouter()
  const [del, setDel] = useState(false)

  async function patch(status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
    await fetch(`/api/admin/agent/knowledge/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function remove() {
    await fetch(`/api/admin/agent/knowledge/${row.id}`, { method: "DELETE" })
    setDel(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/admin/agent/knowledge/${row.id}`)}>
            <Edit className="size-4" /> 编辑
          </DropdownMenuItem>
          {row.status !== "PUBLISHED" && (
            <DropdownMenuItem onClick={() => patch("PUBLISHED")}>
              <CheckCircle className="size-4" /> 发布
            </DropdownMenuItem>
          )}
          {row.status === "PUBLISHED" && (
            <DropdownMenuItem onClick={() => patch("DRAFT")}>
              <XCircle className="size-4" /> 撤回为草稿
            </DropdownMenuItem>
          )}
          {row.status !== "ARCHIVED" && (
            <DropdownMenuItem onClick={() => patch("ARCHIVED")}>
              <Archive className="size-4" /> 归档
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => setDel(true)}>
            <Trash2 className="size-4" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该知识条目？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 3: `knowledge-form.tsx`**

```tsx
"use client"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { knowledgeSchema, type KnowledgeInput } from "@/lib/validations/agent-knowledge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { MarkdownEditor } from "@/app/components/markdown-editor"

export function KnowledgeForm({
  initial,
  id,
  products,
}: {
  initial?: Partial<KnowledgeInput>
  id?: string
  products: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const form = useForm<KnowledgeInput>({
    resolver: zodResolver(knowledgeSchema),
    defaultValues: {
      title: initial?.title ?? "",
      content: initial?.content ?? "",
      tags: initial?.tags ?? [],
      productId: initial?.productId ?? null,
    },
  })

  async function onSubmit(values: KnowledgeInput) {
    const url = id ? `/api/admin/agent/knowledge/${id}` : "/api/admin/agent/knowledge"
    const method = id ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (res.ok) router.push("/admin/agent/knowledge")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标题</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>内容（Markdown）</FormLabel>
              <FormControl><MarkdownEditor value={field.value} onChange={field.onChange} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标签（逗号分隔）</FormLabel>
              <FormControl>
                <Input
                  value={field.value.join(", ")}
                  onChange={(e) =>
                    field.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>关联商品（可选）</FormLabel>
              <FormControl>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                >
                  <option value="">— 不关联 —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>保存</Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add app/admin/\(main\)/agent/knowledge/*.tsx && \
git commit -m "feat(admin): agent knowledge columns + row-actions + form"
```

---

## Task 4.4: knowledge-data-table.tsx + page.tsx + new + edit

**Files:** 创建数据表 + 三个 page

- [ ] **Step 1: `knowledge-data-table.tsx`**

```tsx
"use client"
import { useState } from "react"
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { columns, type KnowledgeRow } from "./knowledge-columns"
import { KnowledgeRowActions } from "./knowledge-row-actions"

export function KnowledgeDataTable({ rows }: { rows: KnowledgeRow[] }) {
  const [filter, setFilter] = useState("")

  const table = useReactTable({
    data: rows,
    columns: [
      ...columns,
      {
        id: "actions",
        cell: ({ row }) => <KnowledgeRowActions row={row.original} />,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
  })

  return (
    <div className="space-y-3">
      <Input
        placeholder="按标题或标签搜索…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((r) => (
            <TableRow key={r.id}>
              {r.getVisibleCells().map((c) => (
                <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { KnowledgeDataTable } from "./knowledge-data-table"
import type { KnowledgeRow } from "./knowledge-columns"

export default async function KnowledgePage() {
  const data = await prisma.agentKnowledge.findMany({
    orderBy: { updatedAt: "desc" },
    include: { product: { select: { id: true, name: true } } },
  })
  const rows: KnowledgeRow[] = data.map((r) => ({
    id: r.id,
    title: r.title,
    tags: r.tags,
    productId: r.productId,
    product: r.product,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">知识库</h1>
        <Link href="/admin/agent/knowledge/new">
          <Button>新建</Button>
        </Link>
      </div>
      <KnowledgeDataTable rows={rows} />
    </div>
  )
}
```

- [ ] **Step 3: `loading.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
```

- [ ] **Step 4: `new/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma"
import { KnowledgeForm } from "../knowledge-form"

export default async function NewKnowledgePage() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">新建知识条目</h1>
      <KnowledgeForm products={products} />
    </div>
  )
}
```

- [ ] **Step 5: `[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { KnowledgeForm } from "../knowledge-form"

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row, products] = await Promise.all([
    prisma.agentKnowledge.findUnique({ where: { id } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])
  if (!row) notFound()
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">编辑：{row.title}</h1>
      <KnowledgeForm id={id} initial={row} products={products} />
    </div>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add app/admin/\(main\)/agent/knowledge && \
git commit -m "feat(admin): knowledge data table + new/edit pages"
```

---

## Task 4.5: admin sidebar 加菜单

**Files:** Modify `app/components/admin-sidebar.tsx`

- [ ] **Step 1: 在合适位置加入子菜单（参考既有 distributors / announcements）**

```tsx
{
  label: "客服 Agent",
  icon: Headset,  // from lucide-react
  items: [
    { href: "/admin/agent/knowledge", label: "知识库" },
    { href: "/admin/agent/leads", label: "咨询单" },
    { href: "/admin/agent/conversations", label: "对话历史" },
  ],
},
```

- [ ] **Step 2: dev 验证 + 提交**

```bash
npm run dev
# 在 /admin 侧边栏看到 "客服 Agent" 三个子项
git add app/components/admin-sidebar.tsx && \
git commit -m "feat(admin-nav): add agent menu group"
```

---

# Phase 5 · Lead + 对话审计

## Task 5.1: Lead 列表 columns + row-actions + data-table + filters

**Files:** Create `app/admin/(main)/agent/leads/{leads-columns,leads-row-actions,leads-data-table,leads-filters}.tsx`

- [ ] **Step 1: `leads-filters.ts`**

```ts
export function parseLeadFilters(params: Record<string, string | undefined>) {
  return {
    status: params.status as
      | "PENDING_CONTACT" | "NEW" | "CONTACTED" | "RESOLVED" | "DROPPED"
      | undefined,
    urgency: params.urgency as "LOW" | "MED" | "HIGH" | undefined,
    q: params.q ?? "",
    page: Number(params.page) || 1,
    pageSize: Math.min(Number(params.pageSize) || 20, 100),
  }
}
```

- [ ] **Step 2: `leads-columns.tsx`** —— 标准列定义，含 status / urgency / wechatId 截断 / orderNo / reason 前 40 字 / createdAt（参考 4.3 写法，按需）

```tsx
"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"

export type LeadRow = {
  id: string
  sessionId: string
  wechatId: string | null
  orderNo: string | null
  reason: string
  urgency: "LOW" | "MED" | "HIGH"
  status: "PENDING_CONTACT" | "NEW" | "CONTACTED" | "RESOLVED" | "DROPPED"
  createdAt: string
}

const URG = { LOW: "outline", MED: "secondary", HIGH: "destructive" } as const

export const columns: ColumnDef<LeadRow>[] = [
  { accessorKey: "status", header: "状态", cell: ({ row }) => <Badge>{row.original.status}</Badge> },
  {
    accessorKey: "urgency",
    header: "紧急",
    cell: ({ row }) => <Badge variant={URG[row.original.urgency]}>{row.original.urgency}</Badge>,
  },
  {
    accessorKey: "wechatId",
    header: "微信",
    cell: ({ row }) => row.original.wechatId ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "orderNo",
    header: "订单号",
    cell: ({ row }) => row.original.orderNo ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "reason",
    header: "原因",
    cell: ({ row }) => <span className="line-clamp-1 max-w-[24ch] text-xs">{row.original.reason}</span>,
  },
  { accessorKey: "createdAt", header: "创建时间", cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)) },
]
```

- [ ] **Step 3: `leads-row-actions.tsx`** —— DropdownMenu，跳到详情或快捷状态流转。沿用 §4.3 row-actions 模式。

```tsx
"use client"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LeadRow } from "./leads-columns"

export function LeadsRowActions({ row }: { row: LeadRow }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/agent/leads/${row.id}`)}>
          <Eye className="size-4" /> 查看详情
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: `leads-data-table.tsx`** —— 复用项目既有服务端分页 DataTable 范式（参考 `cards-data-table.tsx`）。如果项目没有现成可用的服务端分页 helper，先简单实现：

```tsx
"use client"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { columns, type LeadRow } from "./leads-columns"
import { LeadsRowActions } from "./leads-row-actions"

export function LeadsDataTable({
  rows,
  total,
}: {
  rows: LeadRow[]
  total: number
}) {
  const table = useReactTable({
    data: rows,
    columns: [
      ...columns,
      { id: "actions", cell: ({ row }) => <LeadsRowActions row={row.original} /> },
    ],
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    manualPagination: true,
    rowCount: total,
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((r) => (
          <TableRow key={r.id}>
            {r.getVisibleCells().map((c) => (
              <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add app/admin/\(main\)/agent/leads/{leads-columns,leads-row-actions,leads-data-table,leads-filters}.tsx && \
git commit -m "feat(admin): leads columns/actions/table/filters"
```

---

## Task 5.2: Lead 列表 page.tsx + loading.tsx

**Files:** Create

- [ ] **Step 1: `page.tsx`**

```tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { LeadsDataTable } from "./leads-data-table"
import { parseLeadFilters } from "./leads-filters"
import type { LeadRow } from "./leads-columns"

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const f = parseLeadFilters(params)

  const where = {
    ...(f.status
      ? { status: f.status }
      : { status: { in: ["NEW", "CONTACTED"] as const } }),  // 默认只看主待办
    ...(f.urgency && { urgency: f.urgency }),
    ...(f.q && {
      OR: [
        { wechatId: { contains: f.q, mode: "insensitive" as const } },
        { orderNo: { contains: f.q, mode: "insensitive" as const } },
      ],
    }),
  }

  const [rows, total] = await Promise.all([
    prisma.agentLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    prisma.agentLead.count({ where }),
  ])

  const mapped: LeadRow[] = rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    wechatId: r.wechatId,
    orderNo: r.orderNo,
    reason: r.reason,
    urgency: r.urgency,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">咨询单</h1>
      <p className="text-xs text-muted-foreground">
        默认显示主待办（NEW + CONTACTED）。<Link href="?status=PENDING_CONTACT" className="underline">查看仅留微信号的访客</Link>
      </p>
      <LeadsDataTable rows={mapped} total={total} />
    </div>
  )
}
```

- [ ] **Step 2: `loading.tsx`**（同 4.4 Skeleton 模式）

```tsx
import { Skeleton } from "@/components/ui/skeleton"
export default function Loading() {
  return <Skeleton className="h-64 w-full" />
}
```

- [ ] **Step 3: 提交**

```bash
git add app/admin/\(main\)/agent/leads/{page,loading}.tsx && \
git commit -m "feat(admin): leads page with server pagination"
```

---

## Task 5.3: Lead 详情页 `[id]/page.tsx` + PATCH route

**Files:** Create `app/admin/(main)/agent/leads/[id]/page.tsx` 和 `app/api/admin/agent/leads/[id]/route.ts`

- [ ] **Step 1: PATCH route**

```ts
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  status: z.enum(["PENDING_CONTACT", "NEW", "CONTACTED", "RESOLVED", "DROPPED"]).optional(),
  notes: z.string().max(2000).optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 })

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === "CONTACTED") {
    data.contactedAt = new Date()
    data.contactedBy = session.user.id
  }

  const updated = await prisma.agentLead.update({ where: { id }, data })
  return Response.json({ data: updated })
}
```

- [ ] **Step 2: 详情页**

```tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { MarkdownView } from "@/app/components/markdown-view"
import { LeadStatusForm } from "./lead-status-form"

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await prisma.agentLead.findUnique({
    where: { id },
    include: { session: { select: { id: true, fingerprintHash: true, tokensUsed: true } } },
  })
  if (!lead) notFound()

  const snapshot = (lead.conversationSnapshot ?? []) as Array<{
    role: string
    contentText: string
    toolName: string | null
  }>

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">对话快照</h2>
        <div className="space-y-2 rounded border p-3 text-sm">
          {snapshot.map((m, i) => (
            <div key={i}>
              <span className="font-mono text-xs text-muted-foreground">[{m.role}]</span>{" "}
              <MarkdownView content={m.contentText} />
            </div>
          ))}
        </div>
        <Link
          href={`/admin/agent/conversations/${lead.sessionId}`}
          className="text-sm underline"
        >
          查看完整对话 →
        </Link>
      </div>
      <aside className="space-y-3 rounded border p-3">
        <div className="space-y-1 text-sm">
          <p><strong>状态：</strong>{lead.status}</p>
          <p><strong>紧急度：</strong>{lead.urgency}</p>
          <p><strong>微信号：</strong>{lead.wechatId ?? "—"}</p>
          <p><strong>订单号：</strong>{lead.orderNo ?? "—"}</p>
          <p><strong>原因：</strong>{lead.reason}</p>
        </div>
        <LeadStatusForm id={lead.id} status={lead.status} notes={lead.notes ?? ""} />
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: `lead-status-form.tsx`** 简单状态切换 + notes

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const NEXT: Record<string, string[]> = {
  PENDING_CONTACT: ["CONTACTED", "DROPPED"],
  NEW: ["CONTACTED"],
  CONTACTED: ["RESOLVED", "DROPPED"],
  RESOLVED: [],
  DROPPED: [],
}

export function LeadStatusForm({ id, status, notes }: { id: string; status: string; notes: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState(notes)

  async function patch(payload: Record<string, unknown>) {
    await fetch(`/api/admin/agent/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="备注"
        rows={3}
      />
      <Button variant="outline" size="sm" onClick={() => patch({ notes: draft })}>
        保存备注
      </Button>
      <div className="flex flex-wrap gap-2">
        {NEXT[status]?.map((next) => (
          <Button key={next} size="sm" onClick={() => patch({ status: next })}>
            转 {next}
          </Button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
npx tsc --noEmit && \
git add app/admin/\(main\)/agent/leads/\[id\] app/api/admin/agent/leads && \
git commit -m "feat(admin): lead detail + status flow PATCH"
```

---

## Task 5.4: Conversations 列表（ILIKE 搜索）

**Files:** Create `app/admin/(main)/agent/conversations/*`

- [ ] **Step 1: `conversations-filters.ts`**

```ts
export function parseConvFilters(params: Record<string, string | undefined>) {
  return {
    q: params.q ?? "",
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
    escalated: params.escalated === "true" ? true : undefined,
    page: Number(params.page) || 1,
    pageSize: Math.min(Number(params.pageSize) || 20, 100),
  }
}
```

- [ ] **Step 2: `conversations-columns.tsx`**

```tsx
"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"

export type ConvRow = {
  id: string
  fingerprintHash: string
  messageCount: number
  tokensUsed: number
  escalated: boolean
  hasLead: boolean
  startedAt: string
}

export const columns: ColumnDef<ConvRow>[] = [
  {
    accessorKey: "id",
    header: "Session",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id.slice(0, 8)}</span>,
  },
  {
    accessorKey: "fingerprintHash",
    header: "FP",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.fingerprintHash.slice(0, 6)}</span>,
  },
  { accessorKey: "messageCount", header: "消息数" },
  { accessorKey: "tokensUsed", header: "Token" },
  {
    accessorKey: "escalated",
    header: "Escalated",
    cell: ({ row }) => (row.original.escalated ? <Badge variant="destructive">是</Badge> : "—"),
  },
  {
    accessorKey: "hasLead",
    header: "Lead",
    cell: ({ row }) => (row.original.hasLead ? "✓" : "—"),
  },
  { accessorKey: "startedAt", header: "开始时间", cell: ({ row }) => formatDateTime(new Date(row.original.startedAt)) },
]
```

- [ ] **Step 3: `conversations-data-table.tsx`** —— 与 5.1 LeadsDataTable 类似服务端分页

```tsx
"use client"
import Link from "next/link"
import {
  flexRender, getCoreRowModel, useReactTable,
} from "@tanstack/react-table"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { columns, type ConvRow } from "./conversations-columns"

export function ConversationsDataTable({ rows, total }: { rows: ConvRow[]; total: number }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    manualPagination: true,
    rowCount: total,
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((r) => (
          <TableRow key={r.id} className="cursor-pointer">
            <TableCell colSpan={columns.length}>
              <Link href={`/admin/agent/conversations/${r.original.id}`} className="block">
                <div className="flex gap-4 text-sm">
                  {r.getVisibleCells().map((c) => (
                    <span key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</span>
                  ))}
                </div>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: `page.tsx`**（ILIKE 搜索逻辑）

```tsx
import { prisma } from "@/lib/prisma"
import { ConversationsDataTable } from "./conversations-data-table"
import { parseConvFilters } from "./conversations-filters"
import type { ConvRow } from "./conversations-columns"

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const f = parseConvFilters(params)

  let sessionIds: string[] | undefined
  if (f.q) {
    const hits = await prisma.agentMessage.findMany({
      where: { contentText: { contains: f.q, mode: "insensitive" } },
      select: { sessionId: true },
      distinct: ["sessionId"],
      take: 500,
    })
    sessionIds = hits.map((h) => h.sessionId)
    if (sessionIds.length === 0) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">对话历史</h1>
          <p className="text-sm text-muted-foreground">未找到匹配关键词的对话。</p>
        </div>
      )
    }
  }

  const where = {
    ...(sessionIds && { id: { in: sessionIds } }),
    ...(f.escalated !== undefined && { escalated: f.escalated }),
    ...(f.from && { startedAt: { gte: f.from } }),
    ...(f.to && { startedAt: { lte: f.to } }),
  }

  const [rows, total] = await Promise.all([
    prisma.agentSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: {
        _count: { select: { messages: true } },
        lead: { select: { id: true } },
      },
    }),
    prisma.agentSession.count({ where }),
  ])

  const mapped: ConvRow[] = rows.map((s) => ({
    id: s.id,
    fingerprintHash: s.fingerprintHash,
    messageCount: s._count.messages,
    tokensUsed: s.tokensUsed,
    escalated: s.escalated,
    hasLead: !!s.lead,
    startedAt: s.startedAt.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">对话历史</h1>
      <ConversationsDataTable rows={mapped} total={total} />
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add app/admin/\(main\)/agent/conversations && \
git commit -m "feat(admin): conversations list with ILIKE keyword search"
```

---

## Task 5.5: Conversation 详情页

**Files:** Create `app/admin/(main)/agent/conversations/[sessionId]/page.tsx`

- [ ] **Step 1: 实现**

```tsx
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { MarkdownView } from "@/app/components/markdown-view"
import { formatDateTime } from "@/lib/utils"

export default async function ConversationDetail({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      lead: true,
    },
  })
  if (!session) notFound()

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">对话 {session.id.slice(0, 12)}…</h1>
        <div className="space-y-3 rounded border p-4 text-sm">
          {session.messages.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="text-xs text-muted-foreground">
                [{m.role}] {formatDateTime(new Date(m.createdAt))}
                {m.toolName && ` · tool: ${m.toolName}`}
                {m.inputTokens > 0 && ` · in:${m.inputTokens}/out:${m.outputTokens}`}
                {m.feedback && ` · feedback:${m.feedback}`}
              </div>
              {m.role === "TOOL" ? (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary>tool 调用详情</summary>
                  <pre className="overflow-auto">{JSON.stringify(m.parts, null, 2)}</pre>
                </details>
              ) : (
                <MarkdownView content={m.contentText} />
              )}
            </div>
          ))}
        </div>
      </div>
      <aside className="space-y-3 rounded border p-3 text-sm">
        <p><strong>开始：</strong>{formatDateTime(session.startedAt)}</p>
        <p><strong>Token 用量：</strong>{session.tokensUsed} / {session.tokenBudget}</p>
        <p><strong>Escalated：</strong>{session.escalated ? "是" : "否"}</p>
        <p><strong>FP：</strong><span className="font-mono text-xs">{session.fingerprintHash.slice(0, 12)}</span></p>
        {session.lead && (
          <a href={`/admin/agent/leads/${session.lead.id}`} className="block underline">
            该会话已生成 Lead →
          </a>
        )}
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add app/admin/\(main\)/agent/conversations/\[sessionId\] && \
git commit -m "feat(admin): conversation detail page"
```

---

# Phase 6 · Cron + 验收

## Task 6.1: Cron route + vercel.json schedule

**Files:** Create `app/api/cron/agent-cleanup/route.ts`、modify `vercel.json`

- [ ] **Step 1: 创建 route**

```ts
import { config } from "@/lib/config"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return new Response(null, { status: 401 })
  }
  const deleted = await prisma.agentSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return Response.json({ deleted: deleted.count })
}
```

- [ ] **Step 2: `vercel.json` 加 cron**

如 `vercel.json` 不存在则创建。已有则在 `crons` 数组追加：

```json
{
  "crons": [
    { "path": "/api/cron/agent-cleanup", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/cron/agent-cleanup vercel.json && \
git commit -m "feat(cron): daily cleanup of expired agent sessions"
```

---

## Task 6.2: E2E Playwright spec — happy path

**Files:** Create `e2e/agent-chat-happy.spec.ts`

- [ ] **Step 1: 写 spec**

```ts
import { test, expect } from "@playwright/test"

test("访客打开 widget → 发消息 → 收到流式回复", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /联系客服/ }).click()
  // 等 WelcomeChips 出现
  await expect(page.getByText("我是 AI 客服")).toBeVisible()
  await page.getByText("这个商品永久使用吗？").click()
  // 流式响应内出现至少一个 assistant bubble
  await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
    timeout: 15_000,
  })
})
```

- [ ] **Step 2: 运行 + 通过 + 提交**

```bash
npm run test:e2e -- agent-chat-happy && \
git add e2e/agent-chat-happy.spec.ts && \
git commit -m "test(e2e): agent chat happy path"
```

---

## Task 6.3: E2E specs — escalate / collect-wechat / fallback

**Files:** Create three more spec files

- [ ] **Step 1: `e2e/agent-escalate.spec.ts`**

```ts
import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

test("触发 escalate → 看到 QR + admin 后台出现 status=NEW Lead", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /联系客服/ }).click()
  await page.getByPlaceholder(/输入您的问题/).fill("我要退款，订单 KM2026-NOTEXIST")
  await page.keyboard.press("Enter")
  await expect(page.getByText(/已为你转接人工客服/)).toBeVisible({ timeout: 20_000 })

  // DB 校验
  const lead = await prisma.agentLead.findFirst({
    where: { reason: { contains: "退款" } },
    orderBy: { createdAt: "desc" },
  })
  expect(lead?.status).toBe("NEW")
})
```

- [ ] **Step 2: `e2e/agent-collect-wechat.spec.ts`**

```ts
import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

test("访客主动留微信 → admin 后台出现 PENDING_CONTACT", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /联系客服/ }).click()
  await page.getByPlaceholder(/输入您的问题/).fill("方便联系的话我微信 testuser2026")
  await page.keyboard.press("Enter")
  // 等 collect_wechat 工具调用完成
  await page.waitForTimeout(5000)

  const lead = await prisma.agentLead.findFirst({
    where: { wechatId: "testuser2026" },
  })
  expect(lead?.status).toBe("PENDING_CONTACT")
})
```

- [ ] **Step 3: `e2e/agent-fallback.spec.ts`**

```ts
import { test, expect } from "@playwright/test"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

test("日额度打满 → fallback QR", async ({ page }) => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  await redis.set(`quota:day:in:${day}`, 10_000_000)
  try {
    await page.goto("/")
    await page.getByRole("button", { name: /联系客服/ }).click()
    await page.getByPlaceholder(/输入您的问题/).fill("hello")
    await page.keyboard.press("Enter")
    await expect(page.getByText(/客服暂时下班/)).toBeVisible({ timeout: 15_000 })
  } finally {
    await redis.del(`quota:day:in:${day}`)
  }
})
```

- [ ] **Step 4: 跑全套 + 提交**

```bash
npm run test:e2e && \
git add e2e/agent-{escalate,collect-wechat,fallback}.spec.ts && \
git commit -m "test(e2e): escalate + collect-wechat + fallback"
```

---

## Task 6.4: 手动验收 + Vercel 部署清单

**Files:** None — 这是 checklist task，逐项手动验证。

- [ ] **Step 1: Vercel Marketplace 装 Upstash Redis**
  - Vercel Dashboard → Storage → Browse Marketplace → Upstash Redis → Add
  - 选 Free tier，绑定到 account-mall project
  - 确认 Project Settings → Environment Variables 出现 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（或 `KV_REST_API_URL` / `KV_REST_API_TOKEN`）

- [ ] **Step 2: Vercel AI Gateway**
  - Dashboard → AI Gateway → Enable
  - 确认 `vercel link` 后 `AI_GATEWAY_API_KEY` 已自动注入

- [ ] **Step 3: 配置 env**
  - `WECHAT_QR_URL` / `WECHAT_ID`
  - `CRON_SECRET`（生成 `openssl rand -hex 32`）
  - `ESCALATE_WEBHOOK_URL`（可选，先不配测，配置后再测）

- [ ] **Step 4: 部署后手动验证清单**

```
[ ] 首页打开 fab → 点开看到 WelcomeChips
[ ] 点 chip "这个商品永久使用吗？" → 1-2s 内开始流式
[ ] AI 回答里含 "[来源: …]" 引用（条件: 知识库有相关条目）
[ ] 鼠标悬停 assistant bubble → ActionBar 可见 (复制 / 👍 / 👎)
[ ] 点 👍 → DB AgentMessage.feedback = POSITIVE
[ ] 输入 "我要退款" → 触发 escalate → 看到 QR + 文案
[ ] /admin/agent/leads 看到该 Lead，status=NEW
[ ] /admin/agent/conversations 看到该会话，escalated=true
[ ] /admin/agent/knowledge 新建条目 → 发布 → 再去前台问相关问题 → AI 知道
[ ] Vercel Observability → AI 看到 trace + cached_tokens
[ ] 在 Redis 手动 SET quota:day:in:<today> 9999999 → 前台输入消息 → 看到 "客服暂时下班"
[ ] curl GET /api/cron/agent-cleanup 不带 Authorization → 401
[ ] curl GET /api/cron/agent-cleanup -H "Authorization: Bearer <CRON_SECRET>" → JSON { deleted: N }
```

- [ ] **Step 5: 提交 README 验收记录（可选）**

```bash
# 如果有任何修复，commit 一次
git status
# 若 clean, MVP 完成
```

---

# 自检 / 完成标志

完成全部 task 后，运行：

```bash
npm run lint && \
npx tsc --noEmit && \
npm test && \
npm run build
```

全绿即 MVP 完成。
