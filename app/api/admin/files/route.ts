import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { list, del } from "@vercel/blob"

const PATH_PREFIX_WHITELIST = ["products", "guides", "announcements", "receipts"] as const
type PathPrefix = (typeof PATH_PREFIX_WHITELIST)[number]

function isPathPrefix(raw: string | null): raw is PathPrefix {
    return raw !== null && PATH_PREFIX_WHITELIST.includes(raw as PathPrefix)
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: "文件存储未配置，请在 Vercel Dashboard 配置 BLOB_READ_WRITE_TOKEN" },
            { status: 503 }
        )
    }

    const { searchParams } = request.nextUrl
    const prefix = searchParams.get("prefix")
    if (!isPathPrefix(prefix)) {
        return NextResponse.json(
            { error: "缺少或无效的 prefix，可选：products、guides、announcements、receipts" },
            { status: 400 }
        )
    }

    const cursor = searchParams.get("cursor") ?? undefined
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20

    try {
        const result = await list({
            prefix: `${prefix}/`,
            cursor,
            limit,
        })

        const blobs = result.blobs.map((b) => ({
            url: b.url,
            pathname: b.pathname,
            size: b.size,
            uploadedAt: b.uploadedAt.toISOString(),
        }))

        return NextResponse.json({
            blobs,
            nextCursor: result.hasMore ? result.cursor : undefined,
        })
    } catch (err) {
        console.error("[admin/files] list error:", err)
        return NextResponse.json(
            { error: "列举文件失败，请稍后重试" },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: "文件存储未配置，请在 Vercel Dashboard 配置 BLOB_READ_WRITE_TOKEN" },
            { status: 503 }
        )
    }

    let body: { urls?: string[] }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "请求体须为 JSON，且包含 urls 数组" }, { status: 400 })
    }

    const urls = body.urls
    if (!Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: "请提供要删除的文件 URL 数组（urls）" }, { status: 400 })
    }

    const validUrls = urls.filter((u) => typeof u === "string" && u.startsWith("http"))
    if (validUrls.length === 0) {
        return NextResponse.json({ error: "未包含有效的 blob URL" }, { status: 400 })
    }

    try {
        await del(validUrls)
        return NextResponse.json({ deleted: validUrls })
    } catch (err) {
        console.error("[admin/files] delete error:", err)
        return NextResponse.json(
            { error: "删除文件失败，请稍后重试" },
            { status: 500 }
        )
    }
}
