# No-Email Distributor Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin and distributors to generate a one-time invite link (no email required) so that invitees without an email address can register using a username + password.

**Architecture:** The existing email-based invite flow is kept unchanged. A parallel no-email path is added: inviter generates a link (no email input needed) → invitee clicks link → registers with username + password. better-auth `username` plugin handles username-based login on the server side; the distributor login page auto-detects email vs username from the input.

**Tech Stack:** Prisma 6 (schema migration), better-auth `username` plugin, Zod (new schema), Next.js API routes, React + shadcn/ui (Dialog, Button, Input, Form)

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `User.email` nullable, add `User.username`, `DistributorInvitation.email` nullable |
| `lib/auth.ts` | Add `username()` plugin |
| `lib/auth-client.ts` | Add `usernameClient()` plugin |
| `lib/validations/distributor-invite.ts` | Export `usernameSchema`, `acceptNoEmailInviteSchema` |
| `lib/create-no-email-invite-link.ts` | New: creates no-email DistributorInvitation, returns link |
| `app/api/distributor/invite/route.ts` | Add no-email branch (body without email) |
| `app/api/admin/distributors/invite/route.ts` | Add no-email branch |
| `app/api/distributor/accept-invite/route.ts` | Handle `invitation.email === null` |
| `app/distributor/accept-invite/accept-invite-form.tsx` | Conditionally render username vs email form |
| `app/distributor/accept-invite/page.tsx` | Pass `email: string \| null` to form |
| `app/admin/(main)/distributors/invite-distributor-button-client.tsx` | Two buttons: email + link |
| `app/admin/(main)/distributors/invite-distributor-dialog.tsx` | Unchanged (email invite only) |
| `app/admin/(main)/distributors/generate-link-dialog.tsx` | New: display generated link |
| `app/distributor/(main)/invite-sub-distributor-button.tsx` | Two buttons: email + link |
| `app/distributor/(main)/generate-invite-link-dialog.tsx` | New: display generated link |
| `app/distributor/login/page.tsx` | Auto-detect email vs username |
| `__tests__/lib/create-no-email-invite-link.test.ts` | New |
| `__tests__/api/distributor-invite-admin.test.ts` | Add no-email cases |
| `__tests__/api/distributor-invite-by-distributor.test.ts` | Add no-email cases |
| `__tests__/api/distributor-accept-invite.test.ts` | Add no-email cases |

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema**

In `prisma/schema.prisma`, make these three edits:

```prisma
// User model: make email nullable, add username
model User {
  id               String        @id @default(cuid())
  email            String?       @unique   // was: String @unique
  username         String?       @unique   // NEW
  name             String
  emailVerified    Boolean
  // ... rest unchanged
}

// DistributorInvitation model: make email nullable, remove email index
model DistributorInvitation {
  id         String    @id @default(cuid())
  email      String?   // was: String
  token      String    @unique
  inviterId  String
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime  @default(now())
  inviter    User      @relation("DistributorInvitationInviter", fields: [inviterId], references: [id])

  @@index([token])
  // removed: @@index([email])
}
```

- [ ] **Step 2: Create and run migration**

```bash
npm run db:migrate
```

Enter migration name when prompted: `no_email_invite`

Expected: migration file created and applied, Prisma Client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): make email nullable on User and DistributorInvitation, add User.username"
```

---

## Task 2: better-auth username plugin

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/auth-client.ts`

- [ ] **Step 1: Update `lib/auth.ts`**

```ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    user: {
        additionalFields: {
            role: { type: "string", required: false },
            distributorCode: { type: "string", required: false },
            inviterId: { type: "string", required: false },
        },
    },
    emailAndPassword: {
        enabled: true,
        disableSignUp: true,
    },
    trustedOrigins: [
        config.siteUrl,
        "https://account-mall-*.vercel.app",
    ],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
    },
    advanced: {
        useSecureCookies: config.nodeEnv === "production",
    },
    plugins: [username(), nextCookies()],
})
```

- [ ] **Step 2: Update `lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react"
import { usernameClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [usernameClient()],
})
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors related to auth plugins. (Full build may have unrelated warnings — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts lib/auth-client.ts
git commit -m "feat(auth): enable better-auth username plugin"
```

---

## Task 3: createNoEmailInviteLink utility

**Files:**
- Create: `lib/create-no-email-invite-link.ts`
- Create: `__tests__/lib/create-no-email-invite-link.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/create-no-email-invite-link.test.ts`:

```ts
import { createNoEmailInviteLink } from "@/lib/create-no-email-invite-link"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    config: {
        distributorInviteTtlDays: 7,
        siteUrl: "https://example.com",
    },
}))

describe("createNoEmailInviteLink", () => {
    beforeEach(() => {
        prismaMock.distributorInvitation.create.mockReset()
    })

    it("creates DistributorInvitation with email=null and returns accept-invite link", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        const result = await createNoEmailInviteLink({ inviterId: "inv_1" })
        expect(result.link).toMatch(
            /^https:\/\/example\.com\/distributor\/accept-invite\?token=[0-9a-f-]{36}$/
        )
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: null,
                    inviterId: "inv_1",
                }),
            })
        )
    })

    it("sets expiresAt approximately 7 days from now", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        const before = Date.now()
        await createNoEmailInviteLink({ inviterId: "inv_1" })
        const after = Date.now()

        const createCall = prismaMock.distributorInvitation.create.mock.calls[0][0]
        const expiresAt: Date = createCall.data.expiresAt
        const expectedMs = 7 * 24 * 60 * 60 * 1000
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000)
        expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/create-no-email-invite-link.test.ts -t "creates DistributorInvitation" --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/create-no-email-invite-link'`

- [ ] **Step 3: Implement `lib/create-no-email-invite-link.ts`**

```ts
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

export async function createNoEmailInviteLink({
    inviterId,
}: {
    inviterId: string
}): Promise<{ link: string }> {
    const ttlDays = config.distributorInviteTtlDays
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
    const token = crypto.randomUUID()

    await prisma.distributorInvitation.create({
        data: { email: null, token, inviterId, expiresAt },
    })

    const link = `${config.siteUrl}/distributor/accept-invite?token=${token}`
    return { link }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/create-no-email-invite-link.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/create-no-email-invite-link.ts __tests__/lib/create-no-email-invite-link.test.ts
git commit -m "feat(invite): add createNoEmailInviteLink utility"
```

---

## Task 4: Update validation schemas

**Files:**
- Modify: `lib/validations/distributor-invite.ts`

- [ ] **Step 1: Update `lib/validations/distributor-invite.ts`**

```ts
import * as z from "zod"

export const distributorInviteSchema = z.object({
    email: z
        .string()
        .email("请输入有效的邮箱地址")
        .transform((v) => v.toLowerCase().trim()),
})

export const usernameSchema = z
    .string()
    .min(6, "用户名至少 6 位")
    .max(30, "用户名不能超过 30 位")
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
    .trim()

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "邀请 token 不能为空"),
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
})

export const acceptNoEmailInviteSchema = acceptInviteSchema.extend({
    username: usernameSchema,
})

export type DistributorInviteInput = z.infer<typeof distributorInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type AcceptNoEmailInviteInput = z.infer<typeof acceptNoEmailInviteSchema>
```

- [ ] **Step 2: Verify existing tests still pass (schema exports unchanged)**

```bash
npx jest __tests__/api/distributor-accept-invite.test.ts --no-coverage
```

Expected: all existing tests PASS (no schema-breaking changes for the email path).

- [ ] **Step 3: Commit**

```bash
git add lib/validations/distributor-invite.ts
git commit -m "feat(validation): add usernameSchema and acceptNoEmailInviteSchema"
```

---

## Task 5: Update invite API routes — no-email path

**Files:**
- Modify: `app/api/distributor/invite/route.ts`
- Modify: `app/api/admin/distributors/invite/route.ts`
- Modify: `__tests__/api/distributor-invite-by-distributor.test.ts`
- Modify: `__tests__/api/distributor-invite-admin.test.ts`

### 5a: Distributor invite route

- [ ] **Step 1: Write failing tests — add no-email cases to `__tests__/api/distributor-invite-by-distributor.test.ts`**

Add these two tests inside the existing `describe` block, and add the mock for `createNoEmailInviteLink` at the top:

```ts
// Add after the existing jest.mock calls, at the top of the file:
jest.mock("@/lib/create-no-email-invite-link", () => ({
    createNoEmailInviteLink: jest.fn(),
}))
const createNoEmailInviteLink = require("@/lib/create-no-email-invite-link").createNoEmailInviteLink as jest.Mock

// Also add to beforeEach:
// createNoEmailInviteLink.mockReset()
```

New test cases:

```ts
it("calls createNoEmailInviteLink and returns link when body has no email", async () => {
    getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
    createNoEmailInviteLink.mockResolvedValue({
        link: "https://example.com/distributor/accept-invite?token=abc",
    })
    const res = await DistInvitePost(createRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.link).toBe("https://example.com/distributor/accept-invite?token=abc")
    expect(sendDistributorInvitation).not.toHaveBeenCalled()
    expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1" })
})

it("returns 401 when disabled distributor tries to generate no-email link", async () => {
    getDistributorSession.mockResolvedValue({
        user: { id: "dist_1", name: "Dist", disabledAt: "2025-01-01T00:00:00.000Z" },
    })
    const res = await DistInvitePost(createRequest({}))
    expect(res.status).toBe(401)
    expect(createNoEmailInviteLink).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx jest __tests__/api/distributor-invite-by-distributor.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|✓|✗|×"
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update `app/api/distributor/invite/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema } from "@/lib/validations/distributor-invite"
import { sendDistributorInvitation } from "@/lib/send-distributor-invitation"
import { createNoEmailInviteLink } from "@/lib/create-no-email-invite-link"
import { checkDistributorInviteRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) return unauthorized()

    const user = session.user as { id: string; name?: string; disabledAt?: string | null }
    if (user.disabledAt) {
        return unauthorized("账号已停用，无法发送邀请")
    }

    const rateLimitRes = await checkDistributorInviteRateLimit(user.id)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON body")
    }

    // No-email invite: body has no email field
    const hasEmail =
        typeof body === "object" &&
        body !== null &&
        "email" in body &&
        typeof (body as { email: unknown }).email === "string" &&
        (body as { email: string }).email.length > 0

    if (!hasEmail) {
        const result = await createNoEmailInviteLink({ inviterId: user.id })
        return NextResponse.json({ success: true, link: result.link })
    }

    // Email invite: validate and send
    const parsed = distributorInviteSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    const { email } = parsed.data

    const result = await sendDistributorInvitation({
        email,
        inviterId: user.id,
        inviterName: user.name ?? "分销员",
    })

    if (!result.success) {
        if (result.reason === "already_registered") {
            return badRequest("该邮箱已注册，无需重复邀请")
        }
        return badRequest("邮件发送失败，请稍后重试")
    }

    return NextResponse.json({ success: true, email })
}
```

- [ ] **Step 4: Run all distributor invite tests**

```bash
npx jest __tests__/api/distributor-invite-by-distributor.test.ts --no-coverage
```

Expected: all tests PASS (including the 2 new ones).

### 5b: Admin invite route

- [ ] **Step 5: Write failing tests — add no-email cases to `__tests__/api/distributor-invite-admin.test.ts`**

Add mock and new test cases:

```ts
// Add after the existing jest.mock calls:
jest.mock("@/lib/create-no-email-invite-link", () => ({
    createNoEmailInviteLink: jest.fn(),
}))
const createNoEmailInviteLink = require("@/lib/create-no-email-invite-link").createNoEmailInviteLink as jest.Mock

// Add to beforeEach:
// createNoEmailInviteLink.mockReset()
```

New test cases:

```ts
it("calls createNoEmailInviteLink and returns link when body has no email", async () => {
    getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
    createNoEmailInviteLink.mockResolvedValue({
        link: "https://example.com/distributor/accept-invite?token=abc",
    })
    const res = await AdminInvitePost(createRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.link).toBe("https://example.com/distributor/accept-invite?token=abc")
    expect(sendDistributorInvitation).not.toHaveBeenCalled()
    expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1" })
})

it("returns 401 when unauthenticated admin tries no-email invite", async () => {
    getAdminSession.mockResolvedValue(null)
    const res = await AdminInvitePost(createRequest({}))
    expect(res.status).toBe(401)
    expect(createNoEmailInviteLink).not.toHaveBeenCalled()
})
```

- [ ] **Step 6: Run new admin tests to verify they fail**

```bash
npx jest __tests__/api/distributor-invite-admin.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|✓|✗|×"
```

Expected: 2 new tests FAIL.

- [ ] **Step 7: Update `app/api/admin/distributors/invite/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema } from "@/lib/validations/distributor-invite"
import { sendDistributorInvitation } from "@/lib/send-distributor-invitation"
import { createNoEmailInviteLink } from "@/lib/create-no-email-invite-link"

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON body")
    }

    const admin = session.user as { id: string; name?: string }

    // No-email invite: body has no email field
    const hasEmail =
        typeof body === "object" &&
        body !== null &&
        "email" in body &&
        typeof (body as { email: unknown }).email === "string" &&
        (body as { email: string }).email.length > 0

    if (!hasEmail) {
        const result = await createNoEmailInviteLink({ inviterId: admin.id })
        return NextResponse.json({ success: true, link: result.link })
    }

    const parsed = distributorInviteSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    const { email } = parsed.data

    const result = await sendDistributorInvitation({
        email,
        inviterId: admin.id,
        inviterName: admin.name ?? "管理员",
    })

    if (!result.success) {
        if (result.reason === "already_registered") {
            return badRequest("该邮箱已注册，无需重复邀请")
        }
        return badRequest("邮件发送失败，请稍后重试")
    }

    return NextResponse.json({ success: true, email })
}
```

- [ ] **Step 8: Run all admin invite tests**

```bash
npx jest __tests__/api/distributor-invite-admin.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add app/api/distributor/invite/route.ts app/api/admin/distributors/invite/route.ts \
    __tests__/api/distributor-invite-by-distributor.test.ts \
    __tests__/api/distributor-invite-admin.test.ts
git commit -m "feat(invite): add no-email invite link path to distributor and admin invite routes"
```

---

## Task 6: Update accept-invite API route — no-email path

**Files:**
- Modify: `app/api/distributor/accept-invite/route.ts`
- Modify: `__tests__/api/distributor-accept-invite.test.ts`

- [ ] **Step 1: Write failing tests — add no-email cases to `__tests__/api/distributor-accept-invite.test.ts`**

Add these tests at the end of the existing `describe` block.

First, update `makeInvitation` helper comment (no code change needed — it already supports `email` override).

New test cases:

```ts
it("returns 400 when no-email invite is accepted without username", async () => {
    prismaMock.distributorInvitation.findUnique.mockResolvedValue(
        makeInvitation({ email: null })
    )
    const res = await AcceptInvitePost(
        createRequest({ token: "valid-token", name: "Alice", password: "password123" })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errors?.username).toBeDefined()
})

it("returns 400 when username is too short (< 6 chars) for no-email invite", async () => {
    prismaMock.distributorInvitation.findUnique.mockResolvedValue(
        makeInvitation({ email: null })
    )
    const res = await AcceptInvitePost(
        createRequest({ token: "valid-token", name: "Alice", username: "abc", password: "password123" })
    )
    expect(res.status).toBe(400)
})

it("returns 409 when username is already taken for no-email invite", async () => {
    prismaMock.distributorInvitation.findUnique.mockResolvedValue(
        makeInvitation({ email: null })
    )
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing_user" } as any)
    const res = await AcceptInvitePost(
        createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/用户名已被使用/)
})

it("creates user with email=null and username for no-email invite", async () => {
    prismaMock.distributorInvitation.findUnique.mockResolvedValue(
        makeInvitation({ email: null })
    )
    prismaMock.user.findUnique.mockResolvedValue(null)

    let userCreateArgs: any
    ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
        const userCreateMock = jest.fn().mockResolvedValue({ id: "new_user" })
        await fn({
            ...prismaMock,
            distributorInvitation: {
                findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                update: jest.fn().mockResolvedValue({}),
            },
            user: { create: userCreateMock },
            account: { create: jest.fn().mockResolvedValue({}) },
        })
        userCreateArgs = userCreateMock.mock.calls[0][0]
    })

    const res = await AcceptInvitePost(
        createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
    )
    expect(res.status).toBe(200)
    expect(userCreateArgs.data.email).toBeNull()
    expect(userCreateArgs.data.username).toBe("alice_123")
    expect(userCreateArgs.data.name).toBe("Alice")
})

it("does not check email uniqueness for no-email invite", async () => {
    prismaMock.distributorInvitation.findUnique.mockResolvedValue(
        makeInvitation({ email: null })
    )
    prismaMock.user.findUnique.mockResolvedValue(null) // only called for username check
    ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
        await fn({
            ...prismaMock,
            distributorInvitation: {
                findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                update: jest.fn().mockResolvedValue({}),
            },
            user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
            account: { create: jest.fn().mockResolvedValue({}) },
        })
    })

    const res = await AcceptInvitePost(
        createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
    )
    expect(res.status).toBe(200)
    // user.findUnique was called once — for username check, not email
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { username: "alice_123" } })
    )
    expect(prismaMock.user.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: expect.anything() }) })
    )
})
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx jest __tests__/api/distributor-accept-invite.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|✓|✗|×|●"
```

Expected: 5 new tests FAIL; existing tests still PASS.

- [ ] **Step 3: Update `app/api/distributor/accept-invite/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badRequest, conflict, notFound, validationError } from "@/lib/api-response"
import {
    acceptInviteSchema,
    usernameSchema,
} from "@/lib/validations/distributor-invite"
import { hashPassword } from "better-auth/crypto"
import { checkAcceptInviteRateLimit } from "@/lib/rate-limit"
import { config } from "@/lib/config"
import * as z from "zod"

export async function POST(request: NextRequest) {
    const rateLimitRes = await checkAcceptInviteRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON body")
    }

    const parsed = acceptInviteSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    const { token, name, password } = parsed.data

    // Find and validate invitation
    const invitation = await prisma.distributorInvitation.findUnique({
        where: { token },
        include: {
            inviter: { select: { role: true } },
        },
    })

    if (!invitation) {
        return notFound("邀请链接无效")
    }
    if (invitation.acceptedAt) {
        return badRequest("此邀请链接已被使用", { code: "INVITE_USED" })
    }
    if (invitation.expiresAt < new Date()) {
        return badRequest("邀请链接已过期", { code: "INVITE_EXPIRED" })
    }

    const isNoEmail = invitation.email === null
    let username: string | undefined

    if (isNoEmail) {
        // Require and validate username
        const usernameResult = z.object({ username: usernameSchema }).safeParse(body)
        if (!usernameResult.success) {
            return validationError(usernameResult.error.flatten().fieldErrors)
        }
        username = usernameResult.data.username

        // Pre-check username uniqueness for better UX
        const existingByUsername = await prisma.user.findUnique({ where: { username } })
        if (existingByUsername) {
            return conflict("用户名已被使用，请换一个")
        }
    } else {
        // Email invite: check if email is already registered
        const existingUser = await prisma.user.findUnique({
            where: { email: invitation.email! },
            select: { id: true },
        })
        if (existingUser) {
            return badRequest("该邮箱已注册")
        }
    }

    const hashedPassword = await hashPassword(password)
    const now = new Date()

    const newUserInviterId =
        invitation.inviter.role === "DISTRIBUTOR" ? invitation.inviterId : null

    const tempId = crypto.randomUUID()
    const distributorCode = `D${tempId.replace(/-/g, "").slice(-8).toUpperCase()}`

    try {
        await prisma.$transaction(async (tx) => {
            // Re-check acceptedAt inside transaction to prevent concurrent accepts
            const inv = await tx.distributorInvitation.findUnique({
                where: { token },
                select: { acceptedAt: true },
            })
            if (inv?.acceptedAt) {
                throw new Error("ALREADY_ACCEPTED")
            }

            const user = await tx.user.create({
                data: {
                    email: isNoEmail ? null : invitation.email,
                    username: isNoEmail ? username! : null,
                    name,
                    emailVerified: true,
                    role: "DISTRIBUTOR",
                    distributorCode,
                    discountPercent: config.basePromoDiscountPercent,
                    inviterId: newUserInviterId,
                    createdAt: now,
                    updatedAt: now,
                },
            })

            await tx.account.create({
                data: {
                    userId: user.id,
                    accountId: user.id,
                    providerId: "credential",
                    password: hashedPassword,
                    createdAt: now,
                    updatedAt: now,
                },
            })

            await tx.distributorInvitation.update({
                where: { token },
                data: { acceptedAt: now },
            })
        })
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_ACCEPTED") {
            return conflict("此邀请链接已被使用")
        }
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
        ) {
            return conflict("注册冲突，请重试")
        }
        throw err
    }

    return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run all accept-invite tests**

```bash
npx jest __tests__/api/distributor-accept-invite.test.ts --no-coverage
```

Expected: all tests PASS (existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add app/api/distributor/accept-invite/route.ts \
    __tests__/api/distributor-accept-invite.test.ts
git commit -m "feat(invite): handle no-email invitations in accept-invite route"
```

---

## Task 7: Accept-invite UI

**Files:**
- Modify: `app/distributor/accept-invite/accept-invite-form.tsx`
- Modify: `app/distributor/accept-invite/page.tsx`

- [ ] **Step 1: Update `app/distributor/accept-invite/accept-invite-form.tsx`**

Change the `email` prop from `string` to `string | null`. When `email` is null, render a username input instead of the email readonly display.

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const emailFormSchema = z
  .object({
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  })

const noEmailFormSchema = z
  .object({
    username: z
      .string()
      .min(6, "用户名至少 6 位")
      .max(30, "用户名不能超过 30 位")
      .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  })

interface AcceptInviteFormProps {
  token: string
  email: string | null
}

export function AcceptInviteForm({ token, email }: AcceptInviteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isNoEmail = email === null

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  })

  const noEmailForm = useForm<z.infer<typeof noEmailFormSchema>>({
    resolver: zodResolver(noEmailFormSchema),
    defaultValues: { username: "", name: "", password: "", confirmPassword: "" },
  })

  const handleEmailSubmit = async (values: z.infer<typeof emailFormSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: values.name, password: values.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "注册失败，请稍后重试")
        return
      }
      toast.success("注册成功，请登录")
      router.push("/distributor/login")
    } catch {
      toast.error("注册失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleNoEmailSubmit = async (values: z.infer<typeof noEmailFormSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: values.name,
          username: values.username,
          password: values.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error?.includes("用户名已被使用")) {
          noEmailForm.setError("username", { message: data.error })
        } else {
          toast.error(data.error || "注册失败，请稍后重试")
        }
        return
      }
      toast.success("注册成功，请登录")
      router.push("/distributor/login")
    } catch {
      toast.error("注册失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  if (isNoEmail) {
    return (
      <Form {...noEmailForm}>
        <form onSubmit={noEmailForm.handleSubmit(handleNoEmailSubmit)} className="space-y-4">
          <FormField
            control={noEmailForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <Input placeholder="6-30 位字母、数字或下划线" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>昵称</FormLabel>
                <FormControl>
                  <Input placeholder="您的昵称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>设置密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="至少 6 位" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="再次输入密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? "注册中..." : "完成注册"}
          </Button>
        </form>
      </Form>
    )
  }

  return (
    <Form {...emailForm}>
      <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">受邀邮箱</p>
          <Input value={email ?? ""} disabled className="bg-muted" />
        </div>
        <FormField
          control={emailForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>昵称</FormLabel>
              <FormControl>
                <Input placeholder="您的昵称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={emailForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>设置密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="至少 6 位" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={emailForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="再次输入密码" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {loading ? "注册中..." : "完成注册"}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Update `app/distributor/accept-invite/page.tsx`**

Change the select to fetch `email` as nullable and update the props passed to the form. Also update the page description for no-email invitations.

```tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { AcceptInviteForm } from "./accept-invite-form"

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const { token } = await searchParams

  if (!token) {
    return <InvalidInvite reason="missing" />
  }

  const invitation = await prisma.distributorInvitation.findUnique({
    where: { token },
    select: { email: true, expiresAt: true, acceptedAt: true },
  })

  if (!invitation) {
    return <InvalidInvite reason="notfound" />
  }

  if (invitation.acceptedAt) {
    return <InvalidInvite reason="used" />
  }

  if (invitation.expiresAt < new Date()) {
    return <InvalidInvite reason="expired" />
  }

  const isNoEmail = invitation.email === null

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>设置登录{isNoEmail ? "用户名" : "密码"}</CardTitle>
          <CardDescription>
            {isNoEmail
              ? "您已被邀请加入分销中心，请设置用户名和密码以完成注册，用户名将作为您的登录账号。"
              : "您已被邀请加入分销中心，请设置密码以完成注册。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invitation.email} />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            已有账号？{" "}
            <Link href="/distributor/login" className="underline underline-offset-2">
              登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}

function InvalidInvite({ reason }: { reason: "missing" | "notfound" | "used" | "expired" }) {
  const messages = {
    missing: "邀请链接无效，缺少必要参数。",
    notfound: "邀请链接无效或不存在。",
    used: "此邀请链接已被使用，每个邀请链接只能使用一次。",
    expired: "邀请链接已过期，请联系邀请人重新发送邀请。",
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <AlertCircle className="size-12 text-destructive" />
          </div>
          <CardTitle>邀请链接无效</CardTitle>
          <CardDescription>{messages[reason]}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="justify-center">
          <Button variant="outline" asChild>
            <Link href="/distributor/login">← 返回登录页</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/distributor/accept-invite/accept-invite-form.tsx \
    app/distributor/accept-invite/page.tsx
git commit -m "feat(invite): update accept-invite UI to support no-email (username) registration"
```

---

## Task 8: Admin invite UI — two buttons + link dialog

**Files:**
- Create: `app/admin/(main)/distributors/generate-link-dialog.tsx`
- Modify: `app/admin/(main)/distributors/invite-distributor-button-client.tsx`

- [ ] **Step 1: Create `app/admin/(main)/distributors/generate-link-dialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Link2, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface GenerateLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiEndpoint: string
}

export function GenerateLinkDialog({ open, onOpenChange, apiEndpoint }: GenerateLinkDialogProps) {
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "生成失败，请稍后重试")
        return
      }
      setLink(data.link)
    } catch {
      toast.error("生成失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("链接已复制")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setLink(null)
      setCopied(false)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成邀请链接</DialogTitle>
          <DialogDescription>
            生成一次性邀请链接，将链接发给对方，对方点击后可设置用户名和密码加入。链接 7 天内有效，仅限一人使用。
          </DialogDescription>
        </DialogHeader>
        {!link ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Link2 className="mr-2 size-4" />
                生成邀请链接
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={link} readOnly className="text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">复制后通过微信或其他方式发给对方</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update `app/admin/(main)/distributors/invite-distributor-button-client.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Link2 } from "lucide-react"
import { InviteDistributorDialog } from "./invite-distributor-dialog"
import { GenerateLinkDialog } from "./generate-link-dialog"

export function InviteDistributorButtonClient() {
    const [emailOpen, setEmailOpen] = useState(false)
    const [linkOpen, setLinkOpen] = useState(false)

    return (
        <>
            <Button variant="outline" onClick={() => setEmailOpen(true)}>
                <Mail className="mr-2 size-4" />
                邮箱邀请
            </Button>
            <Button onClick={() => setLinkOpen(true)}>
                <Link2 className="mr-2 size-4" />
                生成邀请链接
            </Button>
            <InviteDistributorDialog open={emailOpen} onOpenChange={setEmailOpen} />
            <GenerateLinkDialog
                open={linkOpen}
                onOpenChange={setLinkOpen}
                apiEndpoint="/api/admin/distributors/invite"
            />
        </>
    )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/distributors/generate-link-dialog.tsx \
    app/admin/(main)/distributors/invite-distributor-button-client.tsx
git commit -m "feat(admin-ui): add generate invite link button alongside email invite"
```

---

## Task 9: Distributor invite UI — two buttons + link dialog

**Files:**
- Create: `app/distributor/(main)/generate-invite-link-dialog.tsx`
- Modify: `app/distributor/(main)/invite-sub-distributor-button.tsx`

- [ ] **Step 1: Create `app/distributor/(main)/generate-invite-link-dialog.tsx`**

This component is identical in behavior to the admin one but calls the distributor API endpoint. Rather than duplicating the component, we reuse `GenerateLinkDialog` from the admin folder — but since admin components should not be imported into distributor context, copy it:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Link2, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface GenerateInviteLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateInviteLinkDialog({ open, onOpenChange }: GenerateInviteLinkDialogProps) {
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "生成失败，请稍后重试")
        return
      }
      setLink(data.link)
    } catch {
      toast.error("生成失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("链接已复制")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setLink(null)
      setCopied(false)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成邀请链接</DialogTitle>
          <DialogDescription>
            生成一次性邀请链接，将链接发给对方，对方点击后可设置用户名和密码加入。链接 7 天内有效，仅限一人使用。
          </DialogDescription>
        </DialogHeader>
        {!link ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Link2 className="mr-2 size-4" />
                生成邀请链接
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={link} readOnly className="text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">复制后通过微信或其他方式发给对方</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update `app/distributor/(main)/invite-sub-distributor-button.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { UserPlus, Mail, Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { GenerateInviteLinkDialog } from "./generate-invite-link-dialog"

const formSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
})

interface InviteSubDistributorButtonProps {
  level2RatePercent: number
}

export function InviteSubDistributorButton({
  level2RatePercent,
}: InviteSubDistributorButtonProps) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "邀请失败，请稍后重试")
        return
      }
      toast.success(`邀请邮件已发送至 ${values.email}`)
      form.reset()
      setEmailOpen(false)
    } catch {
      toast.error("邀请失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="mr-2 size-4" />
        邮箱邀请
      </Button>
      <Button onClick={() => setLinkOpen(true)}>
        <Link2 className="mr-2 size-4" />
        生成邀请链接
      </Button>
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邮箱邀请团队成员</DialogTitle>
            <DialogDescription>
              输入对方邮箱发送邀请，对方加入后每笔成交，您持续获得团队销售分润。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="请输入对方邮箱地址" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEmailOpen(false)}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {loading ? "发送中..." : "发送邀请"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <GenerateInviteLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/distributor/(main)/generate-invite-link-dialog.tsx \
    app/distributor/(main)/invite-sub-distributor-button.tsx
git commit -m "feat(distributor-ui): add generate invite link button alongside email invite"
```

---

## Task 10: Login page — auto-detect email vs username

**Files:**
- Modify: `app/distributor/login/page.tsx`

- [ ] **Step 1: Update `app/distributor/login/page.tsx`**

Change the email input to a generic "账号" input. In `handleSubmit`, detect if the input contains `@` and route to `signIn.email()` or `signIn.username()` accordingly.

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DistributorLoginPage() {
    const router = useRouter()
    const [account, setAccount] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const isEmail = account.includes("@")

            if (isEmail) {
                const { error: signInError } = await authClient.signIn.email({
                    email: account,
                    password,
                    fetchOptions: {
                        onError: (ctx) => {
                            toast.error(ctx.error.message)
                        },
                    },
                })
                if (signInError) return
            } else {
                const { error: signInError } = await authClient.signIn.username({
                    username: account,
                    password,
                    fetchOptions: {
                        onError: (ctx) => {
                            toast.error(ctx.error.message)
                        },
                    },
                })
                if (signInError) return
            }

            const { data: session } = await authClient.getSession()
            const role = (session?.user as { role?: string } | undefined)?.role
            if (role === "DISTRIBUTOR") {
                toast.success("登录成功")
                router.push("/distributor")
                router.refresh()
            } else {
                toast.error("请使用管理员入口登录")
                await authClient.signOut()
                router.refresh()
            }
        } catch {
            toast.error("发生未知错误")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        分销中心登录
                    </CardTitle>
                    <CardDescription>
                        登录您的分销员账号
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="account">账号</Label>
                            <Input
                                id="account"
                                type="text"
                                inputMode="email"
                                autoComplete="username email"
                                value={account}
                                onChange={(e) => setAccount(e.target.value)}
                                required
                                placeholder="邮箱或用户名"
                                className="min-h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="min-h-11 pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="size-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-11"
                        >
                            {loading ? "登录中..." : "登录"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            还没有账号？请联系已有分销员获取邀请链接
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
```

- [ ] **Step 2: Run all tests to confirm nothing regressed**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: all previously passing tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add app/distributor/login/page.tsx
git commit -m "feat(login): support username login alongside email on distributor login page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `User.email` nullable, add `username` | Task 1 |
| `DistributorInvitation.email` nullable | Task 1 |
| better-auth username plugin | Task 2 |
| Login: email or username auto-detect | Task 10 |
| Admin + distributor: two invite buttons | Tasks 8, 9 |
| Generate link path (no email, no body) | Tasks 5, 8, 9 |
| Accept invite: username form for no-email | Tasks 6, 7 |
| API: no-email path uses `createNoEmailInviteLink` | Tasks 3, 5 |
| API: accept creates `{ email: null, username }` user | Task 6 |

All spec requirements covered. ✓

**Placeholder scan:** No TBD/TODO found. ✓

**Type consistency:** `usernameSchema` exported in Task 4, used in Task 6. `createNoEmailInviteLink` created in Task 3, imported in Tasks 5 (both routes). `email: string | null` prop flows from Task 7 (page) to Task 7 (form). ✓

**Scope:** All 9 tasks form one cohesive feature. No unrelated changes. ✓
