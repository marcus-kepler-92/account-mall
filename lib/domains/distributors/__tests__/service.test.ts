jest.mock("../repository")
jest.mock("../milestone-service", () => ({
  checkAndIssueMilestoneBonuses: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("@/lib/send-distributor-invitation", () => ({
  sendDistributorInvitation: jest.fn(),
}))
jest.mock("@/lib/config", () => ({
  getConfig: jest.fn(() => ({ level2CommissionRatePercent: 20 })),
  config: {
    distributorInviteTtlDays: 7,
    siteUrl: "https://example.com",
    siteName: "TestShop",
    nodeEnv: "test",
    withdrawalFeePercent: 2,
    withdrawalMinAmount: 10,
    basePromoDiscountPercent: 5,
    level2CommissionRatePercent: 20,
  },
}))
jest.mock("@/lib/email", () => ({ sendMail: jest.fn() }))
jest.mock("@react-email/render", () => ({ render: jest.fn().mockResolvedValue("<html/>") }))
jest.mock("@/app/emails/distributor-invitation", () => ({ DistributorInvitation: "div" }))
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

import * as repo from "../repository"
import { checkAndIssueMilestoneBonuses } from "../milestone-service"
import { prismaMock } from "../../../../__mocks__/prisma"
import {
  updateDistributor,
  deleteDistributor,
  resetDistributorPassword,
  processWithdrawal,
  createWithdrawal,
  createCommissionTier,
  createOrderCommissions,
  acceptInvite,
  reassignOrderDistributor,
} from "../service"
import {
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  NoCredentialAccountError,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenExhaustedError,
  InviteTokenExpiredError,
  InviteTokenConcurrentAcceptError,
} from "../types"

const checkMilestoneMock = checkAndIssueMilestoneBonuses as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
})

// ── updateDistributor ─────────────────────────────────────────────────────────

describe("updateDistributor", () => {
  it("throws DistributorNotFoundError when distributor does not exist", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue(null)
    await expect(updateDistributor("d1", { disabled: true })).rejects.toThrow(DistributorNotFoundError)
  })

  it("sets disabledAt when disabled=true", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    ;(repo.updateDistributorData as jest.Mock).mockResolvedValue({ id: "d1", discountPercent: null })
    await updateDistributor("d1", { disabled: true })
    const callData = (repo.updateDistributorData as jest.Mock).mock.calls[0][1]
    expect(callData.disabledAt).toBeInstanceOf(Date)
  })

  it("clears disabledAt when disabled=false", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.updateDistributorData as jest.Mock).mockResolvedValue({ id: "d1", discountPercent: null })
    await updateDistributor("d1", { disabled: false })
    const callData = (repo.updateDistributorData as jest.Mock).mock.calls[0][1]
    expect(callData.disabledAt).toBeNull()
  })
})

// ── deleteDistributor ─────────────────────────────────────────────────────────

describe("deleteDistributor", () => {
  it("throws DistributorNotFoundError when not found", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue(null)
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorNotFoundError)
  })

  it("throws DistributorNotDisabledError when still active", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorNotDisabledError)
  })

  it("throws DistributorHasAssociationsError when has orders", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.countDistributorOrders as jest.Mock).mockResolvedValue(1)
    ;(repo.countDistributorCommissions as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorWithdrawals as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorInvitees as jest.Mock).mockResolvedValue(0)
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorHasAssociationsError)
  })

  it("deletes invitations and user when all checks pass", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.countDistributorOrders as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorCommissions as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorWithdrawals as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorInvitees as jest.Mock).mockResolvedValue(0)
    ;(repo.deleteDistributorInvitations as jest.Mock).mockResolvedValue({ count: 0 })
    ;(repo.deleteDistributorRecord as jest.Mock).mockResolvedValue({})
    await deleteDistributor("d1")
    expect(repo.deleteDistributorInvitations).toHaveBeenCalledWith("d1")
    expect(repo.deleteDistributorRecord).toHaveBeenCalledWith("d1")
  })
})

// ── resetDistributorPassword ──────────────────────────────────────────────────

describe("resetDistributorPassword", () => {
  it("throws DistributorNotFoundError when not found", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue(null)
    await expect(resetDistributorPassword("d1")).rejects.toThrow(DistributorNotFoundError)
  })

  it("throws NoCredentialAccountError when no credential account exists", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    prismaMock.account.updateMany.mockResolvedValue({ count: 0 })
    await expect(resetDistributorPassword("d1")).rejects.toThrow(NoCredentialAccountError)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("updates credential password, sets mustChangePassword, returns plaintext", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    prismaMock.account.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.update.mockResolvedValue({ id: "d1" } as never)

    const password = await resetDistributorPassword("d1")

    expect(password).toHaveLength(16)
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { userId: "d1", providerId: "credential" },
      data: { password: "hashed" },
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { mustChangePassword: true },
    })
  })
})

// ── processWithdrawal ─────────────────────────────────────────────────────────

describe("processWithdrawal", () => {
  it("throws WithdrawalNotFoundError when not found", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue(null)
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalNotFoundError)
  })

  it("throws WithdrawalNotPendingError when already processed", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PAID", distributorId: "d1", amount: 100 })
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalNotPendingError)
  })

  it("throws WithdrawalOverBalanceError when marking PAID with insufficient balance", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PENDING", distributorId: "d1", amount: 200 })
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(100)
    ;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(80)
    ;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)
    // available = 100 + 0 - 80 = 20; amount = 200 → over
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalOverBalanceError)
  })

  it("updates withdrawal when PENDING with sufficient balance", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PENDING", distributorId: "d1", amount: 50 })
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(200)
    ;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(0)
    ;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)
    ;(repo.updateWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: { toNumber: () => 50 },
      feeAmount: 1,
      feePercent: 2,
      status: "PAID",
      note: null,
      processedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      distributorId: "d1",
      distributor: { id: "d1", email: "a@b.com", name: null },
      receiptImageUrl: null,
    })
    const result = await processWithdrawal("w1", { status: "PAID" })
    expect(result.status).toBe("PAID")
    expect(repo.updateWithdrawalRecord).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ status: "PAID", processedAt: expect.any(Date) }),
      prismaMock,
    )
  })

  it("does not check balance when marking REJECTED", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PENDING", distributorId: "d1", amount: 999 })
    ;(repo.updateWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: { toNumber: () => 999 },
      feeAmount: 0,
      feePercent: 0,
      status: "REJECTED",
      note: null,
      processedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      distributorId: "d1",
      distributor: { id: "d1", email: "a@b.com", name: null },
      receiptImageUrl: null,
    })
    await processWithdrawal("w1", { status: "REJECTED" })
    expect(repo.aggregateCommissionSum).not.toHaveBeenCalled()
  })
})

// ── createWithdrawal ──────────────────────────────────────────────────────────

describe("createWithdrawal", () => {
  it("throws WithdrawalOverBalanceError when amount exceeds balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(50)
    ;(repo.aggregateWithdrawalSum as jest.Mock)
      .mockResolvedValueOnce(40) // PAID
      .mockResolvedValueOnce(0)  // PENDING
    ;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)
    // balance = 50 + 0 - 40 - 0 = 10; withdraw 20 → over
    await expect(
      createWithdrawal("d1", 20, 2, "https://img.url/receipt.png"),
    ).rejects.toThrow(WithdrawalOverBalanceError)
  })

  it("creates withdrawal when amount is within balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(100)
    ;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(0)
    ;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)
    ;(repo.createWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: 50,
      feePercent: 2,
      feeAmount: 1,
      status: "PENDING",
      receiptImageUrl: "https://img.url/receipt.png",
      createdAt: new Date(),
      note: null,
      processedAt: null,
    })
    const result = await createWithdrawal("d1", 50, 2, "https://img.url/receipt.png")
    expect(result.id).toBe("w1")
    expect(repo.createWithdrawalRecord).toHaveBeenCalledWith(
      expect.objectContaining({ distributorId: "d1", amount: 50, feePercent: 2 }),
      prismaMock,
    )
  })
})

// ── createCommissionTier ──────────────────────────────────────────────────────

describe("createCommissionTier", () => {
  it("throws TierRangeError when minAmount >= maxAmount", async () => {
    await expect(
      createCommissionTier({ minAmount: 100, maxAmount: 50, ratePercent: 5 }),
    ).rejects.toThrow(TierRangeError)
  })

  it("auto-assigns next sortOrder when not provided", async () => {
    ;(repo.aggregateMaxTierSortOrder as jest.Mock).mockResolvedValue(2)
    ;(repo.createTierRecord as jest.Mock).mockResolvedValue({
      id: "t1",
      minAmount: 0,
      maxAmount: 100,
      ratePercent: 5,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await createCommissionTier({ minAmount: 0, maxAmount: 100, ratePercent: 5 })
    expect(repo.createTierRecord).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 3 }),
    )
  })
})

// ── createOrderCommissions — tier fallback ────────────────────────────────────

describe("createOrderCommissions — tier fallback", () => {
  it("uses the highest-rate tier when weekTotal exceeds all maxAmounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com", inviterId: null } as any)
    prismaMock.order.findMany.mockResolvedValue([{ amount: 10000 }] as any) // weekTotal = 10000
    prismaMock.commissionTier.findMany.mockResolvedValue([
      { minAmount: 0, maxAmount: 1000, ratePercent: 5, sortOrder: 1 },
      { minAmount: 1000, maxAmount: 5000, ratePercent: 10, sortOrder: 2 }, // 10000 exceeds maxAmount=5000
    ] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)

    await createOrderCommissions(prismaMock as any, {
      orderId: "ord1",
      distributorId: "dist1",
      orderEmail: "buyer@example.com",
      orderAmount: 100 as any,
      discountPercentApplied: 0,
      paidAt: new Date(),
      commissionMode: "GLOBAL",
      commissionValue: null,
      quantity: 1,
    })

    expect(prismaMock.commission.create).toHaveBeenCalledTimes(1)
    // highest tier ratePercent=10: amount = 100 * 10 / 100 = 10
    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 10 }) }),
    )
  })
})

// ── createOrderCommissions — per-product modes ────────────────────────────────

describe("createOrderCommissions — commission modes", () => {
  const baseMocks = () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com", inviterId: null } as any)
    prismaMock.order.findMany.mockResolvedValue([] as any)
    prismaMock.commissionTier.findMany.mockResolvedValue([] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)
  }

  it("FIXED_PERCENT: commission = value% of paid amount, independent of tiers", async () => {
    baseMocks()
    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 100 as any, discountPercentApplied: 0, paidAt: new Date(),
      commissionMode: "FIXED_PERCENT", commissionValue: 20, quantity: 1,
    })
    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 20 }) }),
    )
  })

  it("FIXED_AMOUNT: commission = value × quantity, independent of paid amount/discount", async () => {
    baseMocks()
    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 999 as any, discountPercentApplied: 50, paidAt: new Date(),
      commissionMode: "FIXED_AMOUNT", commissionValue: 5, quantity: 3,
    })
    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 15 }) }),
    )
  })

  it("NONE: creates no commission and returns early", async () => {
    baseMocks()
    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 100 as any, discountPercentApplied: 0, paidAt: new Date(),
      commissionMode: "NONE", commissionValue: null, quantity: 1,
    })
    expect(prismaMock.commission.create).not.toHaveBeenCalled()
  })

  it("FIXED_PERCENT with inviter: splits level1/level2 off the fixed total", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ email: "dist@example.com", inviterId: "inv1" } as any)
      .mockResolvedValueOnce({ email: "inviter@example.com", role: "DISTRIBUTOR", disabledAt: null } as any)
    prismaMock.order.findMany.mockResolvedValue([] as any)
    prismaMock.commissionTier.findMany.mockResolvedValue([] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)

    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 100 as any, discountPercentApplied: 0, paidAt: new Date(),
      commissionMode: "FIXED_PERCENT", commissionValue: 20, quantity: 1,
    })

    // total = 100 × 20% = 20; level2 = 20 × 20% = 4; level1 = 16
    const calls = prismaMock.commission.create.mock.calls
    expect(calls.length).toBe(2)
    const level1 = calls.find((c) => c[0].data.level === 1)?.[0].data
    const level2 = calls.find((c) => c[0].data.level === 2)?.[0].data
    expect(level1.amount).toBe(16)
    expect(level1.distributorId).toBe("d1")
    expect(level2.amount).toBe(4)
    expect(level2.distributorId).toBe("inv1")
    expect(level2.sourceDistributorId).toBe("d1")
  })

  it("FIXED_AMOUNT with inviter: splits level1/level2 off value × quantity", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ email: "dist@example.com", inviterId: "inv1" } as any)
      .mockResolvedValueOnce({ email: "inviter@example.com", role: "DISTRIBUTOR", disabledAt: null } as any)
    prismaMock.order.findMany.mockResolvedValue([] as any)
    prismaMock.commissionTier.findMany.mockResolvedValue([] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)

    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 999 as any, discountPercentApplied: 0, paidAt: new Date(),
      commissionMode: "FIXED_AMOUNT", commissionValue: 10, quantity: 3,
    })

    // total = 10 × 3 = 30; level2 = 6; level1 = 24
    const calls = prismaMock.commission.create.mock.calls
    expect(calls.length).toBe(2)
    const level1 = calls.find((c) => c[0].data.level === 1)?.[0].data
    const level2 = calls.find((c) => c[0].data.level === 2)?.[0].data
    expect(level1.amount).toBe(24)
    expect(level2.amount).toBe(6)
    expect(level2.distributorId).toBe("inv1")
  })

  it("GLOBAL: selects tier by weekTotal (normal match, not fallback) — regression guard", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com", inviterId: null } as any)
    prismaMock.order.findMany.mockResolvedValue([{ amount: 500 }] as any) // weekTotal = 500
    prismaMock.commissionTier.findMany.mockResolvedValue([
      { minAmount: 0, maxAmount: 800, ratePercent: 52, sortOrder: 1 },
      { minAmount: 800, maxAmount: 2400, ratePercent: 59, sortOrder: 2 },
    ] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)

    await createOrderCommissions(prismaMock as any, {
      orderId: "o1", distributorId: "d1", orderEmail: "buyer@example.com",
      orderAmount: 100 as any, discountPercentApplied: 0, paidAt: new Date(),
      commissionMode: "GLOBAL", commissionValue: null, quantity: 1,
    })

    // weekTotal 500 → tier [0,800] = 52%; 100 × 52% = 52
    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 52 }) }),
    )
  })
})

// ── acceptInvite ──────────────────────────────────────────────────────────────

describe("acceptInvite", () => {
  it("throws InviteTokenNotFoundError when token missing", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue(null)
    await expect(
      acceptInvite("bad-token", { token: "bad-token", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenNotFoundError)
  })

  it("throws InviteTokenExhaustedError when invite link is exhausted", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      maxUses: 1,
      usedCount: 1,
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenExhaustedError)
  })

  it("throws InviteTokenExpiredError when past expiry", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      maxUses: 1,
      usedCount: 0,
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenExpiredError)
  })

  it("proceeds when maxUses=2 and usedCount=1 (slot still available)", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
      maxUses: 2,
      usedCount: 1,
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    ;(repo.findUserByEmail as jest.Mock).mockResolvedValue(null)
    ;(repo.claimInvitation as jest.Mock).mockResolvedValue(1)
    ;(repo.createDistributorUser as jest.Mock).mockResolvedValue({ id: "new_user" })

    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).resolves.not.toThrow()
    expect(repo.claimInvitation).toHaveBeenCalled()
  })

  it("throws InviteTokenConcurrentAcceptError when token already claimed by concurrent request", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 10000),
      maxUses: 1,
      usedCount: 0,
      email: "a@b.com",
      inviterId: "inviter1",
      inviter: { role: "DISTRIBUTOR" },
    })
    ;(repo.findUserByEmail as jest.Mock).mockResolvedValue(null)
    ;(repo.claimInvitation as jest.Mock).mockResolvedValue(0) // concurrent request already claimed

    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenConcurrentAcceptError)
    expect(repo.createDistributorUser).not.toHaveBeenCalled()
  })
})

// ── acceptInvite — invitation milestone check ─────────────────────────────────

describe("acceptInvite - invitation milestone check", () => {
  const validInvitation = {
    token: "tok",
    acceptedAt: null,
    expiresAt: new Date(Date.now() + 10000),
    maxUses: 1,
    usedCount: 0,
    email: "newuser@b.com",
    inviterId: "inviter1",
    inviter: { role: "DISTRIBUTOR" },
  }

  beforeEach(() => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue(validInvitation)
    ;(repo.findUserByEmail as jest.Mock).mockResolvedValue(null)
    ;(repo.claimInvitation as jest.Mock).mockResolvedValue(1)
    ;(repo.createDistributorUser as jest.Mock).mockResolvedValue({ id: "new_user" })
    ;(repo.createAccountRecord as jest.Mock).mockResolvedValue({})
  })

  it("does NOT call checkAndIssueMilestoneBonuses on acceptInvite (milestone check happens at order completion)", async () => {
    await acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" })

    expect(checkMilestoneMock).not.toHaveBeenCalled()
  })
})

// ── reassignOrderDistributor ──────────────────────────────────────────────────

describe("reassignOrderDistributor", () => {
  const paidAt = new Date("2026-04-15T06:56:24.961Z")

  beforeEach(() => {
    ;(repo.findOrderById as jest.Mock).mockResolvedValue({
      id: "ord1",
      status: "COMPLETED",
      amount: 100,
      email: "buyer@example.com",
      distributorId: null,
      discountPercentApplied: null,
      paidAt,
    })
    ;(repo.findUserById as jest.Mock).mockResolvedValue({ id: "dist1", role: "DISTRIBUTOR" })
    ;(repo.countWithdrawnCommissions as jest.Mock).mockResolvedValue(0)
    ;(repo.findOrderCommissions as jest.Mock).mockResolvedValue([])
    ;(repo.cancelOrderCommissions as jest.Mock).mockResolvedValue(undefined)
    ;(repo.updateOrderDistributor as jest.Mock).mockResolvedValue(undefined)

    prismaMock.$transaction.mockImplementation(
      (async (fn: (tx: any) => Promise<void>) => fn(prismaMock)) as any,
    )
    prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com", inviterId: null } as any)
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.commissionTier.findMany.mockResolvedValue([
      { minAmount: 0, maxAmount: 999999, ratePercent: 10 },
    ] as any)
    prismaMock.commission.create.mockResolvedValue({} as any)
  })

  it("commission.createdAt equals order.paidAt when reassigning a historical order", async () => {
    await reassignOrderDistributor("ord1", "dist1")

    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdAt: paidAt,
          status: "SETTLED",
        }),
      }),
    )
  })

  it("both level-1 and level-2 commissions use order.paidAt as createdAt", async () => {
    ;(repo.findUserById as jest.Mock).mockResolvedValue({ id: "dist1", role: "DISTRIBUTOR" })
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ email: "dist@example.com", inviterId: "inviter1" } as any)
      .mockResolvedValueOnce({ email: "inviter@example.com", role: "DISTRIBUTOR", disabledAt: null } as any)

    await reassignOrderDistributor("ord1", "dist1")

    const calls = prismaMock.commission.create.mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const [arg] of calls) {
      expect(arg.data.createdAt).toEqual(paidAt)
    }
  })

  it("calls checkAndIssueMilestoneBonuses with tx and new distributorId after commission creation", async () => {
    await reassignOrderDistributor("ord1", "dist1")

    expect(checkMilestoneMock).toHaveBeenCalledTimes(1)
    expect(checkMilestoneMock).toHaveBeenCalledWith(prismaMock, "dist1")
  })

  it("does NOT call checkAndIssueMilestoneBonuses when distributorId is null", async () => {
    await reassignOrderDistributor("ord1", null)

    expect(checkMilestoneMock).not.toHaveBeenCalled()
  })
})
