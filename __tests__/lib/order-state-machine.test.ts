import { canTransition, assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"

describe("order state machine", () => {
  it("allows PENDING → COMPLETED for NORMAL/AUTO_FETCH only", () => {
    expect(canTransition("PENDING", "COMPLETED", "NORMAL")).toBe(true)
    expect(canTransition("PENDING", "COMPLETED", "AUTO_FETCH")).toBe(true)
    expect(canTransition("PENDING", "COMPLETED", "MANUAL")).toBe(false)
  })

  it("allows PENDING → AWAITING_FULFILLMENT for MANUAL only", () => {
    expect(canTransition("PENDING", "AWAITING_FULFILLMENT", "MANUAL")).toBe(true)
    expect(canTransition("PENDING", "AWAITING_FULFILLMENT", "NORMAL")).toBe(false)
  })

  it("allows AWAITING_FULFILLMENT → COMPLETED (skip PROCESSING)", () => {
    expect(canTransition("AWAITING_FULFILLMENT", "COMPLETED", "MANUAL")).toBe(true)
  })

  it("allows AWAITING_FULFILLMENT → PROCESSING and PROCESSING → COMPLETED", () => {
    expect(canTransition("AWAITING_FULFILLMENT", "PROCESSING", "MANUAL")).toBe(true)
    expect(canTransition("PROCESSING", "COMPLETED", "MANUAL")).toBe(true)
  })

  it("allows CLOSED from PENDING/AWAITING_FULFILLMENT/PROCESSING", () => {
    expect(canTransition("PENDING", "CLOSED", "NORMAL")).toBe(true)
    expect(canTransition("AWAITING_FULFILLMENT", "CLOSED", "MANUAL")).toBe(true)
    expect(canTransition("PROCESSING", "CLOSED", "MANUAL")).toBe(true)
  })

  it("rejects COMPLETED → anything and CLOSED → anything", () => {
    expect(canTransition("COMPLETED", "PROCESSING", "MANUAL")).toBe(false)
    expect(canTransition("CLOSED", "PENDING", "MANUAL")).toBe(false)
  })

  it("assertTransition throws InvalidTransitionError on illegal", () => {
    expect(() => assertTransition("COMPLETED", "PENDING", "NORMAL")).toThrow(InvalidTransitionError)
  })

  it("assertTransition no-throw on legal", () => {
    expect(() => assertTransition("PENDING", "COMPLETED", "NORMAL")).not.toThrow()
  })
})
