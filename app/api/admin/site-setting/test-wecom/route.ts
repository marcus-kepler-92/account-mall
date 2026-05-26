import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"

// Sends a one-off markdown message to the configured WeCom group-bot webhook so
// the admin can verify the URL is reachable and the bot is in the target group.
// Uses the *effective* setting (DB override -> env fallback) — to test a brand
// new URL the admin must save it first; the form component warns when the
// field is dirty.
export async function POST(): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const settings = await getSiteSettings()
    if (!settings.wecomWebhookUrl) {
        return badRequest("未配置企微 webhook URL")
    }

    try {
        const res = await fetch(settings.wecomWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                msgtype: "markdown",
                markdown: {
                    content: "### ✅ 测试消息\n来自 Account Mall 管理后台",
                },
            }),
        })
        if (!res.ok) {
            return NextResponse.json(
                { ok: false, error: `企微返回 ${res.status}` },
                { status: 502 },
            )
        }
        // WeCom returns 200 with { errcode, errmsg } even on logical failures.
        const body = (await res.json().catch(() => ({}))) as {
            errcode?: number
            errmsg?: string
        }
        if (typeof body.errcode === "number" && body.errcode !== 0) {
            return NextResponse.json(
                { ok: false, error: body.errmsg || `errcode=${body.errcode}` },
                { status: 502 },
            )
        }
        return NextResponse.json({ ok: true })
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : "网络错误" },
            { status: 502 },
        )
    }
}
