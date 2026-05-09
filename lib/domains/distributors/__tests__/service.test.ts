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
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenUsedError,
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
    })

    expect(prismaMock.commission.create).toHaveBeenCalledTimes(1)
    // highest tier ratePercent=10: amount = 100 * 10 / 100 = 10
    expect(prismaMock.commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 10 }) }),
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

  it("throws InviteTokenUsedError when already accepted", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenUsedError)
  })

  it("throws InviteTokenExpiredError when past expiry", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { token: "tok", name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenExpiredError)
  })

  it("throws InviteTokenConcurrentAcceptError when token already claimed by concurrent request", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 10000),
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
