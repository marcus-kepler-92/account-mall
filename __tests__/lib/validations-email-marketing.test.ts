import {
  createTemplateSchema,
  updateTemplateSchema,
  createCampaignSchema,
  customerFilterSchema,
  distributorFilterSchema,
  recipientPreviewSchema,
} from "@/lib/validations/email-marketing"

describe("email-marketing validations", () => {
  describe("createTemplateSchema", () => {
    it("accepts valid template", () => {
      const result = createTemplateSchema.safeParse({
        title: "Summer Sale",
        defaultSubject: "Big discounts inside",
        unlayerDesign: { body: {} },
        html: "<html>...</html>",
      })
      expect(result.success).toBe(true)
    })

    it("rejects empty title", () => {
      const result = createTemplateSchema.safeParse({
        title: "",
        defaultSubject: "Subject",
        unlayerDesign: {},
        html: "<p>hi</p>",
      })
      expect(result.success).toBe(false)
    })

    it("rejects empty html", () => {
      const result = createTemplateSchema.safeParse({
        title: "Test",
        defaultSubject: "Sub",
        unlayerDesign: {},
        html: "",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("createCampaignSchema", () => {
    it("accepts valid customer campaign", () => {
      const result = createCampaignSchema.safeParse({
        name: "Q1 Promo",
        subject: "Don't miss out",
        html: "<p>hello</p>",
        templateId: null,
        recipientType: "CUSTOMERS",
        recipientFilter: { productIds: ["abc"], dateFrom: "2025-01-01" },
      })
      expect(result.success).toBe(true)
    })

    it("accepts valid distributor campaign", () => {
      const result = createCampaignSchema.safeParse({
        name: "Dist promo",
        subject: "Earn more",
        html: "<p>hi</p>",
        templateId: null,
        recipientType: "DISTRIBUTORS",
        recipientFilter: { level: "level1" },
      })
      expect(result.success).toBe(true)
    })

    it("rejects empty name", () => {
      const result = createCampaignSchema.safeParse({
        name: "",
        subject: "Sub",
        html: "<p>hi</p>",
        templateId: null,
        recipientType: "CUSTOMERS",
        recipientFilter: {},
      })
      expect(result.success).toBe(false)
    })
  })

  describe("customerFilterSchema", () => {
    it("accepts empty filter", () => {
      expect(customerFilterSchema.safeParse({}).success).toBe(true)
    })

    it("accepts full filter", () => {
      expect(
        customerFilterSchema.safeParse({
          productIds: ["id1", "id2"],
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        }).success
      ).toBe(true)
    })
  })

  describe("distributorFilterSchema", () => {
    it("accepts all valid levels", () => {
      expect(distributorFilterSchema.safeParse({ level: "all" }).success).toBe(true)
      expect(distributorFilterSchema.safeParse({ level: "level1" }).success).toBe(true)
      expect(distributorFilterSchema.safeParse({ level: "level2" }).success).toBe(true)
    })

    it("rejects invalid level", () => {
      expect(distributorFilterSchema.safeParse({ level: "level3" }).success).toBe(false)
    })
  })
})
