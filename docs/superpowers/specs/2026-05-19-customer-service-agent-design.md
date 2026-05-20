# Customer Service Agent Design

**Date:** 2026-05-19
**Status:** Draft
**Supersedes:** [2026-05-19-hermes-customer-service-design.md](./2026-05-19-hermes-customer-service-design.md)
**Scope:** 用 Vercel AI SDK + DeepSeek API（OpenAI 兼容直连）在 account-mall 内嵌入前台客服 agent，覆盖匿名访客咨询、平台数据问答、admin 监督式知识录入、企微人工兜底、防滥用边界。所有业务和合规决策与上一版保持一致，仅替换执行引擎与部署形态。

> **2026-05-20 update**：从 Vercel AI Gateway 改为直连 DeepSeek。Gateway 的 fallback/observability/no-markup 对单 provider MVP 没有可操作的收益；直连减少一个外部依赖跳。下文 §4 架构图 / §8 / D11 / D13 已对齐；§8.2 旧"兜底路径"段已合并到 §8.1。

---

## 1. 目标与非目标

### 目标

1. 匿名前台访客可通过悬浮聊天 widget 与 agent 实时流式对话
2. Agent 基于平台数据（商品/公告/订单）+ admin 录入的知识库回答问题
3. Admin 通过后台 CRUD 录入和管理知识库条目
4. Agent 主动收集用户微信号，必要时升级人工并生成"咨询单"
5. 在脚本恶意调用 / 抖量场景下，每日最大损失 ≤ $1，超额自动降级为 QR 兜底
6. 工程量与运维成本均最小化——零额外服务，与现有 Next.js + Prisma + Vercel 栈一致

### 非目标 (MVP 外)

- 多平台接入（Telegram / 企微 bot 作 C 端入口）
- pgvector 语义检索（embedding 字段预留）
- 多语种（先做中文）
- 客服在企微里直接与 C 端对话（人工接管走"加企微"流程）
- 自动学习 / 演化（agent 不写知识库；admin 全权）

---

## 2. 关键决策

| # | 维度 | 决策 |
|---|---|---|
| D1 | 运行环境 | Next.js Route Handler（Vercel Functions，Node runtime）；**无 VPS、无 Docker、无独立进程** |
| D2 | 访问门槛 | 匿名可聊 + Vercel BotID Basic（无感校验）+ 多键限流 + 会话 tokenBudget（单日预算，砍续杯流程） |
| D3 | 预算护栏 | 日 token 闸到顶 → 直接返回 fallback UI（QR + 临时下班文案），不降级模型 |
| D4 | 人工兜底 | 返回企微 QR + admin 后台生成 Lead 含 conversationSnapshot |
| D5 | 知识对接 | 工具直接 `prisma.*` 同进程读写，无 HTTP 反代 |
| D6 | 微信号收集 | MVP 保留；**不做 PIPL 弹窗/告知/用户自助删除**——告知降级为"继续聊 = 默示同意"；90 天 cron 清理保留作为数据卫生措施（非合规义务） |
| D7 | 学习方式 | admin 后台结构化 CRUD（`AgentKnowledge` 表）；agent 不写知识库、不自演化 |
| D8 | 既有 `/api/cs/*` | 不再被 agent 使用；保留两条既有路由作公开 read-only，加 60/min/IP 限流；不强制改 |
| D9 | 对话完整审计 | 自建 `AgentMessage` 表 + admin "对话浏览" 页（MVP 用 ILIKE 检索；v1.1 升 pgvector / tsvector）+ Vercel Observability 看 trace/usage/延迟 |
| D10 | 静态话术 vs 动态知识库 | 全走 `AgentKnowledge` + `lookupKnowledge` tool |
| D11 | 模型 | DeepSeek V4 Flash (`deepseek-chat`)；DeepSeek 自家 prompt cache 自动命中 |
| D12 | sessionId 生成 | 客户端 ULID（前端 `ulid` 包），存 localStorage |
| D13 | Provider 接法 | DeepSeek OpenAI 兼容 API 直连：`createOpenAI({ baseURL: "https://api.deepseek.com", apiKey: config.deepseekApiKey })`。无 Gateway 中间层 |
| D14 | 既有 `customer-service-fab.tsx` | 演化为 ChatWidget 容器：悬浮按钮 + 拖拽 + 动画保留；popover 内容从 QR 改为 ChatPanel；额度耗尽或 fallback 时降级回 QR 视图 |

---

## 3. 非协商前提

1. **限流存储必须分布式**：既有 `lib/rate-limit.ts` 内存版在 Vercel 多实例下不可靠，**不复用** `checkAiChatRateLimit`（其 key 写死 `ai-chat:${userId}`，对匿名访客无效）。Agent 路径全部走 Upstash Redis（`@upstash/ratelimit` Sliding Window）。日 token 闸用 Redis 原子计数。
2. **会话 token 预算**：每 sessionId 单日预算 `agentTokenBudget`（默认 2000，env 可调），用完触发 423 → 前端切 fallback QR；**不做续杯流程**（BotID 持续无感校验，不需要二次人机验证）
3. **Token 计量按 LLM `usage` 字段**：input + output 分别按 token 计；调用前估算预扣，调用后补差或回滚
4. **数据保留**：90 天 cron 自动清理（数据卫生措施，避免 AgentMessage 表无限膨胀）；**不做** PIPL 弹窗/告知/用户自助删除
5. **不开 thinking 模式**：DeepSeek 仅用 `deepseek-chat`（V4 Flash non-thinking）
6. **预扣原子化**：Redis pipeline 单步完成"检查 + 扣费"防 race；失败回滚
7. **Prompt 注入防御**：用户消息 4 KB 上限；strip sentinel；tool schema 严格；`lookupOrder` 永远固定文案不区分"不存在 vs 不匹配"
8. **Hermes 路径里的 HMAC / nginx CIDR / SSH 隧道**：本版不需要（无外部进程）

---

## 4. 架构总图

```
┌──────────────────────────────────────┐
│ 浏览器 ChatWidget                    │
│  @ai-sdk/react useChat               │
│  ChatPanel · fallback QR             │
└─────────────────┬────────────────────┘
                  │ same-origin SSE
                  ▼
┌──────────────────────────────────────────────────────────┐
│ Vercel · account-mall (Next.js App Router)               │
│                                                          │
│ app/api/agent/                                           │
│  ├─ session/start          BotID, 登记 AgentSession      │
│  └─ chat   (POST, SSE)     主接口：streamText            │
│                                                          │
│ app/api/admin/agent/                                     │
│  ├─ knowledge   CRUD                                     │
│  ├─ leads       列表 / PATCH 状态                        │
│  └─ conversations  列表 / 详情 / FTS 搜索                │
│                                                          │
│ app/api/cron/agent-cleanup  Vercel Cron daily 03:00 UTC  │
│                                                          │
│ lib/                                                     │
│  ├─ agent-cs.ts          tools + system prompt builder   │
│  ├─ agent-anti-abuse.ts  BotID + Upstash + token 预扣    │
│  ├─ agent-rate-limit.ts  4 个 Ratelimit 实例             │
│  ├─ agent-persistence.ts AgentMessage 持久化助手         │
│  └─ business-hours.ts    isInBusinessHours()             │
│                                                          │
│ app/admin/(main)/agent/                                  │
│  ├─ knowledge/   DataTable 四件套 + Form                 │
│  ├─ leads/       DataTable 四件套 + 详情                 │
│  └─ conversations/ DataTable 四件套 + FTS 搜索 + 详情    │
│                                                          │
│ app/components/agent-chat/* + customer-service-fab.tsx  │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│ DeepSeek API (https://api.deepseek.com, OpenAI 兼容)     │
│   model: deepseek.chat("deepseek-chat")  // V4 Flash     │
│   自家 prompt caching 自动命中 (cache-hit $0.0028/M)     │
│   挂掉走 fallback QR (不切 provider, MVP 不需要)         │
└──────────────────────────────────────────────────────────┘
```

**安全边界：**
- 工具 execute 中所有 Prisma 查询用闭包传入 sessionId 锁定身份；agent 不可越权
- `lookupOrder` 脱敏：不返回卡密内容；找不到时返回固定 `{ found: false }`
- 系统级数据（cards、用户密码、配置 secret）从未进入 system prompt 也从未作为 tool 输出
- `streamText` 用 `abortSignal: AbortSignal.timeout(15_000)` 兜底超时

---

## 5. 数据模型（Prisma）

```prisma
model AgentSession {
  id                      String         @id          // 客户端 ULID
  fingerprintHash         String                      // SHA256(IP + UA).slice(0, 32)
  startedAt               DateTime       @default(now())
  endedAt                 DateTime?
  tokenBudget             Int            @default(2000)   // 与 config.agentTokenBudget 一致, 单日预算
  tokensUsed              Int            @default(0)
  escalated               Boolean        @default(false)
  expiresAt               DateTime                    // startedAt + 90 days
  messages                AgentMessage[]
  lead                    AgentLead?
  @@index([expiresAt])
}

model AgentMessage {
  id           String         @id @default(cuid())
  sessionId    String
  session      AgentSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role         MessageRole
  parts        Json                                   // UIMessage.parts
  contentText  String         @db.Text                // 提取文本
  toolName     String?                                // 仅 TOOL role
  citations    Json?                                  // assistant: lookupKnowledge 命中的 id 列表
  feedback     MessageFeedback?                       // assistant: 用户 👍/👎
  inputTokens  Int            @default(0)             // 仅 ASSISTANT
  outputTokens Int            @default(0)
  createdAt    DateTime       @default(now())
  @@index([sessionId, createdAt])
  @@index([feedback])                                 // missed questions 查询
}

enum MessageFeedback { POSITIVE NEGATIVE }

enum MessageRole { USER ASSISTANT TOOL SYSTEM }

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
// PENDING_CONTACT: 用户主动留微信号但 AI 没决定升级人工 (collectWechat 触发)
// NEW            : AI 主动 escalate, 需立刻处理 (escalateToHuman 触发)
enum LeadUrgency { LOW MED HIGH }

model AgentKnowledge {
  id          String           @id @default(cuid())
  title       String
  content     String           @db.Text
  tags        String[]
  productId   String?
  product     Product?         @relation(fields: [productId], references: [id])
  status      KnowledgeStatus  @default(DRAFT)
  authorId    String
  author      User             @relation(fields: [authorId], references: [id])
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  publishedAt DateTime?
  embedding   Float[]?
  @@index([status, productId])
  @@index([tags])
}

enum KnowledgeStatus { DRAFT PUBLISHED ARCHIVED }
```

**对话搜索方案**：MVP 用 Prisma `contains` (ILIKE) 直接查 `contentText`，不建 FTS GIN 索引。

```ts
prisma.agentMessage.findMany({
  where: { contentText: { contains: q, mode: "insensitive" } },
  select: { sessionId: true },
  distinct: ["sessionId"],
})
```

数据量到 ~10 万条时再加 tsvector GIN（**v1.1 工作量**，与 `zhparser` 中文分词一起做）。

---

## 6. 接口清单

### 6.1 前台 `/api/agent/*`

| 接口 | 方法 | 鉴权 | 用途 |
|---|---|---|---|
| `/api/agent/session/start` | POST | BotID token | 服务端登记 `AgentSession`（id 客户端已生成） |
| `/api/agent/chat` | POST (SSE) | sessionId | 流式对话主接口（同时再过 BotID） |
| `/api/agent/message-feedback` | POST | sessionId | 写 `AgentMessage.feedback` ∈ POSITIVE / NEGATIVE |

### 6.2 admin `/api/admin/agent/*`

均走 `getAdminSession()` 鉴权。

| 接口 | 方法 | 用途 |
|---|---|---|
| `/api/admin/agent/knowledge` | GET / POST | 列表 / 创建 |
| `/api/admin/agent/knowledge/[id]` | GET / PATCH / DELETE | 详情 / 编辑 / 删除 |
| `/api/admin/agent/leads` | GET | 服务端分页列表 |
| `/api/admin/agent/leads/[id]` | PATCH | 状态流转 / notes 更新 |
| `/api/admin/agent/conversations` | GET | 服务端分页 + FTS 搜索 |
| `/api/admin/agent/conversations/[sessionId]` | GET | 完整对话 + Lead + Session metadata |

### 6.3 Cron `/api/cron/agent-cleanup`

Vercel Cron daily 03:00 UTC，删 `AgentSession.expiresAt < now()`，cascade `AgentMessage` 与 `AgentLead`。

**鉴权**：route handler 必须校验 `Authorization: Bearer ${CRON_SECRET}` header（Vercel Cron 标准做法，防外部直接 GET 触发清理）：

```ts
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return new Response(null, { status: 401 })
  }
  // ... deleteMany
}
```

### 6.4 既有 `/api/cs/*` 处置

`/api/cs/products` 和 `/api/cs/announcements` 既有代码**保留不动**，加 `csReverse` Upstash 限流（60/min/IP）。注释里"Hermes customer service agent"改为"public read-only consumer endpoint"。

---

## 7. 关键数据流

### 7.1 `/api/agent/chat` 主流程

```ts
// app/api/agent/chat/route.ts
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai"
import { applyAntiAbuse, reserveTokens, commitUsage, rollbackTokens, estimateTokens }
  from "@/lib/agent-anti-abuse"
import { buildCSPrompt, buildCSTools } from "@/lib/agent-cs"
import {
  persistUserMessage, persistToolStep, persistAssistantMessage, fetchPublishedKnowledge,
} from "@/lib/agent-persistence"
import { config } from "@/lib/config"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { messages, sessionId } = (await req.json()) as {
    messages: UIMessage[]
    sessionId: string
  }

  // 1. 前置：BotID + session 校验 + budget + 限流 + 4KB 上限
  const guard = await applyAntiAbuse(req, sessionId, messages)
  if (!guard.ok) return guard.response

  // 2. 预扣（Redis pipeline 原子完成）
  const estimated = estimateTokens(messages)
  const reserved = await reserveTokens(sessionId, estimated)
  if (!reserved.ok) return guard.fallbackResponse(reserved.reason)

  // 3. 持久化用户消息
  await persistUserMessage(sessionId, messages.at(-1)!)

  // 4. 拉知识库（PUBLISHED 全部，几十条以内）
  const knowledge = await fetchPublishedKnowledge()

  // 5. streamText
  //    - model: deepseek.chat("deepseek-chat") via createOpenAI 直连 DeepSeek
  //    - DeepSeek 自家 prompt caching: system prompt 前缀稳定时自动命中, cache-hit $0.0028/M
  //    - 失败时 onError rollback 预扣, 前端切 fallback QR
  const result = streamText({
    model: deepseek.chat("deepseek-chat"),
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
    onStepFinish: async (step) => persistToolStep(sessionId, step),
    onFinish: async ({ usage, response }) => {
      await commitUsage(sessionId, estimated, usage)
      await persistAssistantMessage(sessionId, response.messages, usage)
    },
    onError: async () => rollbackTokens(sessionId, estimated),
  })

  return result.toUIMessageStreamResponse()
}
```

**关键点：**
- `applyAntiAbuse` 内做所有校验：BotID `checkBotId()` 通过、session 存在、未过期、tokensUsed < tokenBudget、limiters（IP / session / fingerprint）、message 4KB 上限
- 失败时返回的 `response` 是 423/429/410/412/503 之一，前端 `useChat onResponse` 触发 fallback UI
- `estimateTokens` 简单算法：input ≈ `JSON.stringify(messages).length / 4 + 500`（system prompt 估），output 固定 500
- 估算允许过低；`onFinish` 时按 `usage` 真实值补差
- `onError` 包含 timeout 和 streaming 中断 — 自动回滚 Redis 预扣

### 7.2 工具实现（`lib/agent-cs.ts`）

```ts
import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { isInBusinessHours } from "@/lib/business-hours"

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
            id: true, name: true, slug: true, summary: true,
            price: true, productType: true,
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

    lookupOrder: tool({
      description: "按订单号查订单状态。不返回卡密内容。",
      inputSchema: z.object({ orderNo: z.string().min(6).max(40) }),
      execute: async ({ orderNo }) => {
        const order = await prisma.order.findFirst({
          where: { orderNo },
          select: {
            orderNo: true, status: true, amount: true,
            productNameSnapshot: true, paidAt: true, createdAt: true,
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
        // 返回带 id 的结构, 让 system prompt 指导 agent 在回答末尾标注 [来源:title]
        // citation 写到 AgentMessage.citations (onFinish 里持久化)
        return rows.map((r) => ({
          id: r.id,
          title: r.title,
          tags: r.tags,
          excerpt: r.content.slice(0, 200),
        }))
      },
    }),

    collectWechat: tool({
      description: "用户主动提供微信号时调用",
      inputSchema: z.object({
        wechatId: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/, "微信号格式不符"),
      }),
      execute: async ({ wechatId }) => {
        await prisma.agentLead.upsert({
          where: { sessionId },
          create: {
            sessionId, wechatId,
            reason: "用户主动提供",
            status: "PENDING_CONTACT",      // 不进 admin 主待办队列, 标记"已留联系方式"
            conversationSnapshot: {},
          },
          update: { wechatId },              // 已存在 Lead 时只补微信号, 不动 status
        })
        // 同时返回 QR, 让 agent 自然回 "好的, 我会让客服联系您, 这是企微 QR..."
        return {
          ok: true,
          qrUrl: config.wechatQrUrl,
          wechatId: config.wechatId,
          message: "已记录, 客服会主动加您。如需快速联系也可以扫码加我们的企微。",
        }
      },
    }),

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
              sessionId, reason, urgency, status: "NEW",
              conversationSnapshot: snapshot,
            },
            update: {
              reason, urgency, status: "NEW",
              conversationSnapshot: snapshot,
            },
          }),
          prisma.agentSession.update({
            where: { id: sessionId },
            data: { escalated: true },
          }),
        ])

        // E5: HIGH urgency 触发外部推送 (fire-and-forget, 不阻塞流式响应)
        if (urgency === "HIGH" && config.escalateWebhookUrl) {
          fetch(config.escalateWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `🆘 客服紧急 Lead\n原因: ${reason}\n会话: ${sessionId.slice(0, 8)}\n查看: ${config.siteUrl}/admin/agent/leads`,
            }),
          }).catch(() => {})  // 失败不影响主流程
        }

        // 工作时间外补充提示
        const inHours = isInBusinessHours()
        const { businessHoursStart: s, businessHoursEnd: e } = config
        const message = inHours
          ? "已为你转接人工客服，扫码加企微即可，订单号或微信号可直接发给客服。"
          : `已为你转接人工客服，当前 ${String(e).padStart(2, "0")}:00–${String(s).padStart(2, "0")}:00 客服休息时间，扫码加企微，我们 ${String(s).padStart(2, "0")}:00 上线后第一时间回复。`

        return {
          qrUrl: config.wechatQrUrl,
          wechatId: config.wechatId,
          message,
        }
      },
    }),
  }
}
```

### 7.3 Escalate 后用户端

`escalateToHuman` 返回的 `message` 被 AI SDK 自动作为最后一段 assistant 消息流回。前端 `useChat` 拦截 `onToolCall`，识别 `escalateToHuman` 后：
- 在消息气泡下方渲染 QR 图（`<Image src={qrUrl} ... />`）
- `setHandoff(true)` 关闭输入框，显示"已转人工"提示

### 7.4 降级 fallback UI（三种触发统一）

| 触发 | HTTP | UI |
|---|---|---|
| 日 token 闸打顶 | 503 | 输入框置灰 + 气泡 + QR：`"客服暂时下班，请扫码加企微人工跟进。"` |
| 15s 超时 | 504 | 同上 |
| sessionId tokenBudget 耗尽（每日单 budget，砍续杯流程） | 423 | 同上 |
| 限流 | 429 | `"请稍后再试"` 简短提示，不切 QR |

**fallback 不生成 Lead**（避免数据库被打爆）。

---

## 8. Provider 配置 — DeepSeek 直连

### 8.1 接法（唯一）

DeepSeek API 是 OpenAI 兼容的 (`https://api.deepseek.com`)，用 AI SDK 的 `createOpenAI` 包一下即可：

```ts
import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { config } from "@/lib/config"

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: config.deepseekApiKey,   // env: DEEPSEEK_API_KEY (z.string().min(1), 必填)
})

const result = streamText({
  model: deepseek.chat("deepseek-chat"),   // V4 Flash, non-thinking
  // ...
})
```

- **prompt caching**: DeepSeek API 自家命中（system prompt 前缀稳定时自动），cache-hit $0.0028/M 自动生效；不需要客户端任何 `providerOptions` 干预
- **observability**: Vercel Functions logs + `experimental_telemetry: { isEnabled: true, functionId: "agent-cs-chat" }` 已足够
- **挂掉怎么办**: `AbortSignal.timeout(15_000)` + `onError` rollback 预扣 → 前端 504 fallback QR；不切别家 provider（MVP 单 provider 不值得引入 Gateway 跳）

### 8.2 为什么不用 Vercel AI Gateway（决策）

`2026-05-20` 改回直连。Gateway 在单 provider MVP 上给的"好处"对我们都不可操作：

| Gateway 卖点 | 实际收益 |
|---|---|
| 自动 provider fallback | 不需要——我们 cap $0.65/天，挂了走 QR 比切 provider 简单 |
| Observability dashboard | Vercel Functions logs + telemetry 已够 |
| Prompt caching 透传 | DeepSeek 自家 cache 自动命中，不需中间层 |
| 0 markup | 直连就是底价 |
| 多 provider 一个 key | 只用 DeepSeek 一家 |

直连净收益：少 1 个 env、少 1 跳、本地 = 预览 = 生产同路径。

### 8.3 单价与双闸数值

DeepSeek V4 Flash（2026-05 实际）：
- Cache-Miss Input $0.14/M
- Cached Input $0.0028/M
- Output $0.28/M
- 单轮对话 ~500 in + 300 out（system prompt 大量 cache hit）≈ **$0.00012/轮**

| 闸 | 阈值 | 最坏成本 |
|---|---|---|
| `DAILY_INPUT_CAP` | 3_000_000 cache-miss tokens | $0.42 |
| `DAILY_OUTPUT_CAP` | 800_000 tokens | $0.224 |
| 合计 | | **≈ $0.65/天** |

正常运营撑 ~5000 真实轮 / 天；被抖量到顶损失 $0.65。

---

## 9. 防滥用细节

### 9.1 Upstash Redis 限流（`lib/agent-rate-limit.ts`）

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

export const limiters = {
  chatIp:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20,  "1 m"), prefix: "agent:chat:ip" }),
  chatSession: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30,  "1 h"), prefix: "agent:chat:session" }),
  chatFp:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "1 d"), prefix: "agent:chat:fp" }),
  csReverse:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60,  "1 m"), prefix: "cs:reverse:ip" }),
}

export { redis }
```

### 9.2 配额预扣 / 补差 / 回滚（`lib/agent-anti-abuse.ts` 节选）

伪代码描述（实际实现使用 `@upstash/redis` 的 pipeline API；为避免硬编码方法名，下方用 `commitPipeline` 表示"运行 pipeline 并取所有返回值"的薄包装）：

```ts
import { redis } from "@/lib/agent-rate-limit"
import { config } from "@/lib/config"
import { prisma } from "@/lib/prisma"

async function commitPipeline<T extends unknown[]>(pipe: ReturnType<typeof redis.pipeline>) {
  return (await pipe["exec"]()) as T
}

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "")
}

export async function reserveTokens(
  sessionId: string,
  est: { input: number; output: number },
) {
  const day = todayKey()
  const pipe = redis.pipeline()
  pipe.incrby(`quota:day:in:${day}`,  est.input)
  pipe.incrby(`quota:day:out:${day}`, est.output)
  pipe.incrby(`session:${sessionId}:tokens`, est.input + est.output)
  const [dayIn, dayOut] = await commitPipeline<[number, number, number]>(pipe)

  if (dayIn > config.dailyInputCap || dayOut > config.dailyOutputCap) {
    await rollbackTokens(sessionId, est)
    return { ok: false as const, reason: "daily-cap" as const }
  }
  return { ok: true as const }
}

export async function commitUsage(
  sessionId: string,
  est: { input: number; output: number },
  actual: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
) {
  const realIn  = actual.promptTokens     ?? est.input
  const realOut = actual.completionTokens ?? est.output
  const diffIn  = realIn  - est.input
  const diffOut = realOut - est.output
  const day = todayKey()
  const pipe = redis.pipeline()
  if (diffIn  !== 0) pipe.incrby(`quota:day:in:${day}`,  diffIn)
  if (diffOut !== 0) pipe.incrby(`quota:day:out:${day}`, diffOut)
  pipe.incrby(`session:${sessionId}:tokens`, diffIn + diffOut)
  await commitPipeline(pipe)
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { tokensUsed: { increment: realIn + realOut } },
  })
}

export async function rollbackTokens(
  sessionId: string,
  est: { input: number; output: number },
) {
  const day = todayKey()
  const pipe = redis.pipeline()
  pipe.decrby(`quota:day:in:${day}`,  est.input)
  pipe.decrby(`quota:day:out:${day}`, est.output)
  pipe.decrby(`session:${sessionId}:tokens`, est.input + est.output)
  await commitPipeline(pipe)
}
```

实现时直接用 Upstash 文档里的 pipeline 调用方式（这里包了一层只是为了说明意图）。

### 9.3 Prompt 注入防御

- `applyAntiAbuse` 内手动检查 `messages.at(-1)` 的拼接文本长度 ≤ 4 KB（chat route 收到的是 `UIMessage[]`，Zod 不自动管单条 size）
- strip 已知 sentinel：`<|im_start|>` / `<|im_end|>` / `<|system|>` 等替换为空
- system prompt 由 `buildCSPrompt` 服务端构造，不接受客户端字段覆写
- tool schema 严格（Zod），agent 不能传任意结构
- `lookupOrder` 找不到时返回 `{ found: false }` — 永远固定文案，agent 据此生成"未找到该订单"，不区分原因

### 9.4 持久指纹

`fingerprintHash = SHA256(IP + UA).slice(0, 32)`（hex 截 32 字符 = 16 字节熵），存 `AgentSession.fingerprintHash`：
- 限流维度 `agent:chat:fp` 跨 sessionId 限制（同一来源刷 sessionId 仍受 200/day 上限）
- 不存原始 IP / UA（隐私友好 + 攻击者无法用泄漏数据反查）
- 不上 Canvas/WebGL 指纹（误报率高）

---

## 10. 前台 ChatWidget

> **代码片段范围说明**：§10.4-10.8 的 TSX 片段按 `@assistant-ui/react@0.14` 的设计意图组织，部分 API 形态（如 `useChatRuntime` 的回调签名、`ActionBarPrimitive.FeedbackPositive`、`composer.setText().send()` 链式、`useThread().append`）需要在实施时按 assistant-ui v0.14 实际 API 校准。这不影响整体设计；wrapper 隔离原则保证 API 微调只改 `chat-wrappers.tsx` 一个文件。

### 10.1 选型：assistant-ui

基于 2026-05 社区调研（YC W25 / 50k+ 月下载 / dev.to 全面评测排名第一）选 [`@assistant-ui/react`](https://www.assistant-ui.com)（MIT）作为 ChatWidget 的核心 UI 库。**它原生提供**：

- `Thread` / `Composer` 流式消息容器 + 自动滚动
- `Message` 渲染（含 markdown / 代码高亮）
- **`ActionBar`**：复制 / 重新生成 / 👍/👎 反馈 — **替代前一轮规划里 C7/C8/C9 必补项**
- **Tool call renderer**：折叠卡片样式 — **替代 C4 必补项**
- `ChainOfThought` 多步推理可视化（用不到也无碍）
- 键盘快捷键 / 无障碍 / 时间戳

**它没有的（仍需自写）**：悬浮按钮（项目既有 fab 改造）、欢迎语 + 建议问题 chips、"找人工"按钮、Fallback QR 视图。

**版本约束**：assistant-ui 仍在 0.x，约半年一次 breaking change（v0.11→v0.12→v0.14 都有 migration）。pin minor 版本：

```json
{
  "@assistant-ui/react":        "0.14.x",
  "@assistant-ui/react-ai-sdk": "0.14.x"
}
```

升级时按官方 migration guide，每次 0.5 天工时（年均 ~1 天维护成本）。

### 10.2 文件结构与"wrapper 隔离"原则

```
app/components/
├── customer-service-fab.tsx        (改造: popover 内容换为 ChatPanel)
└── agent-chat/
    ├── chat-panel.tsx              主面板, AssistantRuntimeProvider + Thread + Composer
    ├── chat-wrappers.tsx           本项目的 ChatBubble/Composer wrapper, 唯一直接 import assistant-ui 原语的文件
    ├── welcome-chips.tsx           开场欢迎语 + 建议问题 chips (B1+B2)
    ├── escalate-button.tsx         输入框右侧"找人工"按钮 (E1)
    ├── fallback-qr.tsx             降级 QR 视图 (503/504/423)
    └── handoff-card.tsx            escalate 后的 QR + 文案卡片 (E2 后)
```

**wrapper 隔离原则**：项目内其他文件**只 import `chat-wrappers.tsx`**，不直接 import `@assistant-ui/react`。assistant-ui v0.15 来时只改 `chat-wrappers.tsx` 一个文件即可完成迁移，不需要全项目搜索替换。

### 10.3 安装

```bash
# 主包 + AI SDK 适配器, pin minor
npm i @assistant-ui/react@0.14.x @assistant-ui/react-ai-sdk@0.14.x

# shadcn 风格主题 (CLI 拷贝, 与项目 shadcn New York 风格一致)
npx shadcn add "https://www.assistant-ui.com/registry/thread"
```

### 10.4 ChatPanel 主体

```tsx
"use client"
import { useEffect, useState } from "react"
import { ulid } from "ulid"
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react"
import { useChatRuntime } from "@assistant-ui/react-ai-sdk"
import { ChatBubble, ComposerBar } from "./chat-wrappers"
import { WelcomeChips } from "./welcome-chips"
import { FallbackQR } from "./fallback-qr"
import { HandoffCard } from "./handoff-card"

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
  const [fallback, setFallback] = useState<null | "daily-cap" | "timeout" | "budget">(null)

  // 首次打开 lazy 登记 session (BotID 在客户端持续无感校验)
  useEffect(() => {
    if (!sessionId) return
    fetch("/api/agent/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
  }, [sessionId])

  const runtime = useChatRuntime({
    api: "/api/agent/chat",
    body: { sessionId },
    onResponse: (res) => {
      if (res.status === 423) setFallback("budget")
      if (res.status === 503) setFallback("daily-cap")
      if (res.status === 504) setFallback("timeout")
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "escalateToHuman") setHandoff(true)
    },
  })

  if (fallback) return <FallbackQR reason={fallback} />
  if (handoff)  return <HandoffCard />

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full flex-col">
        <ThreadPrimitive.Empty>
          <WelcomeChips />
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Viewport autoScroll>
          <ThreadPrimitive.Messages components={{ Message: ChatBubble }} />
        </ThreadPrimitive.Viewport>
        <ComposerBar />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
```

### 10.5 `chat-wrappers.tsx`（项目唯一 import assistant-ui 原语的文件）

```tsx
"use client"
import {
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react"
import { Send, Square, Headset, Copy, ThumbsUp, ThumbsDown } from "lucide-react"
import { EscalateButton } from "./escalate-button"

export function ChatBubble() {
  return (
    <MessagePrimitive.Root className="group flex flex-col gap-1 py-2">
      <MessagePrimitive.Content
        components={{
          // 工具调用渲染为折叠卡片 (覆盖默认渲染)
          ToolCall: ({ toolName }) => (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              正在调用 <code>{toolName}</code>…
            </div>
          ),
        }}
      />
      {/* assistant 消息底部 ActionBar (复制 / 反馈) */}
      <MessagePrimitive.If assistant>
        <ActionBarPrimitive.Root className="flex gap-1 opacity-0 group-hover:opacity-100">
          <ActionBarPrimitive.Copy>
            <Copy className="size-3.5" />
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.FeedbackPositive
            onFeedback={(msgId) => recordFeedback(msgId, "up")}
          >
            <ThumbsUp className="size-3.5" />
          </ActionBarPrimitive.FeedbackPositive>
          <ActionBarPrimitive.FeedbackNegative
            onFeedback={(msgId) => recordFeedback(msgId, "down")}
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
        className="flex-1 resize-none bg-transparent outline-none"
        placeholder="输入您的问题…"
      />
      <EscalateButton />
      <ComposerPrimitive.Send className="rounded-full bg-primary p-2">
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
    // 前端发 "up"/"down" 语义友好, route 内映射到 MessageFeedback enum
    body: JSON.stringify({ messageId: msgId, value }),
  })
}

// route 端 (app/api/agent/message-feedback/route.ts):
//   const FB_MAP = { up: "POSITIVE", down: "NEGATIVE" } as const
//   await prisma.agentMessage.update({
//     where: { id: messageId },
//     data: { feedback: FB_MAP[value] },
//   })
```

注：v0.x API 可能在 v0.15+ 改名（如 `MessagePrimitive.If assistant` 可能换签名），届时只改这一个文件。

### 10.6 `welcome-chips.tsx`（B1 + B2）

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
            onClick={() => composer.setText(q).send()}
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

### 10.7 `escalate-button.tsx`（E1）

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

agent 收到"我想找人工客服"几乎一定调 `escalateToHuman` tool（system prompt 已写明触发规则）。

### 10.8 `customer-service-fab.tsx` 改造

保留 BTN / 拖拽 / 拉动画逻辑，把 `<PopoverContent>` 里 QR 视图换为：

```tsx
<PopoverContent
  side="top"
  align="end"
  className="h-[80vh] w-screen p-0 md:h-[600px] md:w-[380px]"
>
  <ChatPanel />
</PopoverContent>
```

`<FallbackQR>` 内部仍渲染原来的 QR + 微信号块（直接复用既有 `CopyButtonClient`），保证降级视觉与原 fab popover 一致。

---

## 11. Admin 后台

### 11.1 `/admin/(main)/agent/knowledge`

DataTable 四件套，遵循 `app/admin/(main)/announcements/` 模式：
- `knowledge-columns.tsx`：title / tags / 关联商品 / status / updatedAt
- `knowledge-data-table.tsx`：按 status / tag / productId 客户端过滤（MVP 数据量 < 100）
- `knowledge-row-actions.tsx`：编辑 / 发布·撤稿 / 归档（DropdownMenu + MoreHorizontal）
- `knowledge-form.tsx`：title + Markdown 编辑器（复用 `markdown-editor.tsx`）+ 多选 tags + 关联商品下拉
- `loading.tsx`：DataTable 骨架

状态机：DRAFT → PUBLISHED → ARCHIVED；只有 PUBLISHED 暴露给 `lookupKnowledge` tool。

**Runtime Cache + revalidateTag 模式**（与项目既有 announcements / products 缓存一致）：

```ts
// lib/agent-persistence.ts
import { cacheTag, cacheLife } from "next/cache"

export async function fetchPublishedKnowledge() {
  "use cache: remote"
  cacheTag("agent-knowledge")
  cacheLife({ expire: 3600 })  // 1 小时, 但 admin 改时立即失效
  return prisma.agentKnowledge.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, content: true, tags: true, productId: true },
  })
}

// app/api/admin/agent/knowledge/[id]/route.ts (PATCH)
import { revalidateTag } from "next/cache"

export async function PATCH(req, { params }) {
  await prisma.agentKnowledge.update({ where: { id: params.id }, data: {...} })
  revalidateTag("agent-knowledge")  // 立即失效, 下次 chat 拉到新数据
  return new Response(null, { status: 204 })
}
```

需要在 `next.config.ts` 启用 `cacheComponents: true`（项目可能已开，看一下）。

### 11.2 `/admin/(main)/agent/leads`

DataTable 四件套，服务端分页：
- 列：status / urgency / wechatId 截断 / orderNo / reason 前 40 字 / createdAt
- 筛选：status + urgency + 搜索（wechatId / orderNo）
- **默认列表只显示 `status ∈ { NEW, CONTACTED }`**（`PENDING_CONTACT` 在筛选里显式勾选才出来，避免主待办被微信号收集淹没）
- 详情页：conversationSnapshot 渲染（Markdown）+ "查看完整对话" 链接（跳到 `/admin/agent/conversations/[sessionId]`）+ 状态流转按钮 + notes 输入框
- 状态流转：
  - `PENDING_CONTACT` → `CONTACTED`（运营手动加完微信后标记）
  - `NEW` → `CONTACTED` → `RESOLVED` / `DROPPED`

### 11.3 `/admin/(main)/agent/conversations`

DataTable 四件套，服务端分页 + 关键词 ILIKE：
- 列：sessionId 前 8 位 / fingerprintHash 前 6 位 / 消息数 / tokensUsed / startedAt / `escalated` 标识 / 有无 Lead
- 筛选：日期范围 + 是否 escalated + 关键词（contentText ILIKE）
- API：`GET /api/admin/agent/conversations?q=...&from=...&to=...&escalated=true`
  - 先 `prisma.agentMessage.findMany({ where: { contentText: { contains: q, mode: "insensitive" } }, distinct: ["sessionId"] })` 拿命中 sessionId
  - 再 `prisma.agentSession.findMany({ where: { id: { in: ids }, ...其他筛选 }, include: { lead: true, _count: { messages: true } } })`
- 详情页：左侧消息时间线（按 role + parts 渲染；tool call 折叠展开），右侧 metadata + Lead 信息
- 只读，不提供"重新对话"或"编辑消息"

### 11.4 Vercel Observability

聊天 trace 自动出现在 Vercel Dashboard → Observability → AI。运营查"成本/延迟/错误率"看这里，不进 admin 后台。

---

## 12. 数据保留（仅数据卫生，无 PIPL 合规义务）

`/api/cron/agent-cleanup`（Vercel Cron daily 03:00 UTC）—— 防止 `AgentMessage` 表无限膨胀：

```ts
export async function GET() {
  const deleted = await prisma.agentSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return Response.json({ deleted: deleted.count })
}
```

Cascade 删 `AgentMessage` + `AgentLead`。

`expiresAt` = `startedAt + agentSessionTtlDays`（默认 90 天，env 可调）。

**不做** 用户自助删除接口、不做首次进入告知 banner。如未来法务环境变化或主动响应监管，可在 Phase 5 后补回（约 0.5 天工作量）。

---

## 13. 测试策略

### 13.1 Jest 单元 / 集成

- `lib/agent-rate-limit.ts` 四个 limiter（chatIp / chatSession / chatFp / csReverse）命中分支
- `lib/agent-anti-abuse.ts`：reserveTokens / commitUsage / rollbackTokens（mock Redis pipeline）
- `lib/business-hours.ts` 边界：工作时间内外、跨时区
- `lib/agent-cs.ts` 六个 tool 的 execute（mock Prisma）：
  - `lookupOrder` 找不到时返回固定 `{ found: false }`
  - `lookupKnowledge` 只返回 PUBLISHED
  - `collectWechat` 正则校验拒绝非法格式 + 写入 `status: PENDING_CONTACT` 而非 `NEW`
  - `escalateToHuman` 事务正确 + conversationSnapshot 拼好 + HIGH urgency 触发 webhook（mock fetch）+ 工作时间外文案动态拼接
- `/api/agent/chat` 路由（mock streamText）：
  - 预扣失败 → 503
  - 限流命中 → 429
  - tokenBudget 耗尽 → 423
  - 超时 → onError 触发 rollback
  - 正常 → onFinish 补差 + 持久化

### 13.2 Playwright E2E

- `e2e/agent-chat-happy.spec.ts`：首次打开 → 发消息 → 流式回复（BotID 后台无感通过）
- `e2e/agent-chat-budget.spec.ts`：tokenBudget 耗尽 → fallback QR
- `e2e/agent-escalate.spec.ts`：触发 escalate → 看到 QR + admin 后台出现 `status=NEW` Lead
- `e2e/agent-collect-wechat.spec.ts`：用户主动留微信 → admin 后台出现 `status=PENDING_CONTACT` Lead（默认不在主待办）
- `e2e/agent-fallback.spec.ts`：mock Redis 日额度打满 → fallback UI

### 13.3 手动验收

- Vercel Observability 看 trace / usage / cost
- DeepSeek API 不稳定模拟：临时把 `DEEPSEEK_API_KEY` 设无效，看是否触发 `onError` rollback + 504 fallback QR
- Redis 计数：手动 `INCRBY quota:day:in:{YYYYMMDD} 3000000` 触发 daily cap，浏览器看到 fallback UI

---

## 14. 实施分阶段

| Phase | 内容 | 工时估 |
|---|---|---|
| 1 | Marketplace 装 Upstash + Prisma migration（4 表，含 `AgentMessage.citations / feedback`）+ `lib/agent-rate-limit.ts` + `lib/agent-anti-abuse.ts` + `lib/business-hours.ts` + 单元测试 | 1 天 |
| 2 | BotID 接入 + `app/api/agent/chat` + `lib/agent-cs.ts`（6 个 tool，含 escalate webhook 推送 + 工作时间判断 + collectWechat 返 QR）+ `lib/agent-persistence.ts`（`use cache: remote` 包知识库 + citation 持久化） | 1.5 天 |
| 3 | 装 `@assistant-ui/react@0.14.x` + `chat-panel.tsx` + `chat-wrappers.tsx`（ChatBubble + ComposerBar）+ `welcome-chips.tsx` + `escalate-button.tsx` + `fallback-qr.tsx` + `handoff-card.tsx` + 改造 fab + `session/start` + `message-feedback` route | 0.75 天 |
| 4 | `/admin/(main)/agent/knowledge` DataTable + form + `revalidateTag("agent-knowledge")` | 0.75 天 |
| 5 | `/admin/(main)/agent/leads` + `/admin/(main)/agent/conversations`（ILIKE 替 FTS） | 1 天 |
| 6 | `/api/cron/agent-cleanup` + Vercel Cron 配置 + 手动验收（DeepSeek 调用 / Runtime Cache 命中率 / 工作时间外提示 / Bark 推送） | 0.5 天 |

**合计 ~5.5 天。无 VPS、无 Docker、无 nginx、无 Python。**

工时构成说明：

- assistant-ui 自带 ActionBar（复制 + 👍/👎）、tool call renderer、时间戳，**节省 0.5 天**自建
- 同时吸收 5 项必补（欢迎 chips / 找人工按钮 / 引用来源 / 反馈持久化 / escalate webhook）共 +0.5 天，**与节省互抵**
- assistant-ui v0.x migration 维护成本年均 +1 天，不计入首期 MVP

若进一步砍 `AgentMessage` 表 + `conversations` 页进入"极简 MVP"模式（**不推荐**，对话历史是产品闭环关键），可压到 ~4.5 天。

---

## 15. 已知风险与后续优化

| 风险 | 缓解 |
|---|---|
| Vercel Function 超时（默认 300s，本设计 15s） | useChat onResponse 检测 504 切 fallback；onError rollback 预扣 |
| DeepSeek API 不稳定 | 直连无自动 fallback；`AbortSignal.timeout(15s)` + `onError` rollback 预扣 → 504 fallback QR；如未来要切 provider 可在 chat route 加 try/catch 包第二个 createOpenAI（OpenRouter / SiliconFlow），但 MVP 不做 |
| Prompt cache 命中率不达预期 | 监控 Vercel Observability `cached_tokens` 比例；调整 system prompt 稳定性 |
| Lead 真实跟进效率 | MVP 已做 HIGH urgency Webhook 推送（Bark / 企微群机器人，see §7.2 + §16 `escalateWebhookUrl`）；MED / LOW urgency 仅在 admin 后台显示，运营定时查 |
| Knowledge 检索精度（pure ILIKE） | MVP 用 ILIKE + tag/product 过滤；v1.1 上 pgvector |
| FTS 中文分词（`simple` 配置） | MVP 接受 N-gram 退化；如有需要装 `zhparser` 扩展 |
| `RateLimiterMemory` 在订单接口仍在用 | 本设计仅替换 agent 路径；订单限流是另一个独立改进项 |
| `ai-distributor.ts` 用 SiliconFlow Qwen，本设计用 DeepSeek | 两个 agent 并存，不冲突；都走 `createOpenAI({ baseURL })` 直连模式，后续可统一抽 `lib/llm-providers.ts` |
| **Upstash Marketplace 装好后实际注入的 env 变量名不可预知** | Marketplace 装上后查 Vercel 项目设置 → Environment Variables 看真实变量名（可能是 `UPSTASH_REDIS_REST_URL` 或 `KV_REST_API_URL`）。`lib/config.ts` Zod schema 用 fallback 读取，部署时按实际值调整 |
| `cacheComponents` flag 与现有代码兼容性 | 启用前在分支上跑全量 build，确认 RSC 边界没破；如有冲突回退到 `unstable_cache` 模式 |
| **assistant-ui v0.x 半年一次 breaking change**（v0.11→v0.12→v0.14） | (1) package.json pin minor 版本 `0.14.x`；(2) 项目内只有 `chat-wrappers.tsx` 直接 import assistant-ui 原语，其他文件全部走 wrapper；升级时改这一个文件。预估年均 1 天维护成本 |
| escalate webhook 推送失败 | fire-and-forget，不阻塞主流程；推送失败时 Lead 仍生成，admin 后台可查；超出 MVP 范围不做 retry |
| 工作时间窗口写死 | `lib/business-hours.ts` 暴露 `isInBusinessHours()`，时区 `Asia/Shanghai` 9-22；后续可改为读 Edge Config 热更新 |

---

## 16. 配置项清单（`lib/config.ts` 新增）

```typescript
// 客服 agent
agentChatTimeoutMs:     z.coerce.number().int().positive().default(15_000),
agentSessionTtlDays:    z.coerce.number().int().positive().default(90),
agentTokenBudget:       z.coerce.number().int().positive().default(2000),  // 单日预算, 砍续杯
dailyInputCap:          z.coerce.number().int().positive().default(3_000_000),
dailyOutputCap:         z.coerce.number().int().positive().default(800_000),
wechatQrUrl:            z.string().url(),
wechatId:               z.string(),

// 人工兜底通知 (HIGH urgency 触发)
escalateWebhookUrl:     z.string().url().optional(),  // Bark / 企微群机器人 / Slack incoming webhook
businessHoursStart:     z.coerce.number().int().min(0).max(23).default(9),
businessHoursEnd:       z.coerce.number().int().min(0).max(23).default(22),
businessHoursTimezone:  z.string().default("Asia/Shanghai"),

// 基础设施 — Upstash Marketplace 注入的变量名不固定, fallback 解析
// 实际可能是 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// 也可能是 KV_REST_API_URL / KV_REST_API_TOKEN (历史命名)
// 部署后看 Vercel 项目设置中的实际值
upstashRedisRestUrl: z.string().url().default(
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? ""
),
upstashRedisRestToken: z.string().default(
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ""
),

// Provider
// DeepSeek API key — 必填. OpenAI 兼容 API 直连 https://api.deepseek.com
deepseekApiKey:         z.string().min(1),

// Cron 鉴权 (Vercel Cron 标准 Bearer 校验)
cronSecret:             z.string().min(16),
```

`.env.example` 同步添加上述变量样例。在 `lib/agent-rate-limit.ts` 中 `Redis.fromEnv()` 仍可直接用 — Upstash SDK 内部已支持上述两种命名，无需 wrapper。
