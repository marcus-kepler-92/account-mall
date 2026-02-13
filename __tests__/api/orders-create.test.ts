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

// Mock uuid before importing the route
jest.mock("uuid", () => ({
  __esModule: true,
  v4: jest.fn(() => "550e8400-e29b-41d4-a716-446655440000"),
}))

import { generateOrderNo } from "@/app/api/orders/route"

describe("generateOrderNo", () => {
  it("generates UUID v4 format order number", () => {
    const orderNo = generateOrderNo()

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(orderNo).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it("generates unique order numbers on each call", () => {
    const orderNo1 = generateOrderNo()
    const orderNo2 = generateOrderNo()

    // UUIDs should be unique
    expect(orderNo1).not.toBe(orderNo2)
    expect(orderNo1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(orderNo2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})

