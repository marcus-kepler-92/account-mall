const HKT_TZ = "Asia/Hong_Kong"

// en-CA locale produces ISO YYYY-MM-DD format
export function todayHKT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

export function offsetDaysHKT(days: number): string {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

export function firstDayOfMonthHKT(): string {
  return todayHKT().slice(0, 8) + "01" // "YYYY-MM-01"
}

export function mondayOfCurrentWeekHKT(): string {
  const today = todayHKT()
  const [y, m, d] = today.split("-").map(Number)
  const day = new Date(y, m - 1, d).getDay()
  const diff = day === 0 ? -6 : 1 - day
  return offsetDaysHKT(diff)
}

export type DashboardDateRangePreset = {
  label: string
  from: string
  to: string
}

/** Preset ranges for admin dashboard reports (HKT calendar dates). */
export function getDashboardDateRangePresets(): DashboardDateRangePreset[] {
  const today = todayHKT()
  return [
    { label: "今日", from: today, to: today },
    { label: "昨日", from: offsetDaysHKT(-1), to: offsetDaysHKT(-1) },
    { label: "本周", from: mondayOfCurrentWeekHKT(), to: today },
    { label: "本月", from: firstDayOfMonthHKT(), to: today },
  ]
}
