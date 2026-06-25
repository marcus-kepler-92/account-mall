import type { SourceKey } from "./index"

/**
 * Maps a live (unread) notification item to the deepest available admin
 * target. Orders / leads / products each have a detail page keyed by id;
 * withdrawals have no per-item page, so they land on the PENDING-filtered
 * list (live unread withdrawals are always PENDING).
 *
 * The dismissed-history route builds its own hrefs because it must fall
 * back to list pages when the underlying entity has been deleted, and its
 * withdrawals link is status-aware (the row may have moved to PAID/REJECTED).
 */
export function notificationHref(sourceKey: SourceKey, itemId: string): string {
  switch (sourceKey) {
    case "manualPendingOrders":
      return `/admin/orders/${itemId}`
    case "agentLeads":
      return `/admin/agent/leads/${itemId}`
    case "inventoryAlerts":
      return `/admin/products/${itemId}`
    case "withdrawals":
      return "/admin/withdrawals?status=PENDING"
  }
}
