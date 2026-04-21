jest.mock("../repository")
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
import {
  updateDistributor,
  deleteDistributor,
  processWithdrawal,
  createWithdrawal,
  createCommissionTier,
  acceptInvite,
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
} from "../types"

beforeEach(() => jest.clearAllMocks())

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
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PAID" })
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalNotPendingError)
  })

  it("updates withdrawal when PENDING", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PENDING" })
    ;(repo.updateWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: { toNumber: () => 100 },
      feeAmount: 2,
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
    )
  })
})

// ── createWithdrawal ──────────────────────────────────────────────────────────

describe("createWithdrawal", () => {
  it("throws WithdrawalOverBalanceError when amount exceeds balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(50)
    ;(repo.aggregateWithdrawalSum as jest.Mock)
      .mockResolvedValueOnce(40) // PAID
      .mockResolvedValueOnce(0)  // PENDING
    // balance = 50 - 40 - 0 = 10; withdraw 20 → over
    await expect(
      createWithdrawal("d1", 20, 2, "https://img.url/receipt.png"),
    ).rejects.toThrow(WithdrawalOverBalanceError)
  })

  it("creates withdrawal when amount is within balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(100)
    ;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(0)
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

// ── acceptInvite ──────────────────────────────────────────────────────────────

describe("acceptInvite", () => {
  it("throws InviteTokenNotFoundError when token missing", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue(null)
    await expect(
      acceptInvite("bad-token", { name: "Alice", password: "pass1234" }),
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
      acceptInvite("tok", { name: "Alice", password: "pass1234" }),
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
      acceptInvite("tok", { name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenExpiredError)
  })
})
