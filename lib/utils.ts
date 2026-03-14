import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL-friendly slug from a string.
 * e.g. "My Product Name" → "my-product-name"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

const DATE_LOCALE = "zh-CN"
const DATE_TIMEZONE = "Asia/Shanghai"

/**
 * 格式化为完整日期时间，如 "2025/01/15 14:30:00"
 * 服务端/客户端均可用，始终使用 Asia/Shanghai 时区。
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleString(DATE_LOCALE, {
      timeZone: DATE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(date)
  }
}

/**
 * 格式化为短日期时间（不含年份），如 "01/15 14:30"
 * 服务端/客户端均可用，始终使用 Asia/Shanghai 时区。
 */
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleString(DATE_LOCALE, {
      timeZone: DATE_TIMEZONE,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(date)
  }
}
