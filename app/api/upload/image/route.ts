import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { uploadBinary, DEFAULT_MAX_BYTES } from "@/lib/upload"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB，与表单提示一致

const PATH_PREFIX_WHITELIST = ["products", "guides", "announcements"] as const
type PathPrefix = (typeof PATH_PREFIX_WHITELIST)[number]

function getPathPrefix(formData: FormData, searchParams: URLSearchParams): PathPrefix {
    const fromForm = formData.get("pathPrefix")
    const fromQuery = searchParams.get("pathPrefix")
    const raw = (typeof fromForm === "string" ? fromForm : fromQuery) ?? "products"
    return PATH_PREFIX_WHITELIST.includes(raw as PathPrefix) ? (raw as PathPrefix) : "products"
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
        return NextResponse.json(
            { error: "请使用 multipart/form-data 上传图片" },
            { status: 400 }
        )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file || !(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "请选择图片文件" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
        return NextResponse.json(
            { error: "仅支持 JPG、PNG、WebP、GIF，且不超过 2MB" },
            { status: 400 }
        )
    }
    if (file.size > Math.min(PRODUCT_IMAGE_MAX_BYTES, DEFAULT_MAX_BYTES)) {
        return NextResponse.json(
            { error: "图片大小不能超过 2MB" },
            { status: 400 }
        )
    }

    const pathPrefix = getPathPrefix(formData, request.nextUrl.searchParams)
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadBinary(buffer, {
        mimeType: file.type,
        pathPrefix,
        cacheControlMaxAge: 365 * 24 * 60 * 60,
    })

    return NextResponse.json({ url })
}
