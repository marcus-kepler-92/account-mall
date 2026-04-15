import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

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
const DATE_TIMEZONE = "Asia/Hong_Kong"

/**
 * Returns the start of the given date's day in HKT (UTC+8), as a UTC Date.
 * @example getHKTDayStart(new Date('2025-01-15T01:00:00Z')) // → 2025-01-14T16:00:00.000Z (HKT Jan 15 00:00)
 */
export function getHKTDayStart(date: Date): Date {
  const zoned = toZonedTime(date, DATE_TIMEZONE)
  zoned.setHours(0, 0, 0, 0)
  return fromZonedTime(zoned, DATE_TIMEZONE)
}

/**
 * Returns { start, end } representing [Jan 1 00:00, Jan 1 00:00 next year)
 * in HKT, as UTC Dates.
 */
export function getHKTYearBounds(): { start: Date; end: Date } {
  const nowHK = toZonedTime(new Date(), DATE_TIMEZONE)
  const year = nowHK.getFullYear()
  return {
    start: fromZonedTime(new Date(year, 0, 1, 0, 0, 0, 0), DATE_TIMEZONE),
    end: fromZonedTime(new Date(year + 1, 0, 1, 0, 0, 0, 0), DATE_TIMEZONE),
  }
}

/**
 * 格式化为完整日期时间，如 "2025/01/15 14:30:00"
 * 服务端/客户端均可用，始终使用 Asia/Hong_Kong 时区。
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
 * Format a number as CNY currency, e.g. 12.5 → "¥12.50"
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

/**
 * 格式化为短日期时间（不含年份），如 "01/15 14:30"
 * 服务端/客户端均可用，始终使用 Asia/Hong_Kong 时区。
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
