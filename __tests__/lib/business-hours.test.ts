import { computeInBusinessHours } from "@/lib/business-hours"

describe("computeInBusinessHours (9-22 Asia/Shanghai)", () => {
  const tz = "Asia/Shanghai"
  const check = (iso: string, start: number, end: number) =>
    computeInBusinessHours(new Date(iso), tz, start, end)

  it("returns true at 10:00 Shanghai (default 9-22)", () => {
    expect(check("2026-05-19T02:00:00Z", 9, 22)).toBe(true)  // Shanghai 10:00
  })

  it("returns false at 23:00 Shanghai", () => {
    expect(check("2026-05-19T15:00:00Z", 9, 22)).toBe(false)  // Shanghai 23:00
  })

  it("returns false at 05:00 Shanghai", () => {
    expect(check("2026-05-18T21:00:00Z", 9, 22)).toBe(false)  // Shanghai 05:00
  })

  it("returns true at 09:00 Shanghai (start boundary, inclusive)", () => {
    expect(check("2026-05-19T01:00:00Z", 9, 22)).toBe(true)  // Shanghai 09:00
  })

  it("returns false at 22:00 Shanghai (end boundary, exclusive)", () => {
    expect(check("2026-05-19T14:00:00Z", 9, 22)).toBe(false)  // Shanghai 22:00
  })
})

describe("computeInBusinessHours — overnight window (22-9)", () => {
  const tz = "Asia/Shanghai"
  const check = (iso: string, start: number, end: number) =>
    computeInBusinessHours(new Date(iso), tz, start, end)

  it("returns true at 23:00 Shanghai (within overnight)", () => {
    expect(check("2026-05-19T15:00:00Z", 22, 9)).toBe(true)  // Shanghai 23:00
  })

  it("returns true at 02:00 Shanghai (within overnight)", () => {
    expect(check("2026-05-19T18:00:00Z", 22, 9)).toBe(true)  // Shanghai 02:00
  })

  it("returns false at 12:00 Shanghai (outside overnight)", () => {
    expect(check("2026-05-19T04:00:00Z", 22, 9)).toBe(false)  // Shanghai 12:00
  })

  it("returns false at 09:00 Shanghai (end boundary exclusive)", () => {
    expect(check("2026-05-19T01:00:00Z", 22, 9)).toBe(false)  // Shanghai 09:00
  })
})

describe("computeInBusinessHours — degenerate", () => {
  it("returns false when start === end", () => {
    expect(computeInBusinessHours(new Date(), "Asia/Shanghai", 9, 9)).toBe(false)
  })
})
