import { addHKTDays, getHKTDayStart } from "@/lib/utils"

/**
 * Dashboard 日期范围等纯函数，便于单测
 */

/**
 * 获取相对今天的「过去 N 天」的起止日期（HKT 0 点）
 * @param fromToday 0 = 今天，1 = 昨天，7 = 7天前
 * @param numDays 跨度天数
 */
export function getDateRange(fromToday: number, numDays: number): { start: Date; end: Date } {
    const now = new Date()
    const start = addHKTDays(getHKTDayStart(now), -fromToday - numDays + 1)
    const end = addHKTDays(start, numDays)
    return { start, end }
}

/**
 * 生成连续 N 天的日期数组（用于趋势图 X 轴与聚合桶）
 * 从 (today - days + 1) 到 today，每天 HKT 0 点
 */
export function getDaysForTrend(days: number): Date[] {
    const result: Date[] = []
    const todayStart = getHKTDayStart(new Date())
    for (let i = days - 1; i >= 0; i--) {
        result.push(addHKTDays(todayStart, -i))
    }
    return result
}

/**
 * 判断某时间戳是否落在 [dayStart, dayEnd) 内
 */
export function isInDay(ts: Date, dayStart: Date): boolean {
    const dayEnd = addHKTDays(dayStart, 1)
    return ts >= dayStart && ts < dayEnd
}
