import type { LeadStatus } from "@prisma/client"

type Rule = { from: LeadStatus; to: LeadStatus }

// Mainstream: NEW → CONTACTED → RESOLVED.
// All active statuses can also one-shot to RESOLVED / DROPPED:
//   - DROPPED captures spam / misfire / invalid inquiries — "not handled" is
//     also a fulfilled outcome, the lead shouldn't sit in the unread queue.
//   - RESOLVED from NEW/PENDING_CONTACT covers cases where ops handled the
//     customer out-of-band (email, external IM) and just wants to mark the
//     record done without first stamping CONTACTED for the ceremony of it.
// Self-loops (X → X) are intentionally omitted — they would otherwise re-stamp
// contactedAt/By on every repeat PATCH to CONTACTED.
const RULES: ReadonlyArray<Rule> = [
  { from: "NEW", to: "CONTACTED" },
  { from: "NEW", to: "RESOLVED" },
  { from: "NEW", to: "DROPPED" },
  { from: "PENDING_CONTACT", to: "CONTACTED" },
  { from: "PENDING_CONTACT", to: "RESOLVED" },
  { from: "PENDING_CONTACT", to: "DROPPED" },
  { from: "CONTACTED", to: "RESOLVED" },
  { from: "CONTACTED", to: "DROPPED" },
]

export class InvalidTransitionError extends Error {
  constructor(from: LeadStatus, to: LeadStatus) {
    super(`Illegal lead transition: ${from} → ${to}`)
    this.name = "InvalidTransitionError"
  }
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return RULES.some((r) => r.from === from && r.to === to)
}

export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to)
  }
}

export function nextLeadStatuses(from: LeadStatus): LeadStatus[] {
  return RULES.filter((r) => r.from === from).map((r) => r.to)
}
