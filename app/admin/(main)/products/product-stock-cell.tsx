"use client"

import { useState } from "react"
import { resolveInventorySubtype } from "@/lib/inventory"
import { cn } from "@/lib/utils"
import { BulkImportCards } from "./[productId]/cards/bulk-import-cards"

type ProductStockCellProps = {
    productId: string
    productType: string
    /** Numeric UNSOLD-card count; used to derive the alert subtype. */
    stock: number
    /** Pre-formatted display label ("不限" for unlimited rows, otherwise the count). */
    stockLabel: string
    /** Pending restock subscribers; promotes 缺货 → 等补货 (most urgent). */
    subscriberCount: number
    /** Product-level default purchase cost, prefilled into the import dialog. */
    costPerUnit: number | null
}

// Only NORMAL products own a card pool that can be restocked by importing cards.
// AUTO_FETCH (on-demand) and MANUAL (variant-level stock) render as plain text.
export function ProductStockCell({
    productId,
    productType,
    stock,
    stockLabel,
    subscriberCount,
    costPerUnit,
}: ProductStockCellProps) {
    const [open, setOpen] = useState(false)

    if (productType !== "NORMAL") {
        return <span>{stockLabel}</span>
    }

    const subtype = resolveInventorySubtype(stock, subscriberCount)
    // 缺货 / 等补货 → red; 低库存预警 → amber; 正常 → default.
    const tone =
        subtype === "OUT_OF_STOCK" || subtype === "RESTOCK_WAITING"
            ? "text-destructive font-semibold"
            : subtype === "LOW_STOCK"
              ? "text-amber-600 font-medium"
              : ""
    const title =
        subtype === "RESTOCK_WAITING"
            ? `${subscriberCount} 人等待补货，点击补货`
            : "点击补货"

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title={title}
                className={cn(
                    "-mx-1 rounded px-1 text-left tabular-nums underline-offset-2 transition-colors hover:text-primary hover:underline",
                    tone,
                )}
            >
                {stockLabel}
            </button>
            <BulkImportCards
                productId={productId}
                defaultUnitCost={costPerUnit}
                currentStock={stock}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    )
}
