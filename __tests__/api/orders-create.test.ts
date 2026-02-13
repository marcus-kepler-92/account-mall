jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}))

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {},
}))

import { getNextOrderNo } from "@/app/api/orders/route"

describe("getNextOrderNo", () => {
  it("generates FAKYYYYMMDD prefix with 5-digit sequence when no last order", () => {
    const prefix = "FAK20240213"
    const orderNo = getNextOrderNo(prefix, null)

    expect(orderNo.startsWith(prefix)).toBe(true)
    const suffix = orderNo.slice(prefix.length)
    expect(suffix).toBe("00001")
  })

  it("increments sequence based on lastOrder orderNo suffix", () => {
    const prefix = "FAK20240213"
    const lastOrderNo = "FAK2024021300009"

    const orderNo = getNextOrderNo(prefix, lastOrderNo)

    expect(orderNo.startsWith(prefix)).toBe(true)
    const suffix = orderNo.slice(prefix.length)
    expect(suffix).toBe("00010")
  })
})

