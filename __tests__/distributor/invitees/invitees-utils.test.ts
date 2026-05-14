import { computeInviteeTierInfo } from "@/app/distributor/(main)/invitees/invitees-utils"

const TIERS = [
  { minAmount: 0, maxAmount: 1000, ratePercent: 5 },
  { minAmount: 1000, maxAmount: 3000, ratePercent: 8 },
  { minAmount: 3000, maxAmount: 999999, ratePercent: 10 },
]

describe("computeInviteeTierInfo", () => {
  describe("no tiers configured", () => {
    it("returns null for both fields", () => {
      expect(computeInviteeTierInfo(500, [])).toEqual({
        tierLabel: null,
        nextTierMinAmount: null,
      })
    })

    it("returns null for both fields even with zero sales", () => {
      expect(computeInviteeTierInfo(0, [])).toEqual({
        tierLabel: null,
        nextTierMinAmount: null,
      })
    })
  })

  describe("tier boundary classification", () => {
    it("places sales=0 in first tier when first tier starts at 0", () => {
      expect(computeInviteeTierInfo(0, TIERS)).toEqual({
        tierLabel: "第1档·5%",
        nextTierMinAmount: 1000,
      })
    })

    it("places sales exactly at a lower boundary in the next tier", () => {
      // 1000 is >= 1000 and < 3000 → tier 2
      expect(computeInviteeTierInfo(1000, TIERS)).toEqual({
        tierLabel: "第2档·8%",
        nextTierMinAmount: 3000,
      })
    })

    it("places sales in the middle of a tier correctly", () => {
      expect(computeInviteeTierInfo(2000, TIERS)).toEqual({
        tierLabel: "第2档·8%",
        nextTierMinAmount: 3000,
      })
    })

    it("places sales just below a boundary in the lower tier", () => {
      expect(computeInviteeTierInfo(999.99, TIERS)).toEqual({
        tierLabel: "第1档·5%",
        nextTierMinAmount: 1000,
      })
    })

    it("places sales at the last tier lower boundary in the last tier", () => {
      expect(computeInviteeTierInfo(3000, TIERS)).toEqual({
        tierLabel: "第3档·10%",
        nextTierMinAmount: null,
      })
    })
  })

  describe("last tier and overflow", () => {
    it("returns null nextTierMinAmount when already in the last tier", () => {
      expect(computeInviteeTierInfo(5000, TIERS)).toEqual({
        tierLabel: "第3档·10%",
        nextTierMinAmount: null,
      })
    })

    it("falls back to the last tier when sales exceed all tier maxAmounts", () => {
      // 999999 is not < 999999, so no tier matches → falls back to last
      expect(computeInviteeTierInfo(999999, TIERS)).toEqual({
        tierLabel: "第3档·10%",
        nextTierMinAmount: null,
      })
    })
  })

  describe("single tier", () => {
    it("labels correctly and returns null nextTierMinAmount", () => {
      const single = [{ minAmount: 0, maxAmount: 10000, ratePercent: 5 }]
      expect(computeInviteeTierInfo(500, single)).toEqual({
        tierLabel: "第1档·5%",
        nextTierMinAmount: null,
      })
    })
  })

  describe("decimal rate formatting", () => {
    it("preserves decimal rate in the label", () => {
      const tiers = [{ minAmount: 0, maxAmount: 1000, ratePercent: 7.5 }]
      expect(computeInviteeTierInfo(500, tiers).tierLabel).toBe("第1档·7.5%")
    })
  })

  describe("nextTierMinAmount accuracy for gap display", () => {
    it("provides the exact threshold needed for gap calculation", () => {
      // sales=800, needs 200 more to reach tier 2 (min 1000)
      const result = computeInviteeTierInfo(800, TIERS)
      expect(result.nextTierMinAmount).toBe(1000)
      expect(result.nextTierMinAmount! - 800).toBeCloseTo(200)
    })

    it("provides tier 3 threshold when in tier 2", () => {
      const result = computeInviteeTierInfo(1500, TIERS)
      expect(result.nextTierMinAmount).toBe(3000)
      expect(result.nextTierMinAmount! - 1500).toBeCloseTo(1500)
    })
  })
})
