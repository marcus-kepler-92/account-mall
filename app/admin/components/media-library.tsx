"use client"

export const PREFIX_OPTIONS = [
  { value: "products", label: "商品图片" },
  { value: "guides", label: "指南图片" },
  { value: "announcements", label: "公告图片" },
  { value: "receipts", label: "提现凭证" },
] as const

export type Prefix = (typeof PREFIX_OPTIONS)[number]["value"]

export interface BlobItem {
  url: string
  pathname: string
  size: number
  uploadedAt: string
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function fileNameFromPath(pathname: string): string {
  const parts = pathname.split("/")
  return parts[parts.length - 1] ?? pathname
}

export function isImagePath(pathname: string): boolean {
  const ext = pathname.split(".").pop()?.toLowerCase()
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "")
}
