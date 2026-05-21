import type { PrismaClient } from "@prisma/client"
import type { LucideIcon } from "lucide-react"
import type { InventorySubtype } from "@/lib/inventory"

export type SourceKey = "withdrawals" | "agentLeads" | "inventoryAlerts"

export type WithdrawalItem = {
  id: string
  distributorName: string
  amount: number
  createdAt: string
}

export type AgentLeadItem = {
  id: string
  displayName: string
  status: "NEW" | "CONTACTED"
  urgency: "LOW" | "MED" | "HIGH"
  createdAt: string
}

export type InventoryAlertItem = {
  productId: string
  productName: string
  unsoldCount: number
  subscriberCount: number
  subtype: InventorySubtype
}

export type SourceResult =
  | { key: "withdrawals"; count: number; items: WithdrawalItem[] }
  | { key: "agentLeads"; count: number; items: AgentLeadItem[] }
  | {
      key: "inventoryAlerts"
      count: number
      breakdown: { outOfStock: number; lowStock: number; restockWaiting: number }
      items: InventoryAlertItem[]
    }

type ResultByKey<K extends SourceKey> = Omit<Extract<SourceResult, { key: K }>, "key">

export type NotificationSource<K extends SourceKey = SourceKey> = {
  key: K
  label: string
  icon: LucideIcon
  menuHref: string
  viewAllHref: string
  fetch(prisma: PrismaClient): Promise<ResultByKey<K>>
}

// Populated by subsequent tasks.
export const SOURCES: NotificationSource[] = []

const HREF_TO_KEY = new Map<string, SourceKey>()
export function registerSource(source: NotificationSource): void {
  SOURCES.push(source)
  HREF_TO_KEY.set(source.menuHref, source.key)
}

export function sourceFor(menuHref: string): SourceKey | undefined {
  return HREF_TO_KEY.get(menuHref)
}

import { withdrawalsSource } from "./sources/withdrawals"
registerSource(withdrawalsSource)
