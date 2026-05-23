"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { ProductOrderForm } from "@/app/components/product-order-form"
import type { ProductVariantOption } from "@/app/components/product-variant-selector"
import { ExitIntentDialog } from "./exit-intent-dialog"

type ProductOrderSectionProps = {
    productId: string
    productName: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
    productType?: "NORMAL" | "AUTO_FETCH" | "MANUAL"
    /** AUTO_FETCH 商品的账号有效时长（小时），用于展示限领规则 */
    validityHours?: number | null
    couponEnabled?: boolean
    requireTurnstile: boolean
    prefilledEmail?: string
    cs?: string | null
    crossSellDiscountPercent?: number | null
    /** MANUAL only: available variants for the buyer to pick. */
    variants?: ProductVariantOption[]
    /** Buyer-facing business-hours hint (e.g. "工作时间：9:00–22:00（每天）"). */
    businessHoursHint?: string
}

/**
 * 商品详情页的下单区域客户端包装：
 * 管理 exit intent 折扣 token 状态，将 ExitIntentDialog 和 ProductOrderForm 关联起来。
 */
export function ProductOrderSection({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
    productType = "NORMAL",
    validityHours,
    couponEnabled = false,
    requireTurnstile,
    prefilledEmail,
    cs = null,
    crossSellDiscountPercent = null,
    variants,
    businessHoursHint,
}: ProductOrderSectionProps) {
    const [exitDiscountToken, setExitDiscountToken] = useState<string | null>(null)
    const [exitDiscountPercent, setExitDiscountPercent] = useState<number | null>(null)
    // MANUAL: preselect the first in-stock active variant for a less-friction
    // first paint. Buyer can switch via the selector.
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => {
        if (productType !== "MANUAL" || !variants) return null
        const firstAvailable = variants.find((v) => v.isActive && v.stockQuantity > 0)
        return firstAvailable?.id ?? null
    })

    const handleDiscount = (token: string, discountPercent: number) => {
        setExitDiscountToken(token)
        setExitDiscountPercent(discountPercent)
    }

    const handleConsumed = () => {
        setExitDiscountToken(null)
        setExitDiscountPercent(null)
    }

    const isFreeAutoFetch = productType === "AUTO_FETCH" && price === 0
    const isManual = productType === "MANUAL"
    const displayValidityHours = validityHours ?? 24

    return (
        <>
            {/* 免费 AUTO_FETCH 限领规则提示 */}
            {isFreeAutoFetch && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    <Info className="size-3.5 mt-0.5 shrink-0" aria-hidden />
                    <p className="leading-relaxed">
                        每人每天可领取 1 次，账号在 {displayValidityHours} 小时内持续有效，到期后可再次领取
                    </p>
                </div>
            )}
            <ProductOrderForm
                productId={productId}
                productName={productName}
                maxQuantity={maxQuantity}
                price={price}
                inStock={inStock}
                formId={formId}
                productType={productType}
                couponEnabled={couponEnabled}
                requireTurnstile={requireTurnstile}
                prefilledEmail={prefilledEmail}
                exitDiscountToken={exitDiscountToken}
                exitDiscountPercent={exitDiscountPercent}
                onExitDiscountConsumed={handleConsumed}
                cs={cs}
                crossSellDiscountPercent={crossSellDiscountPercent}
                variants={variants}
                selectedVariantId={selectedVariantId}
                onVariantChange={setSelectedVariantId}
            />
            {/* MANUAL 商品在下单卡片底部展示工作时间提示，告知人工发货的处理时段。 */}
            {isManual && businessHoursHint && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                    {businessHoursHint}
                </p>
            )}
            {/* MANUAL 商品跳过 exit-intent 折扣（与 Task 15 的入口守卫保持一致：人工发货不参与营销叠加）。 */}
            {price > 0 && !cs && !isManual && (
                <ExitIntentDialog
                    productId={productId}
                    productName={productName}
                    price={price}
                    inStock={inStock}
                    onDiscount={handleDiscount}
                />
            )}
        </>
    )
}
