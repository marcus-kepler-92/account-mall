jest.mock("nuqs", () => ({
  parseAsString: jest.fn(),
}))

import { parseSortingState, encodeSortingState, parseServerSort } from "@/lib/table-sort"

describe("parseSortingState", () => {
  const defaults = { sort: "createdAt", sortDir: "desc" as const }

  it("returns default SortingState when both params are null", () => {
    expect(parseSortingState(null, null, defaults)).toEqual([{ id: "createdAt", desc: true }])
  })

  it("returns default SortingState when params are empty strings", () => {
    expect(parseSortingState("", "", defaults)).toEqual([{ id: "createdAt", desc: true }])
  })

  it("parses valid sort + asc sortDir", () => {
    expect(parseSortingState("amount", "asc", defaults)).toEqual([{ id: "amount", desc: false }])
  })

  it("parses valid sort + desc sortDir", () => {
    expect(parseSortingState("amount", "desc", defaults)).toEqual([{ id: "amount", desc: true }])
  })

  it("falls back to default sortDir when sortDir is invalid", () => {
    expect(parseSortingState("amount", "random", defaults)).toEqual([{ id: "amount", desc: true }])
  })

  it("uses provided sort when valid, even if same as default", () => {
    expect(parseSortingState("createdAt", "asc", defaults)).toEqual([{ id: "createdAt", desc: false }])
  })
})

describe("encodeSortingState", () => {
  const defaults = { sort: "createdAt", sortDir: "desc" as const }

  it("returns null params when sorting matches defaults exactly", () => {
    expect(encodeSortingState([{ id: "createdAt", desc: true }], defaults)).toEqual({
      sort: null,
      sortDir: null,
    })
  })

  it("returns null params when sorting array is empty", () => {
    expect(encodeSortingState([], defaults)).toEqual({ sort: null, sortDir: null })
  })

  it("encodes non-default column", () => {
    expect(encodeSortingState([{ id: "amount", desc: false }], defaults)).toEqual({
      sort: "amount",
      sortDir: "asc",
    })
  })

  it("encodes same column with non-default direction", () => {
    expect(encodeSortingState([{ id: "createdAt", desc: false }], defaults)).toEqual({
      sort: "createdAt",
      sortDir: "asc",
    })
  })

  it("encodes non-default column with default direction", () => {
    expect(encodeSortingState([{ id: "amount", desc: true }], defaults)).toEqual({
      sort: "amount",
      sortDir: "desc",
    })
  })
})

describe("parseServerSort", () => {
  const allowed = ["createdAt", "amount", "quantity"] as const
  const defaults = { sort: "createdAt" as const, sortDir: "desc" as const }

  it("returns default orderBy when sort is null", () => {
    expect(parseServerSort(null, null, allowed, defaults)).toEqual({ orderBy: { createdAt: "desc" } })
  })

  it("returns default orderBy when sort is empty string", () => {
    expect(parseServerSort("", "asc", allowed, defaults)).toEqual({ orderBy: { createdAt: "asc" } })
  })

  it("returns correct orderBy for valid column + asc", () => {
    expect(parseServerSort("amount", "asc", allowed, defaults)).toEqual({ orderBy: { amount: "asc" } })
  })

  it("returns correct orderBy for valid column + desc", () => {
    expect(parseServerSort("quantity", "desc", allowed, defaults)).toEqual({ orderBy: { quantity: "desc" } })
  })

  it("falls back to default column when column is not in whitelist", () => {
    expect(parseServerSort("injected_field", "asc", allowed, defaults)).toEqual({
      orderBy: { createdAt: "asc" },
    })
  })

  it("falls back to default sortDir when dir is invalid", () => {
    expect(parseServerSort("amount", "invalid", allowed, defaults)).toEqual({
      orderBy: { amount: "desc" },
    })
  })

  it("handles SQL injection attempt in column name", () => {
    expect(parseServerSort("createdAt; DROP TABLE", "asc", allowed, defaults)).toEqual({
      orderBy: { createdAt: "asc" },
    })
  })
})
