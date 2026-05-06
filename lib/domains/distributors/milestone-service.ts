// lib/domains/distributors/milestone-service.ts
// Stub — full implementation in Task 3.
// These stubs allow index.ts to re-export symbols without breaking the build.

import type { MilestoneRow, MilestoneBonusRow } from "./types"
import type { CreateMilestoneInput, UpdateMilestoneInput } from "./validators"

export async function listInvitationMilestones(): Promise<MilestoneRow[]> {
  throw new Error("Not implemented")
}

export async function createInvitationMilestone(_input: CreateMilestoneInput): Promise<MilestoneRow> {
  throw new Error("Not implemented")
}

export async function updateInvitationMilestone(
  _id: string,
  _input: UpdateMilestoneInput,
): Promise<MilestoneRow> {
  throw new Error("Not implemented")
}

export async function deleteInvitationMilestone(_id: string): Promise<void> {
  throw new Error("Not implemented")
}

export async function listDistributorMilestoneBonuses(
  _distributorId: string,
): Promise<MilestoneBonusRow[]> {
  throw new Error("Not implemented")
}

export async function checkAndIssueMilestoneBonuses(_inviteeId: string): Promise<void> {
  throw new Error("Not implemented")
}
