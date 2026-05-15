import { Prisma } from "@prisma/client"
import { resolveOrderCost } from "@/lib/profit"

describe("resolveOrderCost", () => {
  it("prefers costTotalSnapshot when present", () => {
    expect(
      resolveOrderCost({
        costTotalSnapshot: new Prisma.Decimal("12.50"),
        costSnapshot: new Prisma.Decimal("999.00"), // intentionally garbage
        quantity: 4,
      }),
    ).toEqual({ cost: 12.5, hasCost: true })
  })

  it("falls back to costSnapshot × quantity for legacy orders", () => {
    expect(
      resolveOrderCost({
        costTotalSnapshot: null,
        costSnapshot: new Prisma.Decimal("3.00"),
        quantity: 4,
      }),
    ).toEqual({ cost: 12, hasCost: true })
  })

  it("returns zero cost + hasCost=false when both snapshots are null", () => {
    expect(
      resolveOrderCost({
        costTotalSnapshot: null,
        costSnapshot: null,
        quantity: 2,
      }),
    ).toEqual({ cost: 0, hasCost: false })
  })

  it("treats costTotalSnapshot=0 as recorded cost (AUTO_FETCH), not missing", () => {
    expect(
      resolveOrderCost({
        costTotalSnapshot: new Prisma.Decimal("0"),
        costSnapshot: null,
        quantity: 1,
      }),
    ).toEqual({ cost: 0, hasCost: true })
  })

  it("treats costSnapshot=0 as recorded cost when costTotalSnapshot is null", () => {
    expect(
      resolveOrderCost({
        costTotalSnapshot: null,
        costSnapshot: new Prisma.Decimal("0"),
        quantity: 3,
      }),
    ).toEqual({ cost: 0, hasCost: true })
  })
})
