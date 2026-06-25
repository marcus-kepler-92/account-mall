import { notificationHref } from "@/lib/admin-notifications/href"
import { SOURCE_KEYS } from "@/lib/admin-notifications"

describe("notificationHref", () => {
  it("deep-links order / lead / product sources to their detail pages by id", () => {
    expect(notificationHref("manualPendingOrders", "ord_123")).toBe("/admin/orders/ord_123")
    expect(notificationHref("agentLeads", "lead_123")).toBe("/admin/agent/leads/lead_123")
    expect(notificationHref("inventoryAlerts", "prod_123")).toBe("/admin/products/prod_123")
  })

  it("sends withdrawals to the PENDING-filtered list (no per-item detail page)", () => {
    expect(notificationHref("withdrawals", "wd_123")).toBe("/admin/withdrawals?status=PENDING")
  })

  it("returns a non-empty href for every registered source key", () => {
    for (const key of SOURCE_KEYS) {
      expect(notificationHref(key, "x")).toMatch(/^\/admin\//)
    }
  })
})
