import { NextRequest, NextResponse } from "next/server"
import { processYipayNotifyAndComplete } from "@/lib/yipay-notify-complete"


/**
 * POST /api/payment/yipay/notify
 * Yipay (易支付) async notify. Verify sign, match order and amount, idempotent complete.
 * Returns plain text "success" or "failure".
 */
async function parseNotifyBody(request: NextRequest): Promise<Record<string, unknown>> {
    const fromEntries = (entries: [string, string][]): Record<string, unknown> =>
        Object.fromEntries(entries.map(([k, v]) => [k, v ?? ""])) as Record<string, unknown>

    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text()
        const params = new URLSearchParams(text)
        return fromEntries(Array.from(params.entries()))
    }
    const formData = await request.formData()
    return fromEntries(
        Array.from(formData.entries()).map(([k, v]) => [
            k,
            typeof v === "string" ? v : "",
        ]) as [string, string][],
    )
}

export async function POST(request: NextRequest) {
    let postData: Record<string, unknown>
    try {
        postData = await parseNotifyBody(request)
    } catch {
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    let result: { ok: boolean }
    try {
        result = await processYipayNotifyAndComplete(postData)
    } catch {
        return new NextResponse("failure", { status: 500, headers: { "Content-Type": "text/plain" } })
    }

    if (!result.ok) {
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }
    return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
}

export const runtime = "nodejs"
