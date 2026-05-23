import {
  isWithinBusinessHours,
  nextWindowStart,
  formatEtaText,
  formatBusinessHoursHint,
  computeInBusinessHours,
  type BusinessHoursConfig,
} from "@/lib/business-hours"

const SH = "Asia/Shanghai"

function shDate(iso: string): Date {
  // iso assumed to be "YYYY-MM-DDTHH:mm:ss" in Shanghai local time
  // Shanghai is UTC+8, no DST → subtract 8h to get UTC
  return new Date(iso + "+08:00")
}

describe("business-hours", () => {
  const cfg: BusinessHoursConfig = { start: 9, end: 22, weekdays: [0, 1, 2, 3, 4, 5, 6], timezone: SH }

  it("isWithinBusinessHours: 10:00 Mon, 9-22 all-days → true", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T10:00:00"), cfg)).toBe(true)
  })

  it("isWithinBusinessHours: 23:00 → false", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T23:00:00"), cfg)).toBe(false)
  })

  it("isWithinBusinessHours: 09:00 (boundary start) → true; 22:00 (boundary end exclusive) → false", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T09:00:00"), cfg)).toBe(true)
    expect(isWithinBusinessHours(shDate("2026-05-25T22:00:00"), cfg)).toBe(false)
  })

  it("cross-night window 22→6: 23:00 → true (Mon counts), 05:00 → true (Tue counts as Mon's window), 07:00 → false", () => {
    const c: BusinessHoursConfig = { start: 22, end: 6, weekdays: [1], timezone: SH }
    expect(isWithinBusinessHours(shDate("2026-05-25T23:00:00"), c)).toBe(true)  // Mon 23:00
    expect(isWithinBusinessHours(shDate("2026-05-26T05:00:00"), c)).toBe(true)  // Tue 05:00 belongs to Mon window
    expect(isWithinBusinessHours(shDate("2026-05-26T07:00:00"), c)).toBe(false)
    expect(isWithinBusinessHours(shDate("2026-05-26T22:00:00"), c)).toBe(false) // Tue not in weekdays
  })

  it("excludes weekdays not in set", () => {
    const c: BusinessHoursConfig = { start: 9, end: 22, weekdays: [1, 2, 3, 4, 5], timezone: SH }
    expect(isWithinBusinessHours(shDate("2026-05-23T10:00:00"), c)).toBe(false) // Sat
    expect(isWithinBusinessHours(shDate("2026-05-25T10:00:00"), c)).toBe(true)  // Mon
  })

  it("nextWindowStart returns now when in-window", () => {
    const now = shDate("2026-05-25T10:00:00")
    expect(nextWindowStart(now, cfg).getTime()).toBe(now.getTime())
  })

  it("nextWindowStart: 23:00 (out-of-window) → next day 09:00", () => {
    const now = shDate("2026-05-25T23:00:00")
    const next = nextWindowStart(now, cfg)
    // expect SH date 2026-05-26 09:00
    expect(next.toISOString()).toBe("2026-05-26T01:00:00.000Z") // 09:00 SH = 01:00 UTC
  })

  it("nextWindowStart skips disallowed weekdays", () => {
    const c: BusinessHoursConfig = { start: 9, end: 22, weekdays: [1], timezone: SH }
    const now = shDate("2026-05-23T10:00:00") // Saturday
    const next = nextWindowStart(now, c)
    // next Monday 9:00 SH = 2026-05-25T01:00:00Z
    expect(next.toISOString()).toBe("2026-05-25T01:00:00.000Z")
  })

  it("formatEtaText in-window mentions '通常在'", () => {
    const txt = formatEtaText(shDate("2026-05-25T10:00:00"), cfg)
    expect(txt).toMatch(/通常在/)
  })

  it("formatEtaText out-of-window mentions '非工作时间'", () => {
    const txt = formatEtaText(shDate("2026-05-25T23:00:00"), cfg)
    expect(txt).toMatch(/非工作时间/)
  })
})

// Legacy API still consumed by agent-cs.ts — keep covered.
describe("computeInBusinessHours (legacy)", () => {
  const tz = "Asia/Shanghai"
  const check = (iso: string, start: number, end: number) =>
    computeInBusinessHours(new Date(iso), tz, start, end)

  it("returns true at 10:00 Shanghai (9-22)", () => {
    expect(check("2026-05-19T02:00:00Z", 9, 22)).toBe(true)
  })

  it("returns false at 23:00 Shanghai (9-22)", () => {
    expect(check("2026-05-19T15:00:00Z", 9, 22)).toBe(false)
  })

  it("overnight 22-9: true at Shanghai 23:00", () => {
    expect(check("2026-05-19T15:00:00Z", 22, 9)).toBe(true)
  })

  it("overnight 22-9: false at Shanghai 12:00", () => {
    expect(check("2026-05-19T04:00:00Z", 22, 9)).toBe(false)
  })

  it("returns false when start === end", () => {
    expect(computeInBusinessHours(new Date(), "Asia/Shanghai", 9, 9)).toBe(false)
  })
})

describe("formatBusinessHoursHint", () => {
  const base = { timezone: SH }

  it("full week → 每天", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 9, end: 22, weekdays: [0, 1, 2, 3, 4, 5, 6] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：9:00–22:00（每天）")
  })

  it("Mon–Fri contiguous run", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 9, end: 18, weekdays: [1, 2, 3, 4, 5] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：9:00–18:00（周一至周五）")
  })

  it("Mon–Sat contiguous run", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 10, end: 22, weekdays: [1, 2, 3, 4, 5, 6] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：10:00–22:00（周一至周六）")
  })

  it("cross-night window labels as 次日", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 22, end: 9, weekdays: [0, 1, 2, 3, 4, 5, 6] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：22:00–次日 9:00（每天）")
  })

  it("non-contiguous weekdays joined with 、", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 9, end: 17, weekdays: [1, 3, 5] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：9:00–17:00（周一、周三、周五）")
  })

  it("includes Sunday at tail (Mon–Sun → 每天)", () => {
    const cfg: BusinessHoursConfig = { ...base, start: 9, end: 21, weekdays: [1, 2, 3, 4, 5, 6, 0] }
    expect(formatBusinessHoursHint(cfg)).toBe("工作时间：9:00–21:00（每天）")
  })
})
