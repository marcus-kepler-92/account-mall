import { createMilestoneSchema } from "@/lib/domains/distributors/validators"

describe("createMilestoneSchema", () => {
  describe("INVITATION type — thresholdCount", () => {
    it("accepts thresholdCount = 1 (boundary)", () => {
      const result = createMilestoneSchema.safeParse({
        type: "INVITATION",
        thresholdCount: 1,
        thresholdAmount: 0,
        bonusAmount: 100,
      })
      expect(result.success).toBe(true)
    })

    it("accepts thresholdCount > 1", () => {
      const result = createMilestoneSchema.safeParse({
        type: "INVITATION",
        thresholdCount: 10,
        thresholdAmount: 0,
        bonusAmount: 50,
      })
      expect(result.success).toBe(true)
    })

    it("rejects thresholdCount = 0 with 邀请人数至少为 1", () => {
      const result = createMilestoneSchema.safeParse({
        type: "INVITATION",
        thresholdCount: 0,
        thresholdAmount: 0,
        bonusAmount: 100,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "thresholdCount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("邀请人数至少为 1")
      }
    })

    it("does not require thresholdAmount > 0 for INVITATION type", () => {
      const result = createMilestoneSchema.safeParse({
        type: "INVITATION",
        thresholdCount: 5,
        thresholdAmount: 0,
        bonusAmount: 20,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("SALES type — thresholdAmount", () => {
    it("accepts thresholdAmount > 0", () => {
      const result = createMilestoneSchema.safeParse({
        type: "SALES",
        thresholdCount: 0,
        thresholdAmount: 1000,
        bonusAmount: 200,
      })
      expect(result.success).toBe(true)
    })

    it("accepts thresholdAmount = 0.01 (smallest positive)", () => {
      const result = createMilestoneSchema.safeParse({
        type: "SALES",
        thresholdCount: 0,
        thresholdAmount: 0.01,
        bonusAmount: 5,
      })
      expect(result.success).toBe(true)
    })

    it("rejects thresholdAmount = 0 with 门槛销售额必须大于 0", () => {
      const result = createMilestoneSchema.safeParse({
        type: "SALES",
        thresholdCount: 0,
        thresholdAmount: 0,
        bonusAmount: 100,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "thresholdAmount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("门槛销售额必须大于 0")
      }
    })

    it("does not require thresholdCount >= 1 for SALES type", () => {
      const result = createMilestoneSchema.safeParse({
        type: "SALES",
        thresholdCount: 0,
        thresholdAmount: 500,
        bonusAmount: 50,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("bonusAmount", () => {
    it("rejects bonusAmount = 0", () => {
      const result = createMilestoneSchema.safeParse({
        type: "SALES",
        thresholdCount: 0,
        thresholdAmount: 100,
        bonusAmount: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "bonusAmount")
        expect(issue).toBeDefined()
        expect(issue?.message).toBe("奖励金额必须大于 0")
      }
    })

    it("rejects negative bonusAmount", () => {
      const result = createMilestoneSchema.safeParse({
        type: "INVITATION",
        thresholdCount: 2,
        thresholdAmount: 0,
        bonusAmount: -10,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("type field", () => {
    it("rejects an unknown type string", () => {
      const result = createMilestoneSchema.safeParse({
        type: "REFERRAL",
        thresholdCount: 1,
        thresholdAmount: 100,
        bonusAmount: 50,
      })
      expect(result.success).toBe(false)
    })

    it("rejects when type is missing", () => {
      const result = createMilestoneSchema.safeParse({
        thresholdCount: 1,
        thresholdAmount: 100,
        bonusAmount: 50,
      })
      expect(result.success).toBe(false)
    })
  })
})
