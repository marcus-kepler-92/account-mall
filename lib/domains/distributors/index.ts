// lib/domains/distributors/index.ts

// CommissionTier
export { listCommissionTiers, createCommissionTier, updateCommissionTier, deleteCommissionTier } from "./service"

// Distributor CRUD
export { listDistributors, updateDistributor, deleteDistributor } from "./service"

// Invitations
export { sendInvite, createNoEmailInviteLink, acceptInvite, bindInviter } from "./service"

// Profile
export { getDistributorProfile, getDistributorTierSummary } from "./service"

// Commissions
export { createOrderCommissions, listDistributorCommissions } from "./service"

// Withdrawals
export { listDistributorWithdrawals, createWithdrawal, listAdminWithdrawals, countPendingWithdrawals, processWithdrawal } from "./service"

// Order reassign
export { reassignOrderDistributor } from "./service"

// Report
export { getDistributorReport } from "./service"

// Utilities (consumed by shims)
export { toNumber, getWeekStart, adjustRate } from "./service"

// Validators
export {
  distributorInviteSchema,
  acceptInviteSchema,
  acceptNoEmailInviteSchema,
  usernameSchema,
  bindInviterSchema,
  updateDistributorSchema,
  createTierSchema,
  updateTierSchema,
  updateWithdrawalSchema,
  reassignDistributorSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
} from "./validators"
export type {
  DistributorInviteInput,
  AcceptInviteInput,
  AcceptNoEmailInviteInput,
  BindInviterInput,
  UpdateDistributorInput,
  CreateTierInput,
  UpdateTierInput,
  UpdateWithdrawalInput,
  ReassignDistributorInput,
} from "./validators"

// Types
export type {
  TierRow,
  DistributorRow,
  CommissionRow,
  WithdrawalRow,
  AdminWithdrawalRow,
  DistributorTierSummary,
  TierSummaryItem,
  SendInviteResult,
  CreateOrderCommissionsParams,
} from "./types"

// Milestone CRUD (will be added in Task 3)
export {
  listInvitationMilestones,
  createInvitationMilestone,
  updateInvitationMilestone,
  deleteInvitationMilestone,
  listDistributorMilestoneBonuses,
  checkAndIssueMilestoneBonuses,
  checkAndIssueInvitationMilestoneBonuses,
} from "./milestone-service"

export type { CreateMilestoneInput, UpdateMilestoneInput } from "./validators"
export type { MilestoneRow, MilestoneBonusRow } from "./types"
export {
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "./types"

// Domain errors
export {
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  CommissionTierNotFoundError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenUsedError,
  InviteTokenExpiredError,
  UsernameConflictError,
  EmailAlreadyRegisteredError,
  InviterCodeInvalidError,
  SelfInviterError,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
  UsernameRequiredError,
  InviteTokenConcurrentAcceptError,
  InviteTokenExhaustedError,
} from "./types"
