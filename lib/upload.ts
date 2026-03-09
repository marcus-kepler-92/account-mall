/**
 * 通用二进制上传：使用 Vercel Blob。
 * 需在 Vercel Dashboard → Storage 创建 Blob Store 并配置 BLOB_READ_WRITE_TOKEN。
 *
 * 参考：https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
 * 服务端上传受 Vercel 请求体约 4.5MB 限制，建议单文件 ≤ DEFAULT_MAX_BYTES。
 */
import { put } from "@vercel/blob"
import { randomUUID } from "crypto"

/** Vercel 请求体约 4.5MB，建议单文件不超过 4MB */
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
}

function extFromMime(mime: string): string {
    return MIME_TO_EXT[mime] ?? "bin"
}

export type UploadOptions = {
    /** MIME 类型，用于 Content-Type 与扩展名 */
    mimeType: string
    /** 路径前缀，如 "products" -> products/xxx、receipts -> receipts/xxx */
    pathPrefix?: string
    /** 缓存时长（秒），默认 1 个月 */
    cacheControlMaxAge?: number
    /** 是否加随机后缀避免重名，默认 true */
    addRandomSuffix?: boolean
}

const DEFAULT_PREFIX = "uploads"

/**
 * 上传二进制内容到 Vercel Blob，返回公网 URL。
 * 未配置 BLOB_READ_WRITE_TOKEN 时抛出错误。
 */
export async function uploadBinary(
    buffer: Buffer,
    options: UploadOptions,
): Promise<string> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error(
            "图片上传需要配置 Vercel Blob：请在 Vercel Dashboard → Storage 创建 Blob Store，并配置 BLOB_READ_WRITE_TOKEN。",
        )
    }
    const {
        mimeType,
        pathPrefix = DEFAULT_PREFIX,
        cacheControlMaxAge,
        addRandomSuffix = true,
    } = options
    const ext = extFromMime(mimeType)
    const filename = `${randomUUID()}.${ext}`
    const pathname = `${pathPrefix}/${filename}`

    const blob = await put(pathname, buffer, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix,
        ...(cacheControlMaxAge != null && { cacheControlMaxAge }),
    })
    return blob.url
}
