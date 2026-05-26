import { parseFulfillmentFilters } from "@/app/admin/(main)/fulfillment/fulfillment-filters"

describe("parseFulfillmentFilters", () => {
  it("defaults to empty status (no filter) when status missing", () => {
    const f = parseFulfillmentFilters({})
    expect(f.status).toBe("")
    expect(f.statusList).toEqual([])
    expect(f.dunnedOnly).toBe(false)
    expect(f.page).toBe(1)
    expect(f.pageSize).toBe(20)
  })

  it("maps single OrderStatus enum filters to a single-element list", () => {
    expect(parseFulfillmentFilters({ status: "AWAITING_FULFILLMENT" }).statusList).toEqual([
      "AWAITING_FULFILLMENT",
    ])
    expect(parseFulfillmentFilters({ status: "PROCESSING" }).statusList).toEqual([
      "PROCESSING",
    ])
    expect(parseFulfillmentFilters({ status: "COMPLETED" }).statusList).toEqual([
      "COMPLETED",
    ])
    expect(parseFulfillmentFilters({ status: "CLOSED" }).statusList).toEqual([
      "CLOSED",
    ])
  })

  it("falls back to empty status for unknown values (no filter)", () => {
    expect(parseFulfillmentFilters({ status: "garbage" }).status).toBe("")
    expect(parseFulfillmentFilters({ status: "PENDING" }).status).toBe("")
  })

  it("treats dunnedOnly=true (case-insensitive) as enabled", () => {
    expect(parseFulfillmentFilters({ dunnedOnly: "true" }).dunnedOnly).toBe(true)
    expect(parseFulfillmentFilters({ dunnedOnly: "TRUE" }).dunnedOnly).toBe(true)
    expect(parseFulfillmentFilters({ dunnedOnly: "1" }).dunnedOnly).toBe(false)
    expect(parseFulfillmentFilters({ dunnedOnly: "" }).dunnedOnly).toBe(false)
  })

  it("clamps page to >=1 and pageSize to 1..100", () => {
    expect(parseFulfillmentFilters({ page: "0" }).page).toBe(1)
    expect(parseFulfillmentFilters({ page: "-5" }).page).toBe(1)
    expect(parseFulfillmentFilters({ page: "3" }).page).toBe(3)
    expect(parseFulfillmentFilters({ pageSize: "200" }).pageSize).toBe(100)
    expect(parseFulfillmentFilters({ pageSize: "10" }).pageSize).toBe(10)
    expect(parseFulfillmentFilters({ pageSize: "0" }).pageSize).toBe(20)
  })
})
