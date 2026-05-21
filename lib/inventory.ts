// lib/inventory.ts
// Admin 后端库存预警阈值。前端商品卡使用 configClient.lowStockThreshold
// 是另一套配置（受 NEXT_PUBLIC_LOW_STOCK_THRESHOLD 控制，由站长 env 调）。
export const LOW_STOCK_THRESHOLD = 3

export type InventorySubtype = "RESTOCK_WAITING" | "OUT_OF_STOCK" | "LOW_STOCK"

/**
 * 互斥优先级：RESTOCK_WAITING > OUT_OF_STOCK > LOW_STOCK。
 * 返回 null 表示库存正常。
 */
export function resolveInventorySubtype(
  unsoldCount: number,
  subscriberCount: number,
): InventorySubtype | null {
  if (unsoldCount === 0 && subscriberCount > 0) return "RESTOCK_WAITING"
  if (unsoldCount === 0) return "OUT_OF_STOCK"
  if (unsoldCount < LOW_STOCK_THRESHOLD) return "LOW_STOCK"
  return null
}
