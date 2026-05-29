import { createMilestoneSchema } from "@/lib/domains/distributors/validators"

// The milestone `type` split (INVITATION/SALES) was reverted in migration
// 20260515000000_remove_milestone_type. The schema is now single-type: every
// milestone requires thresholdCount >= 1, thresholdAmount > 0, bonusAmount > 0.
describe("createMilestoneSchema", () => {
  const base = { thresholdCount: 3, thresholdAmount: 1000, bonusAmount: 50 }

  describe("thresholdCount", () => {
    it("accepts thresholdCount = 1 (boundary)", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdCount: 1 })
      expect(result.success).toBe(true)
    })

    it("accepts thresholdCount > 1", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdCount: 10 })
      expect(result.success).toBe(true)
    })

    it("rejects thresholdCount = 0 with 达标人数至少为 1", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdCount: 0 })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "thresholdCount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("达标人数至少为 1")
      }
    })

    it("rejects a non-integer thresholdCount", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdCount: 1.5 })
      expect(result.success).toBe(false)
    })
  })

  describe("thresholdAmount", () => {
    it("accepts thresholdAmount > 0", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdAmount: 1000 })
      expect(result.success).toBe(true)
    })

    it("accepts thresholdAmount = 0.01 (smallest positive)", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdAmount: 0.01 })
      expect(result.success).toBe(true)
    })

    it("rejects thresholdAmount = 0 with 每人最低消费必须大于 0", () => {
      const result = createMilestoneSchema.safeParse({ ...base, thresholdAmount: 0 })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "thresholdAmount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("每人最低消费必须大于 0")
      }
    })
  })

  describe("bonusAmount", () => {
    it("rejects bonusAmount = 0 with 奖励金额必须大于 0", () => {
      const result = createMilestoneSchema.safeParse({ ...base, bonusAmount: 0 })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "bonusAmount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("奖励金额必须大于 0")
      }
    })

    it("rejects negative bonusAmount", () => {
      const result = createMilestoneSchema.safeParse({ ...base, bonusAmount: -10 })
      expect(result.success).toBe(false)
    })
  })

  describe("required fields", () => {
    it("rejects when thresholdCount is missing", () => {
      const result = createMilestoneSchema.safeParse({ thresholdAmount: 1000, bonusAmount: 50 })
      expect(result.success).toBe(false)
    })

    it("rejects when thresholdAmount is missing", () => {
      const result = createMilestoneSchema.safeParse({ thresholdCount: 3, bonusAmount: 50 })
      expect(result.success).toBe(false)
    })
  })
})
