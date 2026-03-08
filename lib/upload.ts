/**
 * 通用二进制上传：Vercel Blob 或本地磁盘。
 * - 有 BLOB_READ_WRITE_TOKEN 时上传到 Vercel Blob，返回公网 URL。
 * - 无 token 时写入 public/uploads/{pathPrefix}/，返回相对路径（仅适合有持久磁盘的环境）。
 *
 * 参考：https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
 * - 服务端上传受 Vercel 请求体 4.5MB 限制，建议单文件 ≤ DEFAULT_MAX_BYTES；更大文件可改用 Client Upload 或 multipart。
 */
import { mkdir, writeFile } from "fs/promises"
import path from "path"
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
    /** 路径前缀，Blob 与本地目录均使用，如 "receipts" -> receipts/xxx、public/uploads/receipts */
    pathPrefix?: string
    /** 缓存时长（秒），仅 Blob 生效，默认 1 个月 */
    cacheControlMaxAge?: number
    /** 是否加随机后缀避免重名，默认 true */
    addRandomSuffix?: boolean
}

const DEFAULT_PREFIX = "uploads"

/**
 * 上传二进制内容，返回可访问的 URL 或相对路径。
 */
export async function uploadBinary(
    buffer: Buffer,
    options: UploadOptions,
): Promise<string> {
    const {
        mimeType,
        pathPrefix = DEFAULT_PREFIX,
        cacheControlMaxAge,
        addRandomSuffix = true,
    } = options
    const ext = extFromMime(mimeType)
    const filename = `${randomUUID()}.${ext}`

    if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import("@vercel/blob")
        const blob = await put(`${pathPrefix}/${filename}`, buffer, {
            access: "public",
            contentType: mimeType,
            addRandomSuffix,
            ...(cacheControlMaxAge != null && { cacheControlMaxAge }),
        })
        return blob.url
    }

    const dir = path.join(process.cwd(), "public", "uploads", pathPrefix)
    await mkdir(dir, { recursive: true })
    const filepath = path.join(dir, filename)
    await writeFile(filepath, buffer)
    return `/uploads/${pathPrefix}/${filename}`
}
