# Hermes Customer Service Agent Design

**Date:** 2026-05-19
**Status:** Superseded by [2026-05-19-customer-service-agent-design.md](./2026-05-19-customer-service-agent-design.md)
**Why superseded:** 在最终设计里 Hermes 只剩"对话审计 dashboard"一个独家价值，其他能力都被 Vercel AI SDK + Gateway 等价覆盖。Hermes 引入的运维代价（VPS / Docker / nginx / Python plugin / HMAC 跨网络鉴权）超过收益。保留本文件作为方案演化的参考。
**Scope:** 把 Hermes Agent（Nous Research 2026-02 发布的开源 self-hosted agent）接入 account-mall 作为前台客服，覆盖匿名访客咨询、平台数据问答、admin 监督式知识录入、企微人工兜底、防滥用边界。

---

## 1. 目标与非目标

### 目标

1. 前台访客可通过悬浮聊天 widget 与 agent 实时对话（流式）
2. Agent 基于平台数据回答商品 / 公告 / 订单状态类问题
3. Admin 通过后台录入知识库条目（FAQ / 商品话术 / 避雷规则）
4. Agent 主动收集用户微信号并在必要时升级人工，生成"咨询单"供 admin 跟进
5. 在脚本恶意调用 / 抖量场景下，每日最大损失 ≤ $1，超额自动降级为 QR 兜底
6. 对话审计、模型降级、自学习能力借用 Hermes 生态，非必要不重复造轮子

### 非目标 (MVP 外)

- 客服在企微里直接与 C 端访客对话（Hermes WeCom gateway 是 admin 与 agent 的通道，不是 C 端转接）
- pgvector 语义检索（embedding 字段预留）
- GEPA 自学习（默认关，v1.1 评估后再开）
- HA / 双 Hermes 实例
- agent 主动多语言（先做中文，英文走默认 prompt 即可）

---

## 2. 关键决策（brainstorm 落定）

| # | 维度 | 决策 |
|---|---|---|
| D1 | Hermes 部署位置 | 用户自有 VPS，Docker，nginx 反代 |
| D2 | 访问门槛 | 匿名可聊 + Turnstile + 多键限流 + 会话 tokenBudget |
| D3 | 预算护栏行为 | 日 token 闸到顶 → 聊天接口直接返回 fallback UI（QR + 临时下班文案），不降级模型 |
| D4 | 人工兜底交付 | 返回企微 QR + admin 后台生成 Lead 含 conversationSnapshot |
| D5 | 知识对接路径 | Hermes plugin HTTP 回调 account-mall `/api/cs/*` |
| D6 | 微信号收集 | MVP 保留，附 PIPL 三件套（告知 + 90 天保留 + 用户自助删除） |
| D7 | 自学习方式 | admin 后台结构化 CRUD（AgentKnowledge 表），关 Hermes GEPA |
| D8 | `/api/cs/*` 可见性 | 改为仅 Hermes 可访（HMAC + IP allowlist + 限流），原"public read-only"作废 |
| D9 | 对话完整审计 | 复用 Hermes Dashboard FTS5，account-mall 不存 message 详情 |
| D10 | 静态话术 vs 动态知识库 | 全走 AgentKnowledge + `lookup_knowledge` tool |
| D11 | 模型 | DeepSeek V4 Flash (`deepseek-chat`)，non-thinking 模式 |
| D12 | sessionId 生成 | 客户端 ULID |

---

## 3. 非协商前提（reviewer 必改清单）

1. **限流存储必须分布式**：`lib/rate-limit.ts` 现有 `RateLimiterMemory` 在 Vercel 多实例下不可靠。Agent 相关路径全部走 Upstash Redis（`@upstash/ratelimit` Sliding Window）。日 token 闸用 Redis 原子计数。
2. **`checkAiChatRateLimit(userId)` 不适用**：现有函数 key 写死 `ai-chat:${userId}`，对匿名访客失效。Agent 路径不复用该函数，独立实现。
3. **会话 token 预算证明**：每 sessionId 在 Redis 领取 1000 token 初始预算，用完必须重过 Turnstile 续杯（防 sessionId 刷新规避）
4. **Token 计量按 LLM `usage` 字段**：input + output 分别按 token 计，非按消息条数；调用前按 tiktoken 估算预扣，调用后补差
5. **`/api/cs/*` 加 HMAC-SHA256 + timestamp**：60s 防重放窗口，timing-safe 比较；所有反向调用 60/min/IP 限流
6. **Hermes VPS 前置 nginx + Vercel 出口 CIDR allowlist**：非白名单 IP 直接 444（静默关闭），shared secret 作为第二道防线
7. **PIPL 三件套**：聊天界面首次打开必显示告知 + 90 天 cron 自动删 + 用户自助删除接口
8. **GEPA 默认关**：Hermes `config.yaml` 设 `evolution.enabled: false`；session 内 memory 保留以确保会话连贯
9. **Hermes 调用超时 8-10s**：`AbortController` 控制，超时与日额度打满共用同一 fallback UI
10. **`/api/agent/chat` 预扣原子化**：`INCRBY` 单步骤完成"检查 + 扣费"，防 race；失败回滚 `DECRBY`

---

## 4. 架构总图

```
┌──────────────────────┐
│ 浏览器 ChatWidget    │
│ (替换 fab popover)   │
└──────┬───────────────┘
       │ same-origin · sessionId in cookie
       ▼
┌─────────────────────────────────────────────────┐
│ Vercel · account-mall                           │
│                                                 │
│ POST /api/agent/session/start  (Turnstile)      │
│ POST /api/agent/session/topup  (Turnstile 续杯) │
│ POST /api/agent/notice-acknowledged              │
│ POST /api/agent/chat  (SSE 流式主接口)           │
│ POST /api/agent/me/delete  (用户自助)            │
│                                                 │
│ GET  /api/cs/products  ← Hermes plugin 回调      │
│ GET  /api/cs/announcements                       │
│ GET  /api/cs/order-lookup                        │
│ GET  /api/cs/knowledge                           │
│ POST /api/cs/collect-wechat                      │
│ POST /api/cs/escalate                            │
│                                                 │
│ /admin/(main)/agent/leads                        │
│ /admin/(main)/agent/knowledge                    │
│                                                 │
│ GET /api/cron/agent-cleanup  (Vercel Cron 日跑) │
└─────────────────────┬───────────────────────────┘
                      │ Vercel 出口 CIDR + HMAC
                      ▼
┌─────────────────────────────────────────────────┐
│ VPS · Hermes Agent (Docker)                     │
│  nginx :443 → 127.0.0.1:8000                    │
│    (Vercel CIDR allowlist + X-Hermes-Secret)    │
│  Hermes /v1/chat/completions                    │
│    model: deepseek-chat                          │
│    fallback_providers (Hermes 自带)              │
│    evolution.enabled: false                      │
│  Plugins: ~/.hermes/plugins/account_mall/        │
│    tools: lookup_product / lookup_order /        │
│           get_announcements / lookup_knowledge / │
│           collect_wechat / escalate_to_human     │
│  SQLite: session/memory                          │
│  hermes dashboard :9119 (运营 SSH 隧道访问)      │
└─────────────────────────────────────────────────┘
```

**安全边界**：

- 浏览器永远只看到 account-mall 域名，看不到 Hermes
- Hermes 不连数据库、不持业务凭据；所有业务真相通过 `/api/cs/*` 回流
- Hermes 暴露面仅信任 Vercel 出口 CIDR + HMAC，nginx 拒绝其他流量

---

## 5. 数据模型（Prisma）

```prisma
model AgentSession {
  id                      String   @id          // 客户端 ULID, 同 Hermes X-Hermes-Session-Id
  fingerprintHash         String                // SHA256(IP + UA) 前 16 字节, 不可逆
  startedAt               DateTime @default(now())
  endedAt                 DateTime?
  tokenBudget             Int      @default(1000)
  tokensUsed              Int      @default(0)
  escalated               Boolean  @default(false)
  piplNoticeAcknowledged  Boolean  @default(false)
  expiresAt               DateTime              // startedAt + 90 days
  lead                    AgentLead?
  @@index([expiresAt])
}

model AgentLead {
  id                   String       @id @default(cuid())
  sessionId            String       @unique
  session              AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  wechatId             String?
  orderNo              String?
  reason               String                   // agent 给的 escalate 原因
  urgency              LeadUrgency  @default(MED)
  status               LeadStatus   @default(NEW)
  contactedBy          String?
  contactedAt          DateTime?
  notes                String?      @db.Text
  conversationSnapshot Json                     // 最近 20 条 message 快照
  hermesSessionUrl     String                   // Hermes Dashboard 会话链接
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
  @@index([status, createdAt])
}

enum LeadStatus  { NEW CONTACTED RESOLVED DROPPED }
enum LeadUrgency { LOW MED HIGH }

model AgentKnowledge {
  id          String           @id @default(cuid())
  title       String
  content     String           @db.Text         // Markdown
  tags        String[]
  productId   String?
  product     Product?         @relation(fields: [productId], references: [id])
  status      KnowledgeStatus  @default(DRAFT)
  authorId    String
  author      User             @relation(fields: [authorId], references: [id])
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  publishedAt DateTime?
  embedding   Float[]?                          // 预留, MVP 不用
  @@index([status, productId])
  @@index([tags])
}

enum KnowledgeStatus { DRAFT PUBLISHED ARCHIVED }
```

**设计要点**：

- 不存 `AgentMessage` 详情表（对话审计走 Hermes Dashboard FTS5）
- Lead 触发时在 `conversationSnapshot` 留对话快照，防 Hermes 数据丢失
- `expiresAt` 由 cron 扫描自动删，cascade Lead；用户自助删除走同一删除路径

---

## 6. 接口清单

### 6.1 浏览器 → Vercel

| 接口 | 方法 | 鉴权 | 用途 |
|---|---|---|---|
| `/api/agent/session/start` | POST | Turnstile token | 服务端登记 `AgentSession`（id 客户端已生成），写 cookie |
| `/api/agent/session/topup` | POST | Turnstile token + sessionId | `tokenBudget += 1000` |
| `/api/agent/notice-acknowledged` | POST | sessionId | 写 `piplNoticeAcknowledged = true` |
| `/api/agent/chat` | POST (SSE) | sessionId | 流式对话主接口 |
| `/api/agent/me/delete` | POST | sessionId | 删除该 session 全部数据（含 Lead） |

### 6.2 Hermes plugin → Vercel（反向回调）

所有接口共享：
- `X-Hermes-Timestamp` (Unix sec, 60s 窗口)
- `X-Hermes-Signature: hex(HMAC-SHA256(secret, method + "\n" + path + "\n" + ts + "\n" + body))`
- nginx 已校验 IP CIDR + `X-Hermes-Secret`，Vercel 端再校 HMAC（双层）
- 60/min/IP Upstash 限流

| 接口 | 方法 | tool 名 | 返回脱敏字段 |
|---|---|---|---|
| `/api/cs/products` | GET | `lookup_product` | name, summary, price, productType, tags, inStock |
| `/api/cs/announcements` | GET | `get_announcements` | title, content, audience(已过滤 CUSTOMER/ALL) |
| `/api/cs/order-lookup` | GET | `lookup_order` | status, totalAmount, productName, paidAt（**不返回卡密内容**） |
| `/api/cs/knowledge` | GET | `lookup_knowledge` | top 5: id, title, contentExcerpt(200 字), tags |
| `/api/cs/collect-wechat` | POST | `collect_wechat` | { ok } — 写 `AgentLead.wechatId`，正则校验 `^[a-zA-Z][a-zA-Z0-9_-]{5,19}$` |
| `/api/cs/escalate` | POST | `escalate_to_human` | { qrUrl, leadId } — upsert Lead 为 NEW |

---

## 7. 关键数据流

### 7.1 `/api/agent/chat` 主流程（含 token 预扣）

```
浏览器 POST { sessionId, message, turnstileToken? }
   ↓
┌─ Step 1: 校验 ─────────────────────────────────────────┐
│ ① AgentSession 存在 + expiresAt 未过 + acknowledged    │
│ ② tokensUsed >= tokenBudget → 423 Locked              │
│    （前端弹"额度用完, 验证续杯" → topup）              │
│ ③ message 长度 > 4 KB → 400                            │
│ ④ Upstash 限流 (单次校验三键)：                        │
│    agent:chat:ip:{ip}        20/min                    │
│    agent:chat:session:{id}   30/hour                   │
│    agent:chat:fp:{hash}      200/day                   │
└────────────────────────────────────────────────────────┘
   ↓
┌─ Step 2: 配额预扣 (Redis MULTI) ───────────────────────┐
│ estimatedIn  = tiktoken(userMsg) + 500   // system prompt 估值│
│ estimatedOut = 500                                    │
│                                                       │
│ MULTI                                                 │
│   INCRBY quota:day:in:{YYYYMMDD}  estimatedIn         │
│   INCRBY quota:day:out:{YYYYMMDD} estimatedOut        │
│   INCRBY session:{id}:tokens (estimatedIn+estimatedOut)│
│ EXEC                                                  │
│                                                       │
│ if dayIn > DAILY_INPUT_CAP                            │
│  or dayOut > DAILY_OUTPUT_CAP                         │
│  or sessionUsed > tokenBudget:                        │
│   DECRBY 全部回滚                                      │
│   return fallback (QR + "客服下班")                    │
└────────────────────────────────────────────────────────┘
   ↓
┌─ Step 3: 转发 Hermes ──────────────────────────────────┐
│ fetch(HERMES_URL + '/v1/chat/completions', {           │
│   headers: { X-Hermes-Session-Id: sessionId,           │
│              X-Hermes-Secret, X-Hermes-Timestamp,      │
│              X-Hermes-Signature },                     │
│   body: { stream: true, messages: [...] },             │
│   signal: AbortSignal.timeout(10_000)                  │
│ })                                                     │
│                                                        │
│ AbortError / 5xx → DECRBY 回滚 + fallback UI           │
└────────────────────────────────────────────────────────┘
   ↓
┌─ Step 4: SSE 流式 + 补差扣 ────────────────────────────┐
│ for chunk of hermesStream:                             │
│   if chunk.usage:                                      │
│     diffIn  = chunk.usage.prompt_tokens - estimatedIn │
│     diffOut = chunk.usage.completion_tokens - estimatedOut│
│     INCRBY quota:day:in:{YYYYMMDD}  diffIn             │
│     INCRBY quota:day:out:{YYYYMMDD} diffOut            │
│     INCRBY session:{id}:tokens     (diffIn+diffOut)    │
│     UPDATE AgentSession SET tokensUsed = ...           │
│   enqueue(chunk) → 浏览器                              │
└────────────────────────────────────────────────────────┘
```

### 7.2 Escalate 流程

```
agent 检测触发条件 → 调 escalate_to_human(reason, urgency)
   ↓
Hermes plugin: POST /api/cs/escalate
   { sessionId, reason, urgency,
     conversationSnapshot: 最近 20 条 }
   ↓
Vercel: upsert AgentLead {
   sessionId, reason, urgency,
   status: NEW,
   conversationSnapshot,
   hermesSessionUrl: `${HERMES_DASHBOARD_URL}/sessions/${sessionId}`,
   wechatId: 此前 collect_wechat 过则带
}
   UPDATE AgentSession SET escalated = true
   ↓
tool 返回 { qrUrl: WECHAT_QR_URL, leadId, message: "..." }
   ↓
Hermes 把 message 拼进 final SSE chunk
   ↓
浏览器渲染 message + QR + 关闭输入框
```

**Agent system prompt 内的触发规则**（Hermes plugin 注册时塞进 system prompt）：
- 用户明确要求"找人工/客服/真人/转人工"
- 涉及退款 / 投诉 / 卡密失效 / 支付争议
- 连续 2 轮表达不满或沮丧情绪
- 用户主动提供微信号时先 `collect_wechat`，再视情况 escalate

### 7.3 降级 fallback UI（三种触发统一）

| 触发 | UI |
|---|---|
| 日 token 闸打顶 | 关闭输入框，气泡 + QR：`"客服暂时下班，请扫码加企微人工跟进，订单号 / 微信号可直接发给客服。"` |
| Hermes 10s 超时 / 5xx | 同上 |
| sessionId tokenBudget 耗尽且用户拒绝续杯 | 同上 |

**不在 fallback 中生成 Lead**（避免被打爆时数据库也被打爆）。

---

## 8. Hermes 部署 / 配置

### 8.1 VPS 拓扑

```
Internet
   ↓
nginx :443 (TLS + Vercel CIDR allowlist + X-Hermes-Secret 校验)
   ↓
127.0.0.1:8000 (Hermes HTTP gateway)
   ↓
deepseek API (主)
   ↓ fallback
openrouter API (备)

127.0.0.1:9119 (Hermes Dashboard, 仅 SSH 隧道访问)
```

### 8.2 `~/.hermes/config.yaml`

```yaml
model:
  provider: deepseek
  name: deepseek-chat                  # V4 Flash, non-thinking
  temperature: 0.3
  max_tokens: 800

fallback_providers:
  - provider: deepseek
    name: deepseek-chat
    credential_pool:
      strategy: round_robin
      keys: [${DEEPSEEK_KEY_1}, ${DEEPSEEK_KEY_2}]
  - provider: openai_compatible
    base_url: https://openrouter.ai/api/v1
    name: deepseek/deepseek-v4-flash
    api_key: ${OPENROUTER_KEY}

api_max_retries: 3

evolution:
  enabled: false                       # 关 GEPA

gateway:
  http:
    enabled: true
    host: 127.0.0.1
    port: 8000

skills:
  enabled: true                        # 仅 bundled + account_mall plugin
  external_dirs: []
```

### 8.3 nginx 关键配置

```nginx
# /etc/nginx/vercel-cidr.conf 由 cron 每日刷新
# scripts/refresh-vercel-cidr.sh: curl Vercel CIDR API → 转 nginx geo 格式 → reload

geo $vercel_allowed {
    default 0;
    include /etc/nginx/vercel-cidr.conf;
}

server {
    listen 443 ssl http2;
    server_name hermes.account-mall.example;
    ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    if ($vercel_allowed = 0) { return 444; }

    location /v1/ {
        if ($http_x_hermes_secret != "${HERMES_SECRET}") { return 444; }
        proxy_pass http://127.0.0.1:8000;
        proxy_buffering off;             # SSE 流式
        proxy_read_timeout 30s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / { return 444; }
}
```

### 8.4 Hermes plugin 包结构

```
~/.hermes/plugins/account_mall/
├── plugin.toml                  # manifest
├── tools.py                     # 6 个 tool 实现
├── hmac_client.py               # HMAC 签名
└── system_prompt.md             # agent 行为准则
```

每个 tool 都是 `httpx.AsyncClient` 调 `${ACCOUNT_MALL_URL}/api/cs/*`，带签名。错误时返回 `{ "error": "..." }`，agent 自然降级到"暂时查不到，建议扫码联系"。

---

## 9. 防滥用细节

### 9.1 Upstash Redis 限流（替代 `RateLimiterMemory`）

新增 `lib/agent-rate-limit.ts`（不动既有 `lib/rate-limit.ts`，避免改既有订单逻辑）：

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

export const limiters = {
  chatIp:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20,  "1 m") }),
  chatSession: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30,  "1 h") }),
  chatFp:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "1 d") }),
  topupIp:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   "1 h") }),
  csReverse:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60,  "1 m") }),
}
```

新增 env：`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、`HERMES_SECRET`、`HERMES_URL`、`DAILY_INPUT_CAP`、`DAILY_OUTPUT_CAP`、`AGENT_SESSION_TTL_DAYS`、`WECHAT_QR_URL`。全部进 `lib/config.ts` Zod schema。

### 9.2 HMAC 实现

`lib/hmac.ts`：

```ts
import crypto from "node:crypto"

const WINDOW_SEC = 60

export function sign(method: string, path: string, body: string, ts: number, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${method}\n${path}\n${ts}\n${body}`)
    .digest("hex")
}

export function verify(req: Request, body: string, secret: string): boolean {
  const tsStr = req.headers.get("x-hermes-timestamp")
  const sigGiven = req.headers.get("x-hermes-signature")
  if (!tsStr || !sigGiven) return false
  const ts = parseInt(tsStr, 10)
  if (Math.abs(Date.now() / 1000 - ts) > WINDOW_SEC) return false
  const expected = sign(req.method, new URL(req.url).pathname, body, ts, secret)
  return crypto.timingSafeEqual(Buffer.from(sigGiven), Buffer.from(expected))
}
```

Python plugin 端同算法（`hmac.new(secret, f"{method}\n{path}\n{ts}\n{body}".encode(), hashlib.sha256).hexdigest()`）。

### 9.3 Prompt 注入防御

- 用户消息固定 4 KB 上限（Zod schema 强约束）
- 服务端 strip 已知 sentinel：`<|im_start|>`、`<|im_end|>`、`<system>`（黑名单替换为空）
- system prompt 由 Hermes 端固定，不接受客户端覆写
- tool schema 严格，仅 6 个 tool；`lookup_order` 必须传 orderNo，无 "list all" 操作
- `lookup_order` 找不到时返回固定文案"未找到订单"，不区分"不存在 vs 不匹配"

### 9.4 sessionId 持久指纹替代方案

`fingerprintHash = SHA256(IP + UA).slice(0, 32)`，存 `AgentSession.fingerprintHash`。
- 不存原始 IP / UA（PIPL 友好）
- 限流维度可按 fingerprintHash（同一来源跨 sessionId 仍受限）
- Canvas/WebGL 指纹不上（Safari ITP/Firefox RFP 误报率高）

攻击者刷 sessionId 仍受 `agent:chat:fp:{hash}` 200/day 上限制约；fingerprintHash 变更需更换 IP+UA。

---

## 10. Admin 后台

### 10.1 `/admin/(main)/agent/knowledge`

DataTable 四件套，遵循 `app/admin/(main)/announcements/` 模式：

- `knowledge-columns.tsx`：title / tags / 关联商品 / status / updatedAt
- `knowledge-data-table.tsx`：按 status / tag / productId 客户端过滤（数据量 < 100，无需分页）
- `knowledge-row-actions.tsx`：编辑 / 发布·撤稿 / 归档
- `knowledge-form.tsx`：title + Markdown 编辑器（复用 `markdown-editor.tsx`）+ 多选 tags + 关联商品下拉
- `loading.tsx`：DataTable 骨架

状态机：DRAFT → PUBLISHED → ARCHIVED；只有 PUBLISHED 暴露给 `/api/cs/knowledge`。

### 10.2 `/admin/(main)/agent/leads`

DataTable 四件套，服务端分页：

- 列：status / urgency / wechatId 截断 / orderNo / reason 前 40 字 / createdAt
- 状态过滤 + urgency 过滤 + 搜索（wechatId / orderNo）
- 详情页：conversationSnapshot 渲染（Markdown）+ "[在 Hermes Dashboard 查看完整]" 链接 + 状态流转按钮 + notes 输入框
- 状态流转：NEW → CONTACTED → RESOLVED / DROPPED，按钮触发 PATCH `/api/admin/agent/leads/[id]`

### 10.3 Hermes Dashboard 接入

- Hermes Dashboard 跑在 VPS 127.0.0.1:9119
- admin 通过 `ssh -L 9119:127.0.0.1:9119 user@vps` 建立隧道
- account-mall admin 在 `/admin/(main)/agent/leads` 详情页提供 `http://localhost:9119/sessions/{sessionId}` 链接
- 仅访问者本地浏览器可打开（其他人 SSH 不通 → 链接不可用）

---

## 11. PIPL 合规

### 11.1 告知

ChatWidget 首次打开时插入一条系统气泡：

> 本对话由 AI 客服处理，必要时会升级人工。包括微信号在内的对话内容将存储 90 天用于服务质量。点击"我知晓"开始对话。

按钮 POST `/api/agent/notice-acknowledged` → `piplNoticeAcknowledged = true`。未点不发消息。

### 11.2 90 天自动删

`/api/cron/agent-cleanup`（Vercel Cron daily 03:00 UTC）：

```ts
await prisma.agentSession.deleteMany({
  where: { expiresAt: { lt: new Date() } }
})
// Cascade 删 AgentLead
```

### 11.3 用户自助删除

ChatWidget 右上角"⋯ 删除我的对话"按钮 → POST `/api/agent/me/delete`：

```ts
const session = await prisma.agentSession.findUnique({ where: { id: sessionId }})
if (!session) return notFound()
await prisma.agentSession.delete({ where: { id: sessionId }})
// 不调 Hermes 删它的 SQLite — Hermes 端 90 天后自然过期
clearCookie("agent_session")
```

---

## 12. 测试策略

### 12.1 Jest 单元 / 集成

- `lib/hmac.ts` 签名 + 校验 + timing-safe + 60s 窗口边界
- `lib/agent-rate-limit.ts` 五个 limiter 命中分支
- `/api/cs/escalate`：Zod 校验、HMAC 拒绝伪造、Lead upsert 幂等性
- `/api/cs/order-lookup`：脱敏（不返回卡密）、找不到时固定文案
- `/api/agent/chat`：tokenBudget 预扣 / 补差 / 失败回滚（mock Hermes 返回成功 / 超时 / 5xx）
- `/api/agent/me/delete`：仅删自己 sessionId

### 12.2 Playwright E2E

- `e2e/agent-chat-happy.spec.ts`：首次打开 → PIPL 告知 → 我知晓 → 发消息 → 流式回复
- `e2e/agent-chat-budget.spec.ts`：tokenBudget 耗尽 → 续杯 Turnstile
- `e2e/agent-escalate.spec.ts`：触发 escalate → 看到 QR + admin 后台出现 Lead
- `e2e/agent-fallback.spec.ts`：mock Redis 日额度打满 → fallback UI
- `e2e/agent-delete.spec.ts`：主动删除 → DB 查不到

### 12.3 手动验收（VPS 部署后）

- nginx 非 Vercel CIDR 访问返回 444
- HMAC 伪造（改 timestamp / body）返回 401
- Hermes Dashboard 仅 SSH 隧道可访
- DeepSeek API 故意 mock 429 → 看 Hermes 自动切 OpenRouter
- Hermes 容器停 → 浏览器看 fallback UI

---

## 13. 实施分阶段

按依赖顺序，建议分 5 阶段：

1. **Phase 1：基础设施 + 数据模型**（~1 天）
   - 新增 3 张表 migration
   - `lib/agent-rate-limit.ts` + Upstash 接入 + env 校验
   - `lib/hmac.ts` 单元测试

2. **Phase 2：`/api/cs/*` 反向接口 + Hermes plugin**（~2 天）
   - 既有 products / announcements 加 HMAC
   - 新增 order-lookup / knowledge / collect-wechat / escalate
   - Python plugin 6 个 tool

3. **Phase 3：`/api/agent/*` 前台接口**（~2 天）
   - session/start, topup, chat (SSE), notice, me/delete
   - 预扣 / 补差 / 回滚算法

4. **Phase 4：前台 ChatWidget + admin 后台**（~3 天）
   - ChatWidget 替换 fab popover
   - `/admin/agent/knowledge` DataTable 四件套
   - `/admin/agent/leads` DataTable 四件套

5. **Phase 5：VPS 部署 + 验收**（~1 天）
   - Docker Compose / docker run Hermes
   - nginx 配置 + Vercel CIDR cron
   - 端到端走通 + Playwright

---

## 14. 已知风险与后续优化

| 风险 | 缓解 |
|---|---|
| Hermes VPS 单点故障 | UptimeRobot 监控；Vercel 端检测到 5xx/超时即降级 fallback UI；MVP 不上 HA |
| DeepSeek API 不稳定 | Hermes 内置 `fallback_providers` 切 OpenRouter |
| Prompt cache 命中率不达预期 | 监控 `prompt_tokens_details.cached_tokens` 指标，调整 system prompt 稳定性 |
| Lead 真实跟进效率 | MVP 不做 Webhook 推送；后续可加 Bark / 企微群机器人 |
| Knowledge 检索精度 | MVP 用 PG ts_rank + tag/product 过滤；v1.1 上 pgvector |
| `RateLimiterMemory` 在订单接口仍在用 | 本设计仅替换 agent 路径；订单限流是另一个独立改进项 |

---

## 15. 配置项清单（`lib/config.ts` 新增）

```typescript
HERMES_URL:            z.string().url(),
HERMES_SECRET:         z.string().min(32),
HERMES_DASHBOARD_URL:  z.string().url().default("http://127.0.0.1:9119"),
WECHAT_QR_URL:         z.string().url(),
WECHAT_ID:             z.string(),
UPSTASH_REDIS_REST_URL:    z.string().url(),
UPSTASH_REDIS_REST_TOKEN:  z.string(),
DAILY_INPUT_CAP:       z.coerce.number().int().positive().default(3_000_000),
DAILY_OUTPUT_CAP:      z.coerce.number().int().positive().default(800_000),
AGENT_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(90),
AGENT_TOKEN_BUDGET_INIT: z.coerce.number().int().positive().default(1000),
AGENT_TOKEN_BUDGET_TOPUP: z.coerce.number().int().positive().default(1000),
AGENT_HERMES_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
```
