import { parseFulfillmentFilters } from "@/app/admin/(main)/fulfillment/fulfillment-filters"

describe("parseFulfillmentFilters", () => {
  it("defaults to in_progress (AWAITING + PROCESSING) when status missing", () => {
    const f = parseFulfillmentFilters({})
    expect(f.status).toBe("in_progress")
    expect(f.statusList).toEqual(["AWAITING_FULFILLMENT", "PROCESSING"])
    expect(f.dunnedOnly).toBe(false)
  })

  it("maps single-status filters to a single-element list", () => {
    expect(parseFulfillmentFilters({ status: "awaiting" }).statusList).toEqual([
      "AWAITING_FULFILLMENT",
    ])
    expect(parseFulfillmentFilters({ status: "processing" }).statusList).toEqual([
      "PROCESSING",
    ])
    expect(parseFulfillmentFilters({ status: "completed" }).statusList).toEqual([
      "COMPLETED",
    ])
    expect(parseFulfillmentFilters({ status: "closed" }).statusList).toEqual([
      "CLOSED",
    ])
  })

  it("returns an empty status list (no status filter) when status=all", () => {
    expect(parseFulfillmentFilters({ status: "all" }).statusList).toEqual([])
  })

  it("falls back to in_progress for unknown status values", () => {
    expect(parseFulfillmentFilters({ status: "garbage" }).status).toBe("in_progress")
  })

  it("treats dunnedOnly=true (case-insensitive) as enabled", () => {
    expect(parseFulfillmentFilters({ dunnedOnly: "true" }).dunnedOnly).toBe(true)
    expect(parseFulfillmentFilters({ dunnedOnly: "TRUE" }).dunnedOnly).toBe(true)
    expect(parseFulfillmentFilters({ dunnedOnly: "1" }).dunnedOnly).toBe(false)
    expect(parseFulfillmentFilters({ dunnedOnly: "" }).dunnedOnly).toBe(false)
  })
})
