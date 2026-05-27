import {
  canTransition,
  assertTransition,
  nextLeadStatuses,
  InvalidTransitionError,
} from "@/lib/agent-lead-state-machine"
import type { LeadStatus } from "@prisma/client"

const ACTIVE: LeadStatus[] = ["NEW", "PENDING_CONTACT", "CONTACTED"]
const TERMINAL: LeadStatus[] = ["RESOLVED", "DROPPED"]
const ALL: LeadStatus[] = [...ACTIVE, ...TERMINAL]

describe("agent lead state machine", () => {
  describe("canTransition", () => {
    it("NEW → CONTACTED / RESOLVED / DROPPED all legal", () => {
      expect(canTransition("NEW", "CONTACTED")).toBe(true)
      expect(canTransition("NEW", "RESOLVED")).toBe(true)
      expect(canTransition("NEW", "DROPPED")).toBe(true)
    })

    it("PENDING_CONTACT → CONTACTED / RESOLVED / DROPPED all legal", () => {
      expect(canTransition("PENDING_CONTACT", "CONTACTED")).toBe(true)
      expect(canTransition("PENDING_CONTACT", "RESOLVED")).toBe(true)
      expect(canTransition("PENDING_CONTACT", "DROPPED")).toBe(true)
    })

    it("CONTACTED → RESOLVED / DROPPED legal", () => {
      expect(canTransition("CONTACTED", "RESOLVED")).toBe(true)
      expect(canTransition("CONTACTED", "DROPPED")).toBe(true)
    })

    it("rejects self-loops for every status", () => {
      for (const s of ALL) {
        expect(canTransition(s, s)).toBe(false)
      }
    })

    it("rejects any outbound transition from terminal states", () => {
      for (const from of TERMINAL) {
        for (const to of ALL) {
          if (from === to) continue
          expect(canTransition(from, to)).toBe(false)
        }
      }
    })

    it("rejects NEW ↔ PENDING_CONTACT cross-transitions (semantically distinct entry points)", () => {
      expect(canTransition("NEW", "PENDING_CONTACT")).toBe(false)
      expect(canTransition("PENDING_CONTACT", "NEW")).toBe(false)
    })

    it("rejects CONTACTED → NEW / PENDING_CONTACT (no reverting)", () => {
      expect(canTransition("CONTACTED", "NEW")).toBe(false)
      expect(canTransition("CONTACTED", "PENDING_CONTACT")).toBe(false)
    })
  })

  describe("nextLeadStatuses", () => {
    it("NEW lists [CONTACTED, RESOLVED, DROPPED] in RULES declaration order", () => {
      expect(nextLeadStatuses("NEW")).toEqual(["CONTACTED", "RESOLVED", "DROPPED"])
    })

    it("PENDING_CONTACT lists [CONTACTED, RESOLVED, DROPPED]", () => {
      expect(nextLeadStatuses("PENDING_CONTACT")).toEqual([
        "CONTACTED",
        "RESOLVED",
        "DROPPED",
      ])
    })

    it("CONTACTED lists [RESOLVED, DROPPED]", () => {
      expect(nextLeadStatuses("CONTACTED")).toEqual(["RESOLVED", "DROPPED"])
    })

    it("terminal states return empty list", () => {
      for (const s of TERMINAL) {
        expect(nextLeadStatuses(s)).toEqual([])
      }
    })
  })

  describe("assertTransition", () => {
    it("throws InvalidTransitionError on illegal transition", () => {
      expect(() => assertTransition("RESOLVED", "NEW")).toThrow(InvalidTransitionError)
      expect(() => assertTransition("NEW", "NEW")).toThrow(InvalidTransitionError)
    })

    it("does not throw on legal transition", () => {
      expect(() => assertTransition("NEW", "DROPPED")).not.toThrow()
      expect(() => assertTransition("CONTACTED", "RESOLVED")).not.toThrow()
    })

    it("InvalidTransitionError carries from/to in message and is instanceof Error", () => {
      try {
        assertTransition("RESOLVED", "CONTACTED")
        throw new Error("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTransitionError)
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toContain("RESOLVED")
        expect((err as Error).message).toContain("CONTACTED")
      }
    })
  })
})
