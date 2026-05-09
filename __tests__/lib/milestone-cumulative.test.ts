import { buildMilestoneCumulativeMap } from "@/lib/milestone-cumulative"

describe("buildMilestoneCumulativeMap", () => {
  it("sums order amounts per invitee", () => {
    const orders = [
      { distributorId: "a", amount: 100, email: "buyer1@x.com" },
      { distributorId: "a", amount: 50, email: "buyer2@x.com" },
      { distributorId: "b", amount: 200, email: "buyer3@x.com" },
    ]
    const invitees = [
      { id: "a", email: "invitee-a@x.com" },
      { id: "b", email: "invitee-b@x.com" },
    ]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBe(150)
    expect(result.get("b")).toBe(200)
  })

  it("excludes self-purchases (exact email match)", () => {
    const orders = [
      { distributorId: "a", amount: 100, email: "invitee-a@x.com" },
      { distributorId: "a", amount: 50, email: "someone-else@x.com" },
    ]
    const invitees = [{ id: "a", email: "invitee-a@x.com" }]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBe(50)
  })

  it("does case-insensitive email comparison", () => {
    const orders = [
      { distributorId: "a", amount: 100, email: "INVITEE-A@X.COM" },
      { distributorId: "a", amount: 30, email: "buyer@x.com" },
    ]
    const invitees = [{ id: "a", email: "invitee-a@x.com" }]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBe(30)
  })

  it("counts all orders for invitees with null email (username-only)", () => {
    const orders = [
      { distributorId: "a", amount: 100, email: "buyer@x.com" },
      { distributorId: "a", amount: 80, email: "another@x.com" },
    ]
    const invitees = [{ id: "a", email: null }]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBe(180)
  })

  it("skips orders with null distributorId", () => {
    const orders = [
      { distributorId: null, amount: 999, email: "buyer@x.com" },
      { distributorId: "a", amount: 50, email: "buyer@x.com" },
    ]
    const invitees = [{ id: "a", email: "invitee@x.com" }]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBe(50)
    expect(result.size).toBe(1)
  })

  it("returns empty map when there are no orders", () => {
    const result = buildMilestoneCumulativeMap([], [{ id: "a", email: "a@x.com" }])
    expect(result.size).toBe(0)
  })

  it("handles amount as string or Decimal-like (coerced via Number())", () => {
    const orders = [
      { distributorId: "a", amount: "123.45" as unknown, email: "buyer@x.com" },
    ]
    const invitees = [{ id: "a", email: "invitee@x.com" }]
    const result = buildMilestoneCumulativeMap(orders, invitees)
    expect(result.get("a")).toBeCloseTo(123.45)
  })
})
